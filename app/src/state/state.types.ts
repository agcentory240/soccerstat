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
  | 'detail-parsed'
  | 'deep'
  | 'deep-done'
  | 'score-parsed'
  | 'all-done';

export interface ServerStateProgress {
  processed: number;
  total: number;
}

/**
 * Краткая информация о матче, которая транслируется на фронтенд
 * в событиях `match_parsed` и `match_analize_complete`.
 */
export interface ServerStateMatchInfo {
  id: number;
  homeTeam: string;
  awayTeam: string;
  league: string;
  url: string;
  /** Финальное решение по матчу (только для `match_analize_complete`). */
  decision?: string | null;
}

/**
 * Дополнительный payload события состояния.
 * Используется для передачи количества спарсенных матчей,
 * списка отобранных матчей и информации о конкретном матче.
 */
export interface ServerStateData {
  /** Количество спарсенных матчей (`matches_parsed`). */
  count?: number;
  /** Всего оценённых матчей (`matches_analyzed`). */
  total?: number;
  /** Количество отобранных матчей (`matches_analyzed` / `all_matches_analized`). */
  selected?: number;
  /** Список отобранных для глубокого анализа матчей (`matches_analyzed`). */
  matches?: ServerStateMatchInfo[];
  /** Информация о конкретном матче (`match_parsed` / `match_analize_complete`). */
  match?: ServerStateMatchInfo;
  /** финальный счет. */
  score?: string;
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

/** Частичное обновление состояния — поля, которые не переданы, сохраняются. */
export type ServerStatePatch = Partial<Omit<ServerStateEvent, 'type' | 'updatedAt'>>;
