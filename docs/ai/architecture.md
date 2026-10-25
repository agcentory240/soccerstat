# Архитектура SoccerStat

## 1. Общая схема

```text
nb-bet.com
   │  Playwright + JSDOM
   ▼
Парсер (NestJS, app/src/nb-bet-parser-main)
   │  upsert
   ▼
PostgreSQL (matches)
   │
   ├──► Быстрый AI-анализ (deepseek-flash) ──► aiScore, aiReason, aiMarket, selected
   │
   └──► Глубокий AI-анализ (deepseek-v4-pro) ──► deepAnalysis, finalDecision, mainBet, ...

RabbitMQ (matches_queue)
   ├── matches.parsed    → запуск быстрого AI-анализа
   ├── matches.analyzed  → парсинг деталей отобранных матчей
   └── match.parsed      → запуск глубокого AI-анализа

Состояние операций
NestJS StateService ──publish──► Redis (канал soccerstat:state)
                                      │  subscribe
                                      ▼
Frontend (React + Vite) ◄──SSE /events── NestJS API (:3000)
                              HTTP
```

## 2. Компоненты

### API (`app/`)

Один NestJS-процесс:

- HTTP-сервер на `PORT ?? 3000`, CORS включён;
- RabbitMQ-микросервис, очередь `matches_queue`, `noAck: false`;
- планировщик `@nestjs/schedule` подключён, но cron парсера закомментирован.

Модули:

| Модуль | Ответственность |
|---|---|
| `AiModule` | Обёртка над OpenAI SDK для DeepSeek, JSON-парсинг ответов |
| `MatchesModule` | Сущность, репозиторий, оценка и глубокий анализ |
| `NbBetParserMainModule` | Парсинг списка матчей и деталей, событийный оркестратор пайплайна (`MatchesPipelineController`) |
| `RabbitmqModule` | Клиент для публикации событий |
| `StateModule` | Состояние сервера: Redis pub/sub + SSE-поток для фронтенда |

### Frontend (`frontend/`)

- React 19 + Vite 8 + TypeScript;
- React Router: `/` → `/prognoses`, детали `/prognoses/:id`;
- Zustand-стор для списка матчей и состояния сервера;
- SSE-подписка на `GET /events` (EventSource), индикатор статуса в `TopMenu`;
- Tailwind CSS 4 (плагин Vite) + SCSS-модули компонентов;
- Markdown-рендеринг ответов AI (`react-markdown`).

### Инфраструктура

`docker-compose.yml`:

| Сервис | Порт | Назначение |
|---|---|---|
| `node-app` | 3000 | API |
| `postgres` | 5432 | PostgreSQL 17 |
| `pgadmin` | 5050 | Админка БД |
| `rabbitmq` | 5672 / 15672 | Очередь / Web UI |
| `redis` | 6379 | Pub/sub состояния (канал `soccerstat:state`) |
| `redis-insight` | 5540 | Веб-интерфейс Redis (Redis Insight) |

## 3. API-контракт

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/matches` | Матчи с `aiScore > 3`, сортировка по `dateTime ASC` |
| `GET` | `/matches/by-date?date=YYYY-MM-DD` | Матчи за дату |
| `GET` | `/matches/:id` | Полная сущность матча |
| `POST` | `/matches/analyze` | Оценить все неоценённые матчи (пачками по 50) |
| `GET` | `/matches/:id/deep` | Глубокий анализ одного матча |
| `GET` | `/parser/matches` | Спарсить список матчей |
| `GET` | `/parser/matches/:id` | Спарсить детали матча по `url` |
| `GET` | `/events` | SSE-поток состояния сервера (status/stage/message/progress) |

Ответы возвращают **сущность в camelCase**: `oddsHome`, `oddsDraw`, `oddsAway`, `aiScore`, `deepAnalysis` и т.д. Вложенного объекта `odds` в HTTP-ответах нет — он существует только во внутреннем DTO парсера.

## 4. Модель данных

Таблица `matches` (`MatchEntity`):

- Идентификация: `id`, `url` (уникальный индекс);
- Матч: `country`, `league`, `dateTime`, `homeTeam`, `awayTeam`, `score`, `liveTime`, `status`;
- Коэффициенты: `oddsHome`, `oddsDraw`, `oddsAway` (`decimal`);
- Состояния: `marked`, `ready`, `selected`;
- Быстрый анализ: `aiScore` (smallint), `aiReason`, `aiMarket`;
- Текстовые данные парсера: `info`, `reason`;
- Глубокий анализ: `deepAnalyzed`, `finalDecision`, `mainBet`, `betCoefficient`, `confidence`, `expectedValue`, `stakeRecommendation`, `deepReasoning`, `summary`, `deepAnalysis` (JSONB), `deepAnalyzedAt`;
- Результат матча: `finalScore` (строка `3:1 (2:0, 1:1)`), `betStatus` (сыграла ли ставка);
- Служебное: `createdAt`, `lastParsedAt` (когда матч последний раз встречался в выдаче парсера), `matchArchive`.

Статус матча `status` (`scheduled` | `live` | `finished`) заполняется парсером из типа матча nb-bet (`RawMatch['1']`) и не требует косвенных догадок по `score`/`liveTime`. Значение `scheduled` — матч ещё не начался, `live` — идёт сейчас, `finished` — завершён. Для матчей, пропавших из выдачи с «живой» минутой, `MatchesService.finishStaleLiveMatches()` переводит статус в `finished` и очищает `liveTime`, если `lastParsedAt` старше 3 часов.

Миграции: `app/src/migrations/`. `data-source.ts` содержит `synchronize: true` — учитывай это при работе с миграциями и не полагайся на автосинхронизацию в production.

## 5. Потоки данных

Пайплайн запускается одним действием пользователя (парсинг списка), дальше этапы
связываются событиями RabbitMQ; состояния публикуются в Redis и доходят до фронтенда по SSE.

### 1. Парсинг списка (`matches.parsed`)

1. `GET /parser/matches` → `NbBetParserMainService.parseMatches()`.
2. Playwright открывает `https://nb-bet.com/Results`, закрывает cookie-баннер.
3. HTML сохраняется в `app/debug/` и разбирается через JSDOM.
4. `MatchesService.saveMany()` делает upsert по `url`, проставляя `status` и `lastParsedAt`.
5. `MatchesService.finishStaleLiveMatches()` помечает завершёнными live-матчи, не встречавшиеся в выдаче дольше 3 часов.
6. В RabbitMQ публикуется `matches.parsed` (`{ count }`).
7. В Redis/SSE публикуется состояние `stage = 'parsed'` с `data.count`.

### 2. Быстрый AI-анализ (`matches.analyzed`)

1. `MatchesPipelineController.onMatchesParsed()` получает `matches.parsed`.
2. `MatchesAnalyzerService.analyzeUnprocessed()` берёт все матчи с `aiScore IS NULL` и `score IS NULL` и оценивает их пачками по 50 (`BATCH_SIZE`), пока выборка не опустеет.
3. `deepseek-flash` возвращает JSON `{ matches: [{ id, score, reason, market }] }`.
4. Оценки сохраняются; топ-10 с `score >= 6` получает `selected = true`.
5. В RabbitMQ публикуется `matches.analyzed` (`{ total, selected, topIds }`).
6. В Redis/SSE публикуется `stage = 'analyzed'` с `data.matches` — списком отобранных матчей.

### 3. Парсинг деталей (`match.parsed`)

1. `MatchesPipelineController.onMatchesAnalyzed()` получает `matches.analyzed`.
2. Для каждого `topId`: `NbBetParserDetailService.parseMatch()` собирает Markdown в `info`.
3. После сохранения `info` в RabbitMQ публикуется `match.parsed` (`{ matchId, match }`).
4. В Redis/SSE публикуется `stage = 'detail-parsed'` с `data.match`.
5. После обработки всех отобранных матчей публикуется `stage = 'all-done'` (`all_matches_analized`).

### 4. Глубокий анализ (`match_analize_complete`)

1. `MatchesPipelineController.onMatchParsed()` получает `match.parsed`.
2. `MatchesAnalyzerService.analyzeOneDeep(matchId)` собирает Markdown из `info`.
3. `deepseek-v4-pro` возвращает JSON-решение, результат сохраняется в поля сущности и `deepAnalysis`.
4. В Redis/SSE публикуется `stage = 'deep-done'` с `data.match` (включая `decision`).

> `POST /matches/analyze` и `GET /matches/:id/deep` остаются для ручного запуска соответствующих этапов.

### 5. Проверка ставки (`match.score_parsed`)

1. `NbBetParserDetailService.parseMatchScore()` извлекает финальный счёт, пишет `finalScore`
   и публикует `match.score_parsed` (`{ matchId, score }`).
2. `MatchesPipelineController.onMatchScoreParsed()` вызывает `MatchesAnalyzerService.analyzeOneScore()`.
3. `deepseek-flash` получает только ставку (`mainBet`) и результат и возвращает `{ "won": boolean }`.
4. Результат записывается в `matches.betStatus`.
5. В Redis/SSE публикуется `stage = 'bet-checked'` с `data.bet`, `data.betStatus`, `data.score`.

### Состояние сервера (Redis → SSE)

1. Парсер и анализатор вызывают методы `StateService` (`parsingStart`, `analyzingProgress`, `deepDone`, `fail` и т.д.).
2. `StateService.update()` формирует событие `{ type: 'state', status, stage, message, progress, updatedAt }` и публикует его в Redis-канал `soccerstat:state` (`RedisService.publishState`).
3. `RedisService` подписан на тот же канал и раздаёт события локальным RxJS-подписчикам.
4. `GET /events` (`StateController`, `@Sse()`) отправляет новому клиенту снапшот и далее все обновления; каждые 15 секунд — heartbeat.
5. Фронтенд (`EventSource`) обновляет индикатор в `TopMenu` и перезагружает список матчей после `status = done` на стадиях `parsed` / `analyzed`.

Если Redis недоступен, приложение продолжает работать: состояние отдаётся локальным подписчикам процесса API.

## 6. Конфигурация окружения

| Переменная | По умолчанию | Комментарий |
|---|---|---|
| `DB_HOST` | `postgres` (API), `localhost` (data-source) | В Docker — `postgres` |
| `DB_PORT` | `5432` | |
| `DB_USER` | `myuser` | |
| `DB_PASSWORD` | `mypassword` | |
| `DB_NAME` | `mydb` | |
| `AI_BASE_URL` | `https://api.deepseek.com` | |
| `AI_API_KEY` | — | Обязателен; только в `.env` |
| `AI_MODEL` | `deepseek-flash` | Модель по умолчанию |
| `RABBITMQ_URI` | `amqp://guest:guest@rabbitmq:5672` | |
| `REDIS_URL` | `redis://localhost:6379` | В Docker — `redis://redis:6379` |
| `PORT` | `3000` | |

API загружает `.env` самостоятельно через [`app/src/env.ts`](../app/src/env.ts), который импортируется первым в [`main.ts`](../app/src/main.ts) и [`data-source.ts`](../app/src/data-source.ts). Приоритет: `app/.env` → корневой `.env` → переменные окружения процесса (они не перезаписываются). Docker Compose дополнительно передаёт значения через `environment`, и они имеют наивысший приоритет.

## 7. Известные особенности

- В `matches-analyzer.service.ts` модели `deepseek-flash` и `deepseek-v4-pro` заданы явно, `AI_MODEL` влияет только на дефолт `AiService`.
- DeepSeek в thinking-режиме может вернуть пустой `content` и заполненный `reasoning_content`; `AiService` промоутит reasoning в content.
- `AiService.chatJson()` устойчив к markdown-обёртке, мусору и обрезанному JSON, но это не отменяет валидацию схемы на уровне сервисов.
- Парсер сохраняет HTML в `app/debug/` — каталог может разрастаться и исключён из git.
