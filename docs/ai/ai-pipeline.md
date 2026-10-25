# AI-пайплайн — инструкции

## 1. Этапы анализа

| Этап | Сервис | Модель | Режим | Результат |
|---|---|---|---|---|
| Быстрая оценка | `MatchesAnalyzerService.analyzeUnprocessed()` | `deepseek-flash` | `thinking: false` | `aiScore`, `aiReason`, `aiMarket`, `selected` |
| Глубокий разбор | `MatchesAnalyzerService.analyzeOneDeep()` | `deepseek-v4-pro` | `thinking: true` | `deepAnalysis` + поля решения |
| Проверка ставки | `MatchesAnalyzerService.analyzeOneScore()` | `deepseek-flash` | `thinking: false` | `betStatus` |

Промпты и интерфейсы ответов — `app/src/ai/ai-prompts.ts`.
Вызовы и сохранение — `app/src/matches/matches-analyzer.service.ts`.
Транспорт и JSON-парсинг — `app/src/ai/ai.service.ts`.

Запуск этапов — событийный (`app/src/nb-bet-parser-main/matches-pipeline.controller.ts`):
`matches.parsed` → `analyzeUnprocessed()`, далее `matches.analyzed` → парсинг деталей,
`match.parsed` → `analyzeOneDeep()`. HTTP-эндпоинты `POST /matches/analyze` и
`GET /matches/:id/deep` остаются для ручного запуска этапов.

## 2. Быстрая оценка

Вход: **все** матчи с `aiScore IS NULL` и `score IS NULL`. Они отправляются в AI пачками по 50 (`BATCH_SIZE`), цикл продолжается, пока выборка не опустеет (предохранитель `MAX_BATCHES = 40`). Топ-N выбирается глобально по всем оценкам.

Компактный формат: `id`, `c` (country), `l` (league), `dt`, `h`, `a`, `o` (коэффициенты), `i` (info).

Промпт требует:

- оценку 0–10;
- возвращать только матчи со `score >= 1` (экономия токенов);
- отсутствие матча в ответе трактуется как `score = 0`;
- JSON: `{ "matches": [{ "id", "score", "reason", "market" }] }`;
- `reason` до 80 символов, `market` из фиксированного списка.

Параметры запроса: `temperature: 0.1`, `maxTokens: 8192`.

Пороги:

- `MIN_SCORE_THRESHOLD = 6` — попадание в `selected`;
- `TOP_N = 10` — максимум выбранных;
- `findScored()` на API отдаёт `aiScore > 3`.

При изменении шкалы или порогов обнови:
1. `MATCH_FILTER_SYSTEM_PROMPT`;
2. константы в `MatchesAnalyzerService`;
3. этот документ;
4. при необходимости UI-подписи.

## 3. Глубокий анализ

Вход: Markdown `info`, собранный парсером деталей (или `buildMatchMd`).

Если данных меньше 100 символов, матч помечается `deepAnalyzed = true`, `finalDecision = 'ПРОПУСТИТЬ'`, без вызова AI.

Промпт требует:

- опираться только на переданные данные;
- при нехватке данных — `ПРОПУСТИТЬ`;
- честный `confidence` 0–1;
- `expected_value = (вероятность × коэф. - 1) × 100%`;
- 2–3 риска;
- ответ — только JSON без markdown.

Схема ответа (`DeepAnalysisResult`):

```json
{
  "match_id": 123,
  "match_info": { "home": "...", "away": "...", "league": "...", "datetime": "..." },
  "prediction": {
    "main_bet": "...",
    "coefficient": 1.85,
    "confidence": 0.72,
    "expected_value": "+8.2%",
    "stake_recommendation": "2-3% банка"
  },
  "alternative_bets": [
    { "market": "...", "coefficient": 2.1, "confidence": 0.6, "reason": "..." }
  ],
  "avoid": [{ "market": "...", "reason": "..." }],
  "reasoning": "...",
  "key_factors": ["..."],
  "risks": ["..."],
  "final_decision": "СТАВИТЬ",
  "summary": "..."
}
```

Параметры: `temperature: 0.3`, `maxTokens: 16384`, `thinking: true`.

Сохранение (`saveDeepAnalysis`):

- `deepAnalysis` — полный JSON;
- `finalDecision`, `mainBet`, `betCoefficient`, `confidence`, `expectedValue`, `stakeRecommendation`, `deepReasoning`, `summary`;
- `deepAnalyzed = true`, `deepAnalyzedAt = now`.

## 3.1. Проверка ставки по финальному счёту

Запуск: событие RabbitMQ `match.score_parsed` (`{ matchId, score }`) →
`MatchesPipelineController.onMatchScoreParsed()` → `analyzeOneScore(matchId, score)`.

Вход:

- `mainBet` — ставка из глубокого анализа (если её нет, проверка пропускается);
- `finalScore` — финальный счёт вида `3:1 (2:0, 1:1)`: итоговый счёт и счёт по таймам
  в скобках. Разбирается хелпером `parseFinalScore()` в
  [`parse-final-score.ts`](../../app/src/nb-bet-parser-main/helpers/parse-final-score.ts),
  сущности — [`bet-check.interface.ts`](../../app/src/matches/bet-check.interface.ts).

Промпт `BET_RESULT_SYSTEM_PROMPT` требует только JSON `{ "won": true | false }`:

- выигрыш → `true`;
- проигрыш или возврат → `false`;
- расчёт по основному времени, если в ставке не указано иное.

В модель уходят **только ставка и результат** — никаких дополнительных данных.
Параметры запроса (максимально экономные): `model: 'deepseek-flash'`, `temperature: 0`,
`maxTokens: 32`, `thinking: false`, `reasoningEffort: 'none'`.

Сохранение и публикация:

- `matches.betStatus` — `true` / `false`;
- Redis/SSE — `stage = 'bet-checked'` с `data.match`, `data.bet`, `data.betStatus`, `data.score`;
- при ошибке AI — `StateService.fail('bet-check', …)`.

## 4. Особенности DeepSeek

- В thinking-режиме `content` может быть пустым, а ответ — в `reasoning_content`. `AiService` подставляет reasoning вместо content и логирует предупреждение.
- При `finish_reason = 'length'` ответ обрезан: увеличь `maxTokens` или сократи промпт/вход.
- `chatJson` умеет:
  - снимать ```` ```json ````-обёртку;
  - удалять BOM/zero-width;
  - извлекать объект регуляркой;
  - восстанавливать обрезанные скобки.
- Восстановленный JSON может быть неполным. Сервис обязан валидировать обязательные поля и не сохранять мусор.

## 5. Правила изменения промптов

1. Прочитай этот документ и `ai-prompts.ts` целиком.
2. Меняй только один промпт за раз, чтобы понимать причину изменения качества.
3. Сохраняй требование «только JSON» и фиксированные значения `final_decision`.
4. Проверь, что пример в промпте соответствует TypeScript-интерфейсу.
5. Обнови интерфейсы и `frontend/src/types/match.ts`, если меняется схема.
6. Проверь сценарии:
   - нормальный ответ;
   - пустой ответ;
   - ответ в markdown;
   - обрезанный JSON;
   - нехватка данных.
7. Зафиксируй в описании изменения, что именно и зачем изменено.

## 6. Безопасность и стоимость

- Не отправляй в AI секреты, ключи, персональные данные.
- Следи за размером пачки (50 матчей) и `maxTokens` — это прямые затраты; суммарный объём оцениваемых матчей ограничен только `MAX_BATCHES`.
- Не увеличивай `TOP_N`/батч без необходимости.
- Логируй только метаданные (модель, токены, finish_reason), не полные ответы с чувствительными данными.
