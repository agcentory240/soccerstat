// frontend/src/types/state.ts

/**
 * Состояние сервера, которое рассылается через SSE (`GET /events`).
 * Синхронизировано с `app/src/state/state.types.ts`.
 */
export type ServerStateStatus = 'idle' | 'parsing' | 'analyzing' | 'done' | 'error';

export type ServerStateStage =
  | 'parsing'
  | 'parsed'
  | 'analyzing'
  | 'analyzed'
  | 'deep'
  | 'deep-done';

export interface ServerStateProgress {
  processed: number;
  total: number;
}

export interface ServerStateEvent {
  type: 'state';
  status: ServerStateStatus;
  stage: ServerStateStage | null;
  message: string;
  progress: ServerStateProgress | null;
  updatedAt: string;
}

/** Служебный heartbeat, чтобы соединение не закрывалось прокси. */
export interface ServerStatePing {
  type: 'ping';
  updatedAt: string;
}

export type ServerStateMessage = ServerStateEvent | ServerStatePing;
