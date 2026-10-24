/**
 * Контракт состояния сервера, которое транслируется на фронтенд через SSE.
 * Синхронизирован с `frontend/src/types/state.ts`.
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

/** Частичное обновление состояния — поля, которые не переданы, сохраняются. */
export type ServerStatePatch = Partial<Omit<ServerStateEvent, 'type' | 'updatedAt'>>;
