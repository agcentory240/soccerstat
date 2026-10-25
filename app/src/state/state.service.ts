import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RedisService } from './redis.service.js';
import type {
  ServerStateEvent,
  ServerStateMatchInfo,
  ServerStatePatch,
  ServerStateStage,
} from './state.types.js';

/**
 * Единая точка публикации состояния сервера.
 * Состояние уходит в Redis (pub/sub) и оттуда — в SSE-подписчиков.
 */
@Injectable()
export class StateService {
  private current: ServerStateEvent = {
    type: 'state',
    status: 'idle',
    stage: null,
    message: 'Сервер готов',
    progress: null,
    updatedAt: new Date().toISOString(),
  };

  constructor(private readonly redis: RedisService) {}

  /** Актуальное состояние — отдаётся новому SSE-клиенту сразу при подключении. */
  get snapshot(): ServerStateEvent {
    return this.current;
  }

  /** Поток обновлений состояния. */
  get events$(): Observable<ServerStateEvent> {
    return this.redis.state$;
  }

  async update(patch: ServerStatePatch): Promise<ServerStateEvent> {
    const next: ServerStateEvent = {
      ...this.current,
      ...patch,
      type: 'state',
      updatedAt: new Date().toISOString(),
    };

    this.current = next;
    await this.redis.publishState(next);
    return next;
  }

  async parsingStart(): Promise<void> {
    await this.update({
      status: 'parsing',
      stage: 'parsing',
      message: 'Парсинг списка матчей…',
      progress: null,
      data: undefined,
    });
  }

  /** Событие `matches_parsed`: список матчей спарсен и сохранён в БД. */
  async parsingDone(count: number): Promise<void> {
    await this.update({
      status: 'done',
      stage: 'parsed',
      message: `Спарсено матчей: ${count}`,
      progress: null,
      data: { count },
    });
  }

  async analyzingStart(total: number): Promise<void> {
    await this.update({
      status: 'analyzing',
      stage: 'analyzing',
      message: `AI-анализ ${total} матчей…`,
      progress: { processed: 0, total },
      data: undefined,
    });
  }

  async analyzingProgress(processed: number, total: number): Promise<void> {
    await this.update({
      status: 'analyzing',
      stage: 'analyzing',
      message: `AI-анализ: ${processed} из ${total}`,
      progress: { processed, total },
      data: undefined,
    });
  }

  /**
   * Событие `matches_analized`: быстрый AI-анализ завершён.
   * В `data.matches` передаётся список отобранных для глубокого анализа матчей.
   */
  async analyzingDone(
    total: number,
    selected: number,
    matches?: ServerStateMatchInfo[],
  ): Promise<void> {
    await this.update({
      status: 'done',
      stage: 'analyzed',
      message: `Оценено матчей: ${total}, отобрано: ${selected}`,
      progress: { processed: total, total },
      data: { total, selected, matches },
    });
  }

  /** Событие `match_parsed`: детальная информация по матчу спарсена. */
  async detailParsed(match: ServerStateMatchInfo): Promise<void> {
    await this.update({
      status: 'done',
      stage: 'detail-parsed',
      message: `Спарсен матч #${match.id}: ${match.homeTeam} — ${match.awayTeam}`,
      progress: null,
      data: { match },
    });
  }

  async deepStart(matchId: number): Promise<void> {
    await this.update({
      status: 'analyzing',
      stage: 'deep',
      message: `Глубокий анализ матча #${matchId}…`,
      progress: null,
      data: undefined,
    });
  }

  /**
   * Событие `match_analize_complete`: глубокий анализ матча завершён,
   * результат записан в БД.
   */
  async deepDone(
    matchId: number,
    decision: string | null,
    match?: ServerStateMatchInfo,
  ): Promise<void> {
    await this.update({
      status: 'done',
      stage: 'deep-done',
      message: `Матч #${matchId}: ${decision ?? 'решение не получено'}`,
      progress: null,
      data: match ? { match: { ...match, decision } } : undefined,
    });
  }

  /** Событие `all_matches_analized`: все отобранные матчи спарсены и проанализированы. */
  async allDone(selected: number): Promise<void> {
    await this.update({
      status: 'done',
      stage: 'all-done',
      message: `Обработаны все отобранные матчи: ${selected}`,
      progress: null,
      data: { selected },
    });
  }  
  
  async finalScoreParsed(match: ServerStateMatchInfo, score: string): Promise<void> {
    await this.update({
      status: 'done',
      stage: 'score-parsed',
      message: `Получен финальный счет матча #${match.id}: ${match.homeTeam} — ${match.awayTeam} ${score}`,
      progress: null,
      data: { match, score },
    });
  }

  async fail(stage: ServerStateStage, message: string): Promise<void> {
    await this.update({
      status: 'error',
      stage,
      message,
      progress: null,
      data: undefined,
    });
  }
}
