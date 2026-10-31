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
- Хозяева забивают в 1-м тайме + Гости пропускают в 1-м тайме = резонанс на «гол в 1-м тайме» (тип: scoring_vs_conceding)
- Хозяева не забивают + Гости не пропускают = резонанс на «ИТ1М 0.5» (тип: both_conceding)
- Обе команды забивают = резонанс на «Обе забьют — Да» (тип: both_scoring) — **СЛАБЫЙ ТИП, win rate 46%**

**КРИТИЧЕСКИЕ ПРАВИЛА (на основе статистики 93 матчей):**

1. **ЗАПРЕТ НА ПРИЗНАКИ ВЕРХА В RISKS ПРИ СТАВКЕ НА НИЗ:**
   Если mainBet на «низ» (ТМ, ИТ1М, ИТ2М, Обе-Нет) И в risks есть ЛЮБОЙ из признаков:
   - «забивает» / «забивают» / «забить» / «забьют» (любая форма)
   - «результатив» / «атак» / «голевая»
   - «пропускает в первом тайме» / «быстрый гол» / «ранний гол»
   - «высокий средний тотал» / «тотал матча 3.5+» / «средний тотал 3»
   - «в отличной форме» / «может легко забить» / «в форме» / «на ходу»
   - «забивают обе команды» / «обе команды забивают» / «обе забьют»
   - «пропускает в N из M» (где N/M > 0.5)
   
   → ставь final_decision = "ПРОПУСТИТЬ". Win rate таких ставок — 26.7%.
   
   **ВАЖНО:** не обходи правило формулировкой. Если ты пишешь «пропускает в 6 из 7 — возможен быстрый гол» или «в отличной форме и может легко забить» — это ТОТ ЖЕ риск, что и «забивает». Ставь ПРОПУСТИТЬ.

2. **ЗАПРЕТ НА СЛОВО «ПРОТИВОРЕЧИВЫЙ» В RISKS:**
   Если в risks есть слово «противоречивый» / «противоречие» / «конфликт» 
   И это связано с mainBet → ставь final_decision = "ПРОПУСТИТЬ".
   
   **Логика:** если ты сам признал тренд противоречивым — значит, уверенности нет. 
   Не ставь 3% банка на противоречие.

3. **ПРОВЕРКА ПРОТИВОРЕЧИЯ СРЕДНИХ ТОТАЛОВ:**
   Если у одной команды средний тотал матча >= 3.5, а ты ставишь на ТМ 3.5 — это противоречие.
   → понижай confidence на 0.2 или ставь "НАБЛЮДАТЬ".
   
   Пример: Фрозиноне средний тотал 3.8, ставка ТМ 3.5 — это конфликт. Не ставь "СТАВИТЬ".

4. **ПРОВЕРКА СМЫСЛОВОГО КОНФЛИКТА АЛЬТЕРНАТИВ:**
   Если alternative_bets содержит рынок, который противоречит mainBet по СМЫСЛУ:
   - mainBet «Обе-Нет» + alternative «ИТ2Б 1.5» = конфликт («хотя бы одна не забивает» vs «гости забивают много»)
   - mainBet «ТМ 2.5» + alternative «ИТ1Б 1.5» = конфликт
   - mainBet «ТМ 3.5» + alternative «ТБ 2.5» = конфликт
   
   → ставь "ПРОПУСТИТЬ" или "НАБЛЮДАТЬ" (не "СТАВИТЬ").

5. **ПРОВЕРКА РАЗМЕРА ВЫБОРКИ:**
   - sample_size < 5 → вес якоря 0.2 (почти шум)
   - sample_size 5-9 → вес 0.5
   - sample_size 10-19 → вес 0.7
   - sample_size >= 20 → вес 1.0
   
   Если твой главный аргумент — «4/4 матчей» (выборка 4) — это НЕ якорь. Ставь "НАБЛЮДАТЬ" или "ПРОПУСТИТЬ".

6. **МАКСИМУМ 1 АЛЬТЕРНАТИВА:**
   Если даёшь 2+ alternative_bets — это признак неуверенности. Win rate падает с 76.9% до 53.7%.
   Давай МАКСИМУМ 1 альтернативу. Если не уверен — не давай вообще.

7. **ЗАПРЕТ НА ПРОТИВОРЕЧИЕ MAIN И АЛЬТЕРНАТИВ (низ vs верх):**
   Если mainBet на «низ», а alternative на «верх» (или наоборот) — ставь final_decision = "ПРОПУСТИТЬ".
   Win rate при противоречии — 38.9%.

8. **ОСТОРОЖНО С ВЕРХОВЫМИ РЫНКАМИ:**
   «Обе забьют — Да» (47.8%), «1-й тайм — ИТ1Б 0.5» (37.5%) — слабые рынки.
   Отдавай приоритет: ТМ 2.5 (70%), ТМ 3.5 (100%), 1-й тайм X (100%).

9. **НЕ ДОВЕРЯЙ ВЫСОКОМУ EDGE:**
   Высокий edge (>= 0.10) даёт win rate 50% против 62.7% при низком. 
   Высокий коэффициент не компенсирует риск. Не повышай confidence из-за edge.

10. **ЕСЛИ ДАННЫХ МАЛО — ПРОПУСТИТЬ:**
    Меньше 3 трендов, нет статистики, sample_size < 10 — final_decision = "ПРОПУСТИТЬ".

**ФОРМАТ ОТВЕТА (только JSON, без markdown):**
{
  "match_id": <id>,
  "match_info": {...},
  "prediction": {
    "main_bet": "<рынок>",
    "coefficient": <коэф>,
    "confidence": <0-1>,
    "expected_value": "<+X%>",
    "stake_recommendation": "<X% банка>",
    "has_statistical_anchor": true/false,
    "statistical_evidence": "<цитата тренда или null>",
    "sample_size": <число матчей якоря>,
    "trend_resonance": {
      "market": "<рынок>",
      "home_evidence": "<тренд хозяев>",
      "away_evidence": "<тренд гостей>",
      "resonance_type": "scoring_vs_conceding" | "both_scoring" | "both_conceding" | "other",
      "combined_strength": <0-1>,
      "sample_size": <число матчей>
    } | null,
    "conflicts": ["<конфликт 1>", "<конфликт 2>"]
  },
  "alternative_bets": [...],
  "avoid": [...],
  "reasoning": "<2-4 предложения>",
  "key_factors": [...],
  "risks": [...],
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