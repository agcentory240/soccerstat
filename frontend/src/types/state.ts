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
  | 'detail-parsed'
  | 'deep'
  | 'deep-done'
  | 'all-done';

export interface ServerStateProgress {
  processed: number;
  total: number;
}

/** Краткая информация о матче в событиях состояния. */
export interface ServerStateMatchInfo {
  id: number;
  homeTeam: string;
  awayTeam: string;
  league: string;
  url: string;
  /** Финальное решение по матчу (только для `match_analize_complete`). */
  decision?: string | null;
}

/** Дополнительный payload события состояния. */
export interface ServerStateData {
  count?: number;
  total?: number;
  selected?: number;
  matches?: ServerStateMatchInfo[];
  match?: ServerStateMatchInfo;
}

export interface ServerStateEvent {
  type: 'state';
  status: ServerStateStatus;
  stage: ServerStateStage | null;
  message: string;
  progress: ServerStateProgress | null;
  updatedAt: string;
  /** Дополнительные данные события (список матчей, инфо о матче и т.п.). */
  data?: ServerStateData;
}

/** Служебный heartbeat, чтобы соединение не закрывалось прокси. */
export interface ServerStatePing {
  type: 'ping';
  updatedAt: string;
}

export type ServerStateMessage = ServerStateEvent | ServerStatePing;
