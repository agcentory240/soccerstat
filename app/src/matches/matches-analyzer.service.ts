// src/matches/matches-analyzer.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { MatchEntity } from './match.entity.js';
import { AiService } from '../ai/ai.service.js';
import {
  MATCH_FILTER_SYSTEM_PROMPT,
  MatchSelectionResult,
  ScoredMatch,
  DeepAnalysisResult,
  DEEP_ANALYSIS_SYSTEM_PROMPT,
  BET_RESULT_SYSTEM_PROMPT,
  BetResultResponse,
} from '../ai/ai-prompts.js';
import { ClientProxy } from '@nestjs/microservices';
import { StateService } from '../state/state.service.js';
import type { ServerStateMatchInfo } from '../state/state.types.js';
import type { BetCheckResult } from './bet-check.interface.js';
import { parseFinalScore, formatScorePair } from '../nb-bet-parser-main/helpers/parse-final-score.js';

@Injectable()
export class MatchesAnalyzerService {
  private readonly logger = new Logger(MatchesAnalyzerService.name);
  /** Размер пачки матчей в одном запросе к AI (ограничение контекста и стоимости). */
  private readonly BATCH_SIZE = 50;
  /** Предохранитель от бесконечного цикла: максимум пачек за один запуск. */
  private readonly MAX_BATCHES = 40;
  /** Размер чанка для bulk-update по id (лимит параметров SQL-запроса). */
  private readonly UPDATE_CHUNK_SIZE = 500;
  private readonly MIN_SCORE_THRESHOLD = 6;  // порог для selected
  private readonly TOP_N = 10;               // максимум выбранных

  constructor(
    @InjectRepository(MatchEntity)
    private readonly repo: Repository<MatchEntity>,
    private readonly aiService: AiService,
    @Inject('MATCHES_SERVICE') private readonly client: ClientProxy,
    private readonly stateService: StateService,
  ) { }

  /**
   * Быстрая оценка ВСЕХ неоценённых предстоящих матчей.
   *
   * Матчи уходят в AI пачками по `BATCH_SIZE` (ограничение контекста и стоимости
   * одного запроса), но цикл продолжается до опустошения выборки
   * `aiScore IS NULL AND score IS NULL`. Поэтому оценивается весь список,
   * а не только первые 50 записей.
   *
   * Топ-N для глубокого анализа выбирается глобально по всем оценкам,
   * а не внутри каждой пачки.
   */
  async analyzeUnprocessed(): Promise<{ sent: number; selected: number }> {
    const where = {
      aiScore: IsNull(),        // ← ключевое: нет оценки
      score: IsNull(),          // матч ещё не сыгран
    };

    const total = await this.repo.count({ where });

    if (total === 0) {
      this.logger.log('No matches to analyze');
      await this.stateService.update({
        status: 'idle',
        stage: null,
        message: 'Нет матчей для AI-анализа',
        progress: null,
      });
      return { sent: 0, selected: 0 };
    }

    this.logger.log(
      `Sending ${total} matches to AI (пачки по ${this.BATCH_SIZE})`,
    );
    await this.stateService.analyzingStart(total);

    const allCandidates: MatchEntity[] = [];
    const allScored: ScoredMatch[] = [];
    const handledIds = new Set<number>();
    let processed = 0;

    // 1. Оцениваем все матчи пачками, пока выборка не опустеет
    for (let batchIndex = 0; batchIndex < this.MAX_BATCHES; batchIndex++) {
      const batch = await this.repo.find({
        where,
        order: { dateTime: 'ASC' },
        take: this.BATCH_SIZE,
      });

      if (batch.length === 0) break;

      // Страховка от зацикливания: если выборка не сдвинулась,
      // значит оценки не сохранились — прерываемся.
      const fresh = batch.filter((m) => !handledIds.has(m.id));
      if (fresh.length === 0) {
        this.logger.warn(
          'Выборка неоценённых матчей не изменилась — прерываю AI-анализ',
        );
        break;
      }

      const scored = await this.scoreBatch(fresh);
      await this.saveScores(scored, fresh);

      for (const match of fresh) handledIds.add(match.id);
      allCandidates.push(...fresh);
      allScored.push(...scored);
      processed += fresh.length;

      this.logger.log(`AI-анализ: обработано ${processed} из ${total}`);
      await this.stateService.analyzingProgress(processed, total);
    }

    if (processed < total) {
      this.logger.warn(
        `Оценено ${processed} из ${total} матчей: достигнут предохранитель ${this.MAX_BATCHES} пачек`,
      );
    }

    // 2. Глобальный топ-N по всем оценкам
    const topMatches = allScored
      .filter((s) => s.score >= this.MIN_SCORE_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.TOP_N);

    this.logger.log(
      `📊 Топ-${topMatches.length} матчей (score >= ${this.MIN_SCORE_THRESHOLD})`,
    );

    const topIds = new Set(topMatches.map((s) => s.id));

    // 3. Помечаем топ как selected
    if (topIds.size > 0) {
      await this.repo.update(
        { id: In([...topIds]) },
        { selected: true, marked: true },
      );
    }

    // 4. Остальные оценённые матчи — marked, но не selected
    const nonSelectedIds = allCandidates
      .filter((c) => !topIds.has(c.id))
      .map((c) => c.id);

    for (const chunk of this.chunk(nonSelectedIds, this.UPDATE_CHUNK_SIZE)) {
      await this.repo.update(
        { id: In(chunk) },
        { marked: true, selected: false },
      );
    }

    // 5. Формируем список отобранных матчей для Redis/SSE (`matches_analized`)
    const selectedInfo: ServerStateMatchInfo[] = allCandidates
      .filter((c) => topIds.has(c.id))
      .map((c) => this.toMatchInfo(c));

    // 6. Отправляем событие в RabbitMQ (оркестрация) и Redis (фронтенд)
    this.client.emit('matches.analyzed', {
      total: allCandidates.length,
      selected: topMatches.length,
      topIds: [...topIds],
    });

    await this.stateService.analyzingDone(
      allCandidates.length,
      topMatches.length,
      selectedInfo,
    );

    return { sent: allCandidates.length, selected: topMatches.length };
  }

  /**
   * Оценка одной пачки матчей быстрой AI-моделью.
   * Возвращает только матчи, которые модель включила в ответ
   * (отсутствующие трактуются как score = 0 в `saveScores`).
   */
  private async scoreBatch(candidates: MatchEntity[]): Promise<ScoredMatch[]> {
    // Компактный список для AI
    const compactList = candidates.map((m) => ({
      id: m.id,
      c: m.country,
      l: m.league,
      dt: this.formatDateTime(m.dateTime),
      h: m.homeTeam,
      a: m.awayTeam,
      o: [m.oddsHome, m.oddsDraw, m.oddsAway],
      i: m.info ?? undefined,
    }));

    const userPrompt = `Оцени каждый матч по шкале 0-10. Верни JSON со всеми матчами.\n\n${JSON.stringify(compactList)}`;

    try {
      const result = await this.aiService.chatJson<MatchSelectionResult>(
        [
          { role: 'system', content: MATCH_FILTER_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        {
          model: 'deepseek-flash',
          temperature: 0.1,
          maxTokens: 8192,
          thinking: false,
        },
      );

      const scored = result?.matches ?? [];
      this.logger.log(`AI scored ${scored.length} of ${candidates.length}`);
      return scored;
    } catch (err: any) {
      this.logger.error(`AI request failed: ${err.message}`);
      await this.stateService.fail('analyzing', `Ошибка AI-анализа: ${err.message}`);
      throw err;
    }
  }

  /** Разбиение массива на чанки заданного размера. */
  private chunk<T>(items: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      result.push(items.slice(i, i + size));
    }
    return result;
  }

  /**
   * Сохранение оценок ИИ в БД
   */
  private async saveScores(
    scored: Array<{ id: number; score: number; reason: string; market?: string }>,
    candidates: MatchEntity[],
  ): Promise<void> {
    const scoreMap = new Map(scored.map((s) => [s.id, s]));
    const candidateIds = new Set(candidates.map((c) => c.id));
    const updates: Promise<any>[] = [];

    // 1. Сохраняем оценки для тех, кого вернул AI
    for (const [id, s] of scoreMap.entries()) {
      if (!candidateIds.has(id)) {
        this.logger.warn(`AI returned unknown id ${id}`);
        continue;
      }

      updates.push(
        this.repo.update(
          { id },
          {
            aiScore: Math.max(0, Math.min(10, s.score)),
            aiReason: (s.reason || '').substring(0, 255),
            aiMarket: (s.market || '-').substring(0, 50),
          },
        ),
      );
    }

    // 2. Матчи, которых НЕТ в ответе AI = score 0
    const notReturned = candidates.filter((c) => !scoreMap.has(c.id));
    for (const c of notReturned) {
      updates.push(
        this.repo.update(
          { id: c.id },
          {
            aiScore: 0,
            aiReason: 'AI did not select (score 0)',
            aiMarket: '-',
          },
        ),
      );
    }

    await Promise.all(updates);

    this.logger.log(
      `💾 Сохранено: ${scoreMap.size} оценённых, ${notReturned.length} пропущено (score=0)`,
    );
  }

  private formatDateTime(date: Date): string {
    const d = new Date(date);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  }


  /**
   * Глубокий анализ одного матча через DeepSeek Pro
   */
  async analyzeOneDeep(matchId: number): Promise<DeepAnalysisResult | null> {
    // 1. Загружаем матч
    const match = await this.repo.findOne({ where: { id: matchId } });
    if (!match) {
      this.logger.error(`Match ${matchId} not found`);
      return null;
    }

    if (match.deepAnalyzed) {
      this.logger.warn(`Match ${matchId} already deep-analyzed`);
      return match.deepAnalysis as DeepAnalysisResult;
    }

    // 2. Собираем MD
    // Вариант A: если `info` уже содержит готовый MD
    // Вариант B: генерируем из полей
    const md = match.info || this.buildMatchMd(match);

    if (!md || md.length < 100) {
      this.logger.warn(`Match ${matchId}: insufficient data for deep analysis`);
      await this.repo.update(matchId, {
        deepAnalyzed: true,
        finalDecision: 'ПРОПУСТИТЬ',
        deepReasoning: 'Недостаточно данных',
        deepAnalyzedAt: new Date(),
      });
      await this.stateService.deepDone(
        matchId,
        'ПРОПУСТИТЬ',
        this.toMatchInfo(match),
      );
      return null;
    }

    // 3. Отправляем в DeepSeek Pro
    this.logger.log(`🔍 Deep analysis for match ${matchId}...`);
    await this.stateService.deepStart(matchId);

    const userPrompt = `${md}

---

## ЗАДАЧА
Проанализируй матч и верни решение в формате JSON. 
ID матча: ${matchId}.
Ответь ТОЛЬКО JSON.`;

    let result: DeepAnalysisResult;
    try {
      result = await this.aiService.chatJson<DeepAnalysisResult>(
        [
          { role: 'system', content: DEEP_ANALYSIS_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        {
          model: 'deepseek-v4-flash',       // ← Pro для глубокого анализа
          temperature: 0.3,            // небольшая вариативность для reasoning
          maxTokens: 8192,             // ответ ~2000-3000 токенов
          thinking: false,              // ← thinking для сложного анализа
        },
      );
    } catch (err: any) {
      this.logger.error(`Deep analysis failed for ${matchId}: ${err.message}`);
      await this.stateService.fail(
        'deep',
        `Ошибка глубокого анализа матча #${matchId}: ${err.message}`,
      );
      throw err;
    }

    // 4. Сохраняем результат
    await this.saveDeepAnalysis(match, result);

    this.logger.log(
      `✅ Match ${matchId}: ${result.final_decision} (conf=${result.prediction?.confidence})`,
    );

    // Событие `match_analize_complete` в Redis/SSE с информацией о матче
    await this.stateService.deepDone(
      matchId,
      result.final_decision ?? null,
      this.toMatchInfo(match),
    );

    return result;
  }

  /**
   * Проверка ставки по финальному счёту матча через flash-модель.
   *
   * В AI передаются только два значения — ставка и результат матча,
   * поэтому запрос максимально дешёвый: без thinking, минимальный `maxTokens`,
   * `temperature = 0`.
   *
   * Результат (`true` — ставка сыграла, `false` — нет) записывается
   * в `matches.betStatus` и публикуется в Redis через `StateService`.
   *
   * @param matchId - ID матча
   * @param finalScore - финальный счёт из события (если нет — берётся из БД)
   */
  async analyzeOneScore(
    matchId: number,
    finalScore?: string | null,
  ): Promise<BetCheckResult | null> {
    // 1. Загружаем матч
    const match = await this.repo.findOne({ where: { id: matchId } });
    if (!match) {
      this.logger.error(`Match ${matchId} not found`);
      return null;
    }

    // 2. Нужна ставка из глубокого анализа — проверять нечего
    const bet = match.mainBet;
    if (!bet) {
      this.logger.warn(`Match ${matchId}: ставка не сформирована, проверка невозможна`);
      return null;
    }

    // 3. Разбираем финальный счёт: итог + таймы
    const scoreRaw = finalScore ?? match.finalScore;
    const parsedScore = parseFinalScore(scoreRaw);
    if (!parsedScore) {
      this.logger.warn(
        `Match ${matchId}: не удалось разобрать финальный счёт «${scoreRaw ?? '—'}»`,
      );
      return null;
    }

    this.logger.log(
      `🧮 Проверка ставки матча #${matchId}: «${bet}», счёт ${parsedScore.raw}`,
    );
    await this.stateService.betCheckStart(matchId);

    // 4. В промпт уходит только ставка и результат
    const periodsText = parsedScore.periods.length
      ? `, по таймам: ${parsedScore.periods.map(formatScorePair).join(', ')}`
      : '';
    const userPrompt = `Ставка: ${bet}
Финальный счёт: ${formatScorePair(parsedScore.total)}${periodsText}`;

    let won: boolean;
    try {
      const response = await this.aiService.chatJson<BetResultResponse>(
        [
          { role: 'system', content: BET_RESULT_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        {
          model: 'deepseek-flash', // самая дешёвая (flash) модель
          temperature: 0,          // детерминированный расчёт
          maxTokens: 32,           // ответ — один булев флаг
          thinking: false,         // без размышлений
          reasoningEffort: 'none', // минимальная стоимость
        },
      );

      if (typeof response?.won !== 'boolean') {
        throw new Error('AI provider: invalid bet result');
      }
      won = response.won;
    } catch (err: any) {
      this.logger.error(`Bet check failed for ${matchId}: ${err.message}`);
      await this.stateService.fail(
        'bet-check',
        `Ошибка проверки ставки #${matchId}: ${err.message}`,
      );
      throw err;
    }

    // 5. Сохраняем результат в БД
    await this.repo.update(matchId, { betStatus: won });

    this.logger.log(
      `✅ Match ${matchId}: ставка «${bet}» ${won ? 'сыграла' : 'не сыграла'}`,
    );

    // 6. Публикуем результат в Redis/SSE
    await this.stateService.betChecked(
      this.toMatchInfo(match),
      bet,
      won,
      parsedScore.raw,
    );

    return { matchId, bet, finalScore: parsedScore, won };
  }

  /**
   * Пакетный глубокий анализ всех selected матчей
   */
  async analyzeSelectedDeep(limit = 10): Promise<{
    processed: number;
    success: number;
    failed: number;
  }> {
    const matches = await this.repo.find({
      where: {
        selected: true,
        deepAnalyzed: false,
        score: IsNull(),
      },
      order: { aiScore: 'DESC', dateTime: 'ASC' },
      take: limit,
    });

    if (matches.length === 0) {
      this.logger.log('No matches for deep analysis');
      return { processed: 0, success: 0, failed: 0 };
    }

    this.logger.log(`🔍 Deep analysis for ${matches.length} matches`);

    let success = 0;
    let failed = 0;
    let processed = 0;

    for (const match of matches) {
      try {
        await this.analyzeOneDeep(match.id);
        success++;
      } catch (err: any) {
        failed++;
        this.logger.error(`Failed ${match.id}: ${err.message}`);
      }

      processed++;
      await this.stateService.analyzingProgress(processed, matches.length);

      // Пауза между запросами (rate limit)
      await new Promise((r) => setTimeout(r, 2000));
    }

    return { processed: matches.length, success, failed };
  }

  /**
   * Сохранение глубокого анализа в БД
   */
  private async saveDeepAnalysis(
    match: MatchEntity,
    result: DeepAnalysisResult,
  ): Promise<void> {
    const pred = result.prediction || ({} as any);
    const confidence = pred.confidence ?? null;
    const ev = this.parseExpectedValue(pred.expected_value);

    await this.repo.update(match.id, {
      // Флаг
      deepAnalyzed: true,
      deepAnalyzedAt: new Date(),

      // Основное решение
      finalDecision: result.final_decision || null,
      mainBet: pred.main_bet || null,
      betCoefficient: pred.coefficient != null ? String(pred.coefficient) : null,
      confidence: confidence != null ? String(confidence) : null,
      expectedValue: ev != null ? String(ev) : null,
      stakeRecommendation: pred.stake_recommendation || null,

      // Тексты
      deepReasoning: result.reasoning || null,
      summary: result.summary || null,

      // Полный JSON
      deepAnalysis: result as any,
    });
  }

  /**
   * Парсинг expected_value вида "+8.2%" → 8.2
   */
  private parseExpectedValue(ev: string | undefined): number | null {
    if (!ev) return null;
    const cleaned = ev.replace('%', '').replace('+', '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  /** Краткая информация о матче для событий состояния. */
  private toMatchInfo(match: MatchEntity): ServerStateMatchInfo {
    return {
      id: match.id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      league: match.league,
      url: match.url,
    };
  }

  /**
   * Базовый MD из полей матча (если нет готового info)
   */
  private buildMatchMd(match: MatchEntity): string {
    const lines = [
      `# ${match.homeTeam} vs ${match.awayTeam}`,
      ``,
      `**Страна:** ${match.country}`,
      `**Лига:** ${match.league}`,
      `**Дата:** ${this.formatDateTime(match.dateTime)}`,
      ``,
      `## Коэффициенты`,
      `- П1: ${match.oddsHome ?? '—'}`,
      `- X: ${match.oddsDraw ?? '—'}`,
      `- П2: ${match.oddsAway ?? '—'}`,
    ];

    if (match.info) {
      lines.push('', '## Дополнительная информация', match.info);
    }

    return lines.join('\n');
  }

}