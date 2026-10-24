export interface MatchOdds {
  home: string | null;
  draw: string | null;
  away: string | null;
}

export interface Match {
  country: string;
  league: string;
  url: string;
  dateTime: string;
  homeTeam: string;
  awayTeam: string;
  score: string | null;
  liveTime: string | null;
  odds: MatchOdds;
  marked?: boolean;
  ready?: boolean;
  selected?: boolean;
  info?: string | null;
  reason?: string | null;
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