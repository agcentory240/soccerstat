import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { Observable, Subject } from 'rxjs';
import { REDIS_URL, STATE_CHANNEL } from './state.config.js';
import type { ServerStateEvent } from './state.types.js';

/**
 * Клиент Redis для pub/sub состояния.
 *
 * Redis не является критичной зависимостью: если он недоступен,
 * приложение продолжает работать, а состояние доставляется локальным подписчикам.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly stateSubject = new Subject<ServerStateEvent>();

  private publisher: Redis | null = null;
  private subscriber: Redis | null = null;
  private errorLogged = false;

  onModuleInit(): void {
    this.publisher = this.createClient('publisher', {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });

    this.subscriber = this.createClient('subscriber', {
      // Подписка выполняется до установки соединения и должна попасть в offline-очередь.
      enableOfflineQueue: true,
      maxRetriesPerRequest: null,
    });

    this.subscriber.on('message', (channel: string, payload: string) => {
      if (channel !== STATE_CHANNEL) return;
      this.stateSubject.next(this.parsePayload(payload));
    });

    this.subscriber
      .subscribe(STATE_CHANNEL)
      .catch((err: Error) =>
        this.logger.warn(`Не удалось подписаться на канал ${STATE_CHANNEL}: ${err.message}`),
      );
  }

  onModuleDestroy(): void {
    // disconnect() закрывает соединение сразу и не ждёт реконнекта,
    // в отличие от quit() при недоступном Redis.
    this.publisher?.disconnect();
    this.subscriber?.disconnect();
  }

  /** Поток состояний, полученных из Redis. */
  get state$(): Observable<ServerStateEvent> {
    return this.stateSubject.asObservable();
  }

  /**
   * Публикует состояние в Redis.
   * Если Redis недоступен — состояние отдаётся локальным подписчикам.
   */
  async publishState(event: ServerStateEvent): Promise<void> {
    if (this.publisher?.status !== 'ready') {
      this.stateSubject.next(event);
      return;
    }

    try {
      await this.publisher.publish(STATE_CHANNEL, JSON.stringify(event));
    } catch (err) {
      this.logger.warn(
        `Не удалось опубликовать состояние в Redis: ${(err as Error).message}`,
      );
      this.stateSubject.next(event);
    }
  }

  private createClient(
    role: 'publisher' | 'subscriber',
    options: { enableOfflineQueue: boolean; maxRetriesPerRequest: number | null },
  ): Redis {
    const client = new Redis(REDIS_URL, {
      ...options,
      retryStrategy: (times) => Math.min(times * 500, 5000),
    });

    client.on('ready', () => {
      this.errorLogged = false;
      this.logger.log(`Redis (${role}) подключён: ${REDIS_URL}`);
    });

    client.on('error', (err: Error) => {
      if (this.errorLogged) return;
      this.errorLogged = true;
      this.logger.warn(`Redis (${role}) недоступен: ${err.message}`);
    });

    return client;
  }

  private parsePayload(payload: string): ServerStateEvent {
    try {
      const parsed = JSON.parse(payload) as ServerStateEvent;
      if (parsed && parsed.type === 'state') return parsed;
    } catch {
      // ниже вернём состояние по умолчанию
    }

    return {
      type: 'state',
      status: 'idle',
      stage: null,
      message: 'Некорректное сообщение состояния',
      progress: null,
      updatedAt: new Date().toISOString(),
    };
  }
}
