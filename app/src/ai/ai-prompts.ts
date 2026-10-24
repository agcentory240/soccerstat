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

export const DEEP_ANALYSIS_SYSTEM_PROMPT = `Ты — профессиональный аналитик футбольных ставок. 
Проанализируй матч на основе предоставленных данных и верни решение в формате JSON.

ВАЖНО:
1. Опирайся ТОЛЬКО на данные из MD. Не выдумывай.
2. Если данных недостаточно — ставь final_decision = "ПРОПУСТИТЬ".
3. confidence — честная уверенность (0.0-1.0), не завышай.
4. expected_value — рассчитай как (вероятность × коэф. - 1) × 100%.
5. risks — обязательно 2-3 контр-аргумента.

ФОРМАТ ОТВЕТА (только JSON, без markdown):
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
    "stake_recommendation": "<X% банка>"
  },
  "alternative_bets": [
    {
      "market": "<рынок>",
      "coefficient": <коэф>,
      "confidence": <0-1>,
      "reason": "<обоснование>"
    }
  ],
  "avoid": [
    {
      "market": "<рынок>",
      "reason": "<почему НЕ ставить>"
    }
  ],
  "reasoning": "<2-4 предложения>",
  "key_factors": ["<фактор 1>", "<фактор 2>"],
  "risks": ["<риск 1>", "<риск 2>"],
  "final_decision": "СТАВИТЬ" | "ПРОПУСТИТЬ" | "НАБЛЮДАТЬ",
  "summary": "<1-2 предложения>"
}`;