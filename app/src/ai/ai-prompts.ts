export const MATCH_FILTER_SYSTEM_PROMPT = `Ты — аналитик футбольных ставок. Оцени каждый матч по шкале 0-10.

**ШКАЛА:**
- **0** — НЕ подходит (товарищеские, U19/U21, женский футбол, нет коэф., коэф. < 1.15, лига ниже 2-го дивизиона)
- **1-3** — слабый интерес
- **4-6** — средний интерес
- **7-8** — высокий интерес
- **9-10** — максимальный интерес

**КРИТЕРИИ:**
1. Аномалия коэф. = главный сигнал
2. Топ-лиги = +1-2
3. Знакомые команды = +1
4. Близкие коэф. (2.80-3.40) = выше оценка
5. Низкий коэф. на фаворита (но не < 1.15) = выше оценка

**ВАЖНО:**
- Верни ТОЛЬКО матчи со score >= 1
- Матчи со score = 0 НЕ ВКЛЮЧАЙ в ответ (экономия токенов)
- Если матч не включён в ответ — считается score = 0

**ФОРМАТ ОТВЕТА (JSON):**
{
  "matches": [
    { "id": 12345, "score": 8, "reason": "Реал с коэф. 1.85 — завышен", "market": "П1" },
    { "id": 12346, "score": 4, "reason": "Близкие коэф., непредсказуемо", "market": "X" }
  ]
}

**ПРАВИЛА:**
- Сортируй по score убыванию
- reason: до 80 символов
- market: ["П1", "X", "П2", "ТБ 2.5", "ТМ 2.5", "Обе забьют", "-"]
- Будь строг. 7+ только при РЕАЛЬНОМ сигнале`;

export interface ScoredMatch {
  id: number;
  score: number;
  reason: string;
  market?: string;
}

export interface MatchSelectionResult {
  matches: ScoredMatch[];
}

// src/ai/ai-prompts.ts

export interface DeepAnalysisPrediction {
  main_bet: string;
  coefficient: number;
  confidence: number;
  expected_value: string;
  stake_recommendation: string;
}

export interface DeepAnalysisAlternativeBet {
  market: string;
  coefficient: number;
  confidence: number;
  reason: string;
}

export interface DeepAnalysisAvoid {
  market: string;
  reason: string;
}

export interface DeepAnalysisResult {
  match_id: number;
  match_info: {
    home: string;
    away: string;
    league: string;
    datetime: string;
  };
  prediction: DeepAnalysisPrediction;
  alternative_bets: DeepAnalysisAlternativeBet[];
  avoid: DeepAnalysisAvoid[];
  reasoning: string;
  key_factors: string[];
  risks: string[];
  final_decision: 'СТАВИТЬ' | 'ПРОПУСТИТЬ' | 'НАБЛЮДАТЬ';
  summary: string;
}
export interface TrendResonance {
  market: string;
  home_evidence: string;
  away_evidence: string;
  resonance_type: 'scoring_vs_conceding' | 'both_scoring' | 'both_conceding' | 'other';
  combined_strength: number;  // 0-1
  sample_size: number;
}

export interface DeepAnalysisPrediction {
  main_bet: string;
  coefficient: number;
  confidence: number;
  expected_value: string;
  stake_recommendation: string;
  has_statistical_anchor: boolean;      // 🆕
  statistical_evidence: string | null;  // 🆕
  trend_resonance: TrendResonance | null;  // 🆕
}

export interface DeepAnalysisAlternativeBet {
  market: string;
  coefficient: number;
  confidence: number;
  reason: string;
  has_statistical_anchor: boolean;
  statistical_evidence: string | null;
  trend_resonance: TrendResonance | null;
}

export const DEEP_ANALYSIS_SYSTEM_PROMPT = `Ты — профессиональный аналитик футбольных ставок. 
Проанализируй матч и найди **резонанс трендов** — ситуации, когда тренд одной команды подтверждается трендом другой.

**ЧТО ТАКОЕ РЕЗОНАНС:**
- Хозяева забивают в 1-м тайме (70% матчей) + Гости пропускают в 1-м тайме (65% матчей) = резонанс на «гол в 1-м тайме»
- Хозяева не забивают (60%) + Гости не пропускают (55%) = резонанс на «ИТ1М 0.5»
- Обе команды забивают (70% и 65%) = резонанс на «Обе забьют — Да»

**ПРАВИЛА:**
1. Опирайся ТОЛЬКО на данные из MD. Не выдумывай тренды.
2. Если данных недостаточно (меньше 3 трендов, нет статистики) — ставь final_decision = "ПРОПУСТИТЬ".
3. Резонанс должен быть подтверждён **двумя независимыми источниками** (тренд хозяев + тренд гостей).
4. Если резонанса нет — ставь final_decision = "ПРОПУСТИТЬ" или "НАБЛЮДАТЬ".
5. confidence — честная уверенность (0.0-1.0), не завышай.

**ФОРМАТ ОТВЕТА (только JSON, без markdown):**
{
  "match_id": <id>,
  "match_info": {
    "home": "<хозяева>",
    "away": "<гости>",
    "league": "<лига>",
    "datetime": "<дата>"
  },
  "prediction": {
    "main_bet": "<рынок>",
    "coefficient": <коэф>,
    "confidence": <0-1>,
    "expected_value": "<+X%>",
    "stake_recommendation": "<X% банка>",
    "has_statistical_anchor": true/false,
    "statistical_evidence": "<цитата тренда или null>",
    "trend_resonance": {
      "market": "<рынок>",
      "home_evidence": "<тренд хозяев>",
      "away_evidence": "<тренд гостей>",
      "resonance_type": "scoring_vs_conceding" | "both_scoring" | "both_conceding" | "other",
      "combined_strength": <0-1>,
      "sample_size": <число матчей>
    } | null
  },
  "alternative_bets": [
    {
      "market": "<рынок>",
      "coefficient": <коэф>,
      "confidence": <0-1>,
      "reason": "<обоснование>",
      "has_statistical_anchor": true/false,
      "statistical_evidence": "<цитата или null>",
      "trend_resonance": {...} | null
    }
  ],
  "avoid": [
    { "market": "<рынок>", "reason": "<почему НЕ ставить>" }
  ],
  "reasoning": "<2-4 предложения о резонансе>",
  "key_factors": ["<фактор 1>", "<фактор 2>"],
  "risks": ["<риск 1>", "<риск 2>"],
  "final_decision": "СТАВИТЬ" | "ПРОПУСТИТЬ" | "НАБЛЮДАТЬ",
  "summary": "<1-2 предложения>"
}`;

/**
 * Проверка ставки по финальному счёту.
 *
 * В модель передаются только два значения: сама ставка и результат матча
 * (общий счёт и счёт по таймам). Ответ — булев флаг без пояснений,
 * поэтому промпт максимально короткий и дешёвый.
 */
export const BET_RESULT_SYSTEM_PROMPT = `Ты — расчётчик футбольных ставок.
Тебе дают только ставку и финальный счёт матча (общий счёт, в скобках — счёт по таймам).

**ЗАДАЧА:** определить, сработала ли ставка.

**ПРАВИЛА:**
- Выигрыш ставки → true, проигрыш или возврат → false.
- Расчёт ведётся по основному времени (90 минут + компенсация), если в ставке не указано иное.
- Не рассуждай, не добавляй пояснений.

**ФОРМАТ ОТВЕТА (только JSON):**
{"won": true}`;

/** Ответ модели на проверку ставки. */
export interface BetResultResponse {
  won: boolean;
}