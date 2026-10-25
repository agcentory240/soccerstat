export interface MatchOdds {
  home: string | null;
  draw: string | null;
  away: string | null;
}

/**
 * Статус матча по данным nb-bet.
 * - `scheduled` — матч ещё не начался (тип `1` в исходных данных);
 * - `live` — матч идёт прямо сейчас (тип `2`);
 * - `finished` — матч завершён (тип `3`).
 */
export type MatchStatus = 'scheduled' | 'live' | 'finished';

export interface Match {
  country: string;
  league: string;
  url: string;
  dateTime: string;
  homeTeam: string;
  awayTeam: string;
  score: string | null;
  liveTime: string | null;
  /** Явный статус матча (заменяет косвенные догадки по `score`/`liveTime`). */
  status: MatchStatus;
  odds: MatchOdds;
  marked?: boolean;
  ready?: boolean;
  selected?: boolean;
  info?: string | null;
  reason?: string | null;
  betStatus?: boolean;
  matchArchive?: boolean;
}

/**
 * Детальная информация о матче.
 * Все поля — в формате Markdown.
 */
export interface MatchDetails {

  match: Match;

  /** Обоснование прогноза (обязательно) */
  reason: string;

  /** Рекомендации по ставкам (опционально) */
  recomendations?: string;

  /** Описание матча, контекст (опционально) */
  description?: string;

  /** Дополнительная информация (опционально) */
  info?: string;
}