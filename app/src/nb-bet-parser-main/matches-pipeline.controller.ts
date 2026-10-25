import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { MatchesAnalyzerService } from '../matches/matches-analyzer.service.js';
import { MatchesService } from '../matches/matches.service.js';
import { NbBetParserDetailService } from './nb-bet-parser-detail.service.js';
import { StateService } from '../state/state.service.js';

/**
 * Оркестратор событийного пайплайна:
 * парсинг списка → быстрый AI-анализ → парсинг деталей → глубокий AI-анализ.
 *
 * Входящие события RabbitMQ (`matches_queue`):
 * - `matches.parsed`   — список матчей спарсен, запускаем быстрый AI-анализ;
 * - `matches.analyzed` — быстрый AI-анализ завершён, парсим детали отобранных матчей;
 * - `match.parsed`     — детали матча спарсены, запускаем глубокий анализ.
 *
 * Состояния для фронтенда публикуются через `StateService` в Redis-канал
 * `soccerstat:state` и раздаются по SSE `GET /events`.
 */
@Controller()
export class MatchesPipelineController {
  private readonly logger = new Logger(MatchesPipelineController.name);

  constructor(
    private readonly analyzer: MatchesAnalyzerService,
    private readonly matchesService: MatchesService,
    private readonly parserDetailService: NbBetParserDetailService,
    private readonly stateService: StateService,
  ) {}

  /**
   * После парсинга списка запускаем быстрый AI-анализ (`analyzeUnprocessed`).
   * Метод сам эмитит `matches.analyzed` и публикует `matches_analized` в Redis.
   */
  @EventPattern('matches.parsed')
  async onMatchesParsed(@Payload() data: { count?: number }): Promise<void> {
    this.logger.log(
      `Получено matches.parsed: спарсено ${data?.count ?? '?'} матчей — запускаю AI-анализ`,
    );

    try {
      const result = await this.analyzer.analyzeUnprocessed();
      this.logger.log(
        `AI-анализ завершён: оценено ${result.sent}, отобрано ${result.selected}`,
      );
    } catch (err) {
      this.logger.error(
        `Ошибка AI-анализа по matches.parsed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * После быстрого анализа парсим детали каждого отобранного матча.
   * `parseMatch` сам эмитит `match.parsed` и публикует `match_parsed` в Redis.
   * После цикла публикуем `all_matches_analized`.
   */
  @EventPattern('matches.analyzed')
  async onMatchesAnalyzed(
    @Payload() data: { total?: number; selected?: number; topIds?: number[] },
  ): Promise<void> {
    const topIds = data?.topIds ?? [];
    this.logger.log(
      `Получено matches.analyzed: оценено ${data?.total ?? '?'}, ` +
        `отобрано ${topIds.length} — парсю детали`,
    );

    for (const id of topIds) {
      try {
        const match = await this.matchesService.findOne(id);
        if (!match) {
          this.logger.warn(`Матч #${id} не найден, пропускаю`);
          continue;
        }
        await this.parserDetailService.parseMatch(match);
      } catch (err) {
        this.logger.error(
          `Ошибка парсинга деталей матча #${id}: ${(err as Error).message}`,
        );
      }
    }

    // Все отобранные матчи спарсены → состояние `all_matches_analized`
    await this.stateService.allDone(topIds.length);
    this.logger.log(`Все отобранные матчи спарсены: ${topIds.length}`);
  }

  /**
   * После парсинга деталей матча запускаем глубокий AI-анализ.
   * `analyzeOneDeep` публикует `match_analize_complete` в Redis.
   */
  @EventPattern('match.parsed')
  async onMatchParsed(@Payload() data: { matchId?: number }): Promise<void> {
    const matchId = data?.matchId;
    if (!matchId) {
      this.logger.warn('Получено match.parsed без matchId, пропускаю');
      return;
    }

    this.logger.log(
      `Получено match.parsed для матча #${matchId} — запускаю глубокий анализ`,
    );

    try {
      await this.analyzer.analyzeOneDeep(matchId);
    } catch (err) {
      this.logger.error(
        `Ошибка глубокого анализа матча #${matchId}: ${(err as Error).message}`,
      );
    }
  }

  

  /**
   * После парсинга финального счёта проверяем, сыграла ли ставка.
   * `analyzeOneScore` пишет результат в `betStatus` и публикует
   * `match_bet_checked` в Redis.
   */
  @EventPattern('match.score_parsed')
  async onMatchScoreParsed(
    @Payload() data: { matchId?: number; score?: string },
  ): Promise<void> {
    const matchId = data?.matchId;
    if (!matchId) {
      this.logger.warn('Получено match.score_parsed без matchId, пропускаю');
      return;
    }

    this.logger.log(
      `Получено match.score_parsed для матча #${matchId} — запускаю анализ ставки`,
    );

    try {
      const result = await this.analyzer.analyzeOneScore(matchId, data?.score);
      if (result) {
        this.logger.log(
          `Ставка «${result.bet}» матча #${matchId}: ` +
            `${result.won ? 'сыграла' : 'не сыграла'}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Ошибка анализа ставки матча #${matchId}: ${(err as Error).message}`,
      );
    }
  }
}
