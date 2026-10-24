// src/matches/matches-analyzer.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { MatchEntity } from './match.entity.js';
import { AiService } from '../ai/ai.service.js';
import {
  MATCH_FILTER_SYSTEM_PROMPT,
  MatchSelectionResult,
  DeepAnalysisResult,
  DEEP_ANALYSIS_SYSTEM_PROMPT,
} from '../ai/ai-prompts.js';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class MatchesAnalyzerService {
  private readonly logger = new Logger(MatchesAnalyzerService.name);
  private readonly BATCH_SIZE = 50;
  private readonly MIN_SCORE_THRESHOLD = 6;  // порог для selected
  private readonly TOP_N = 10;               // максимум выбранных

  constructor(
    @InjectRepository(MatchEntity)
    private readonly repo: Repository<MatchEntity>,
    private readonly aiService: AiService,
    @Inject('MATCHES_SERVICE') private readonly client: ClientProxy,
  ) { }

  async analyzeUnprocessed(): Promise<{ sent: number; selected: number }> {
    // 1. Берём матчи, которые ещё НЕ оценены ИИ
    const candidates = await this.repo.find({
      where: {
        aiScore: IsNull(),        // ← ключевое: нет оценки
        score: IsNull(),          // матч ещё не сыгран
      },
      order: { dateTime: 'ASC' },
      take: this.BATCH_SIZE,
    });

    if (candidates.length === 0) {
      this.logger.log('No matches to analyze');
      return { sent: 0, selected: 0 };
    }

    this.logger.log(`Sending ${candidates.length} matches to AI`);

    // 2. Компактный список для AI
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

    // 3. Отправляем в AI
    const userPrompt = `Оцени каждый матч по шкале 0-10. Верни JSON со всеми матчами.\n\n${JSON.stringify(compactList)}`;

    let result: MatchSelectionResult;
    try {
      result = await this.aiService.chatJson<MatchSelectionResult>(
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
    } catch (err: any) {
      this.logger.error(`AI request failed: ${err.message}`);
      throw err;
    }

    const scored = result?.matches ?? [];
    this.logger.log(`AI scored ${scored.length} of ${candidates.length}`);

    // 4. Сохраняем оценки для ВСЕХ матчей
    await this.saveScores(scored, candidates);

    // 5. Выбираем топ-N по score >= порога
    const topMatches = scored
      .filter((s) => s.score >= this.MIN_SCORE_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.TOP_N);

    this.logger.log(
      `📊 Топ-${topMatches.length} матчей (score >= ${this.MIN_SCORE_THRESHOLD})`,
    );

    // 6. Помечаем топ как selected
    if (topMatches.length > 0) {
      const topIds = topMatches.map((s) => s.id);
      await this.repo.update(
        { id: In(topIds) },
        { selected: true, marked: true },
      );
    }

    // 7. Помечаем остальные как marked (но не selected)
    const allIds = candidates.map((c) => c.id);
    const nonSelectedIds = allIds.filter(
      (id) => !topMatches.some((s) => s.id === id),
    );
    if (nonSelectedIds.length > 0) {
      await this.repo.update(
        { id: In(nonSelectedIds) },
        { marked: true, selected: false },
      );
    }

    // 8. Отправляем событие
    this.client.emit('matches.analyzed', {
      total: candidates.length,
      selected: topMatches.length,
      topIds: topMatches.map((s) => s.id),
    });

    return { sent: candidates.length, selected: topMatches.length };
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
      return null;
    }

    // 3. Отправляем в DeepSeek Pro
    this.logger.log(`🔍 Deep analysis for match ${matchId}...`);

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
          model: 'deepseek-v4-pro',       // ← Pro для глубокого анализа
          temperature: 0.3,            // небольшая вариативность для reasoning
          maxTokens: 16384,             // ответ ~2000-3000 токенов
          thinking: true,              // ← thinking для сложного анализа
        },
      );
    } catch (err: any) {
      this.logger.error(`Deep analysis failed for ${matchId}: ${err.message}`);
      throw err;
    }

    // 4. Сохраняем результат
    await this.saveDeepAnalysis(match, result);

    this.logger.log(
      `✅ Match ${matchId}: ${result.final_decision} (conf=${result.prediction?.confidence})`,
    );

    return result;
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

    for (const match of matches) {
      try {
        await this.analyzeOneDeep(match.id);
        success++;
      } catch (err: any) {
        failed++;
        this.logger.error(`Failed ${match.id}: ${err.message}`);
      }

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