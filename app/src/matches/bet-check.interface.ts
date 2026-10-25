/**
 * Сущности и интерфейсы проверки ставки по финальному счёту матча.
 *
 * Источник данных — поле `MatchEntity.finalScore`, которое парсер деталей
 * записывает в виде `3:1 (2:0, 1:1)`:
 * - до скобок — итоговый счёт матча;
 * - в скобках — счёт по таймам (может отсутствовать).
 */

/** Пара голов: хозяева — гости. */
export interface ScorePair {
  home: number;
  away: number;
}

/** Разобранный финальный счёт матча. */
export interface ParsedFinalScore {
  /** Итоговый счёт матча. */
  total: ScorePair;
  /** Счёт по таймам (пустой массив, если в источнике его нет). */
  periods: ScorePair[];
  /** Исходная строка из `finalScore`. */
  raw: string;
}

/** Входные данные для AI-проверки ставки (только ставка и результат). */
export interface BetCheckInput {
  /** Проверяемая ставка, например `ТМ (2.5)`. */
  bet: string;
  /** Разобранный финальный счёт. */
  finalScore: ParsedFinalScore;
}

/** Результат проверки ставки. */
export interface BetCheckResult {
  matchId: number;
  bet: string;
  finalScore: ParsedFinalScore;
  /** `true` — ставка сыграла, `false` — не сыграла (проигрыш или возврат). */
  won: boolean;
}
