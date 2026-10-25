// frontend/src/types/match.ts

/**
 * Статус матча (ответ от API).
 * - `scheduled` — матч ещё не начался;
 * - `live` — матч идёт прямо сейчас;
 * - `finished` — матч завершён.
 */
export type MatchStatus = 'scheduled' | 'live' | 'finished';

/**
 * Основная сущность матча (ответ от API)
 */
export interface Match {
  id: number;
  country: string;
  league: string;
  url: string;
  dateTime: string;
  homeTeam: string;
  awayTeam: string;
  score: string | null;
  liveTime: string | null;
  /** Явный статус матча из парсера */
  status: MatchStatus;
  /** Когда матч последний раз встречался в выдаче парсера */
  lastParsedAt: string | null;
  oddsHome: string | null;
  oddsDraw: string | null;
  oddsAway: string | null;
  marked: boolean;
  selected: boolean;
  reason: string | null;
  aiReason: string | null;
  aiScore: number | null;
  aiMarket: string | null;        // 🆕 рынок от flash-модели
  info: string | null;
  finalScore?: string | null;

  // ===== 🆕 ГЛУБОКИЙ АНАЛИЗ (DeepSeek Pro) =====
  deepAnalyzed: boolean;
  deepAnalyzedAt: string | null;
  finalDecision: FinalDecision | null;
  mainBet: string | null;
  betCoefficient: string | null;
  confidence: string | null;
  expectedValue: string | null;
  stakeRecommendation: string | null;
  deepReasoning: string | null;
  summary: string | null;
  deepAnalysis: DeepAnalysis | null;

  createdAt: string;

  /** `true` — ставка сыграла, `false` — нет, `null` — проверка ещё не выполнялась. */
  betStatus: boolean | null;
  matchArchive: boolean;
}

/**
 * Финальное решение от Pro-модели
 */
export type FinalDecision = 'СТАВИТЬ' | 'ПРОПУСТИТЬ' | 'НАБЛЮДАТЬ';

/**
 * Основная ставка
 */
export interface DeepAnalysisPrediction {
  main_bet: string;
  coefficient: number;
  confidence: number;          // 0-1
  expected_value: string;      // "+8.2%"
  stake_recommendation: string;
}

/**
 * Альтернативная ставка
 */
export interface DeepAnalysisAlternativeBet {
  market: string;
  coefficient: number;
  confidence: number;
  reason: string;
}

/**
 * Ставка, которую стоит избегать
 */
export interface DeepAnalysisAvoid {
  market: string;
  reason: string;
}

/**
 * Информация о матче внутри анализа
 */
export interface DeepAnalysisMatchInfo {
  home: string;
  away: string;
  league: string;
  datetime: string;
}

/**
 * Полный ответ от DeepSeek Pro
 */
export interface DeepAnalysis {
  match_id: number;
  match_info?: DeepAnalysisMatchInfo;
  prediction: DeepAnalysisPrediction;
  alternative_bets?: DeepAnalysisAlternativeBet[];
  avoid?: DeepAnalysisAvoid[];
  reasoning: string;
  key_factors?: string[];
  risks?: string[];
  final_decision: FinalDecision;
  summary: string;
}