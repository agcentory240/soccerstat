import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RedisService } from './redis.service.js';
import type { ServerStateEvent, ServerStatePatch, ServerStateStage } from './state.types.js';

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
    });
  }

  async parsingDone(count: number): Promise<void> {
    await this.update({
      status: 'done',
      stage: 'parsed',
      message: `Спарсено матчей: ${count}`,
      progress: null,
    });
  }

  async analyzingStart(total: number): Promise<void> {
    await this.update({
      status: 'analyzing',
      stage: 'analyzing',
      message: `AI-анализ ${total} матчей…`,
      progress: { processed: 0, total },
    });
  }

  async analyzingProgress(processed: number, total: number): Promise<void> {
    await this.update({
      status: 'analyzing',
      stage: 'analyzing',
      message: `AI-анализ: ${processed} из ${total}`,
      progress: { processed, total },
    });
  }

  async analyzingDone(total: number, selected: number): Promise<void> {
    await this.update({
      status: 'done',
      stage: 'analyzed',
      message: `Оценено матчей: ${total}, отобрано: ${selected}`,
      progress: { processed: total, total },
    });
  }

  async deepStart(matchId: number): Promise<void> {
    await this.update({
      status: 'analyzing',
      stage: 'deep',
      message: `Глубокий анализ матча #${matchId}…`,
      progress: null,
    });
  }

  async deepDone(matchId: number, decision: string | null): Promise<void> {
    await this.update({
      status: 'done',
      stage: 'deep-done',
      message: `Матч #${matchId}: ${decision ?? 'решение не получено'}`,
      progress: null,
    });
  }

  async fail(stage: ServerStateStage, message: string): Promise<void> {
    await this.update({
      status: 'error',
      stage,
      message,
      progress: null,
    });
  }
}
