import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { interval, map, merge, Observable, of } from 'rxjs';
import { StateService } from './state.service.js';

/** Интервал heartbeat, чтобы прокси не закрывали простаивающее SSE-соединение. */
const HEARTBEAT_MS = 15_000;

@Controller('events')
export class StateController {
  constructor(private readonly stateService: StateService) {}

  /**
   * SSE-поток состояния сервера: `GET /events`.
   * Первым сообщением уходит текущий снапшот, далее — обновления из Redis.
   */
  @Sse()
  stream(): Observable<MessageEvent> {
    const snapshot = of<MessageEvent>({ data: this.stateService.snapshot });

    const updates = this.stateService.events$.pipe(
      map((event) => ({ data: event }) as MessageEvent),
    );

    const heartbeat = interval(HEARTBEAT_MS).pipe(
      map(
        () =>
          ({
            data: { type: 'ping', updatedAt: new Date().toISOString() },
          }) as MessageEvent,
      ),
    );

    return merge(snapshot, updates, heartbeat);
  }
}
