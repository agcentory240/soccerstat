# Backend (NestJS) — инструкции

## 1. Точки входа

- `app/src/main.ts` — создаёт Nest-приложение, подключает RabbitMQ-микросервис, включает CORS, слушает `PORT ?? 3000`.
- `app/src/app.module.ts` — корневой модуль: `ScheduleModule`, `RabbitmqModule`, `StateModule`, `AiModule.register()`, `TypeOrmModule.forRoot()`, парсер и матчи.
- `app/src/data-source.ts` — DataSource для TypeORM CLI (миграции).

## 2. Соглашения кода

- Проект ESM (`"type": "module"`), `module: nodenext`. **Все относительные импорты — с расширением `.js`**, даже если файл `.ts`:

```ts
import { MatchesService } from './matches.service.js';
```

- TypeScript strict, но `strictPropertyInitialization: false` (поля сущностей без инициализаторов).
- Логирование — через `Logger` NestJS, не `console.log` (кроме существующих отладочных мест парсера).
- Пользовательские тексты ошибок и комментарии — на русском.
- Форматирование — Prettier (`app/.prettierrc`), запуск `npm run format`.

## 3. Модули и сервисы

### `MatchesModule`

`MatchesService`:

- `saveMany(matches)` — bulk upsert по `url`, обновляет страну, лигу, дату, команды, счёт, live-время и коэффициенты;
- `findScored()` — `aiScore > minScore` (`minScore = 3`);
- `findPrognozedScored()` — матчи с готовым прогнозом и допуском к ставке: `selected = true`, `deepAnalyzed = true`, `finalDecision = 'СТАВИТЬ'`, `mainBet IS NOT NULL`, `deepAnalysis IS NOT NULL`; статус матча не учитывается (завершённые, live и предстоящие), сортировка `aiScore DESC`, `dateTime ASC`;
- `findOneWithPendingBet()` — **один** матч с невыясненным результатом ставки: `mainBet IS NOT NULL`, `finalScore IS NOT NULL`, `betStatus IS NULL`; сортировка `dateTime ASC`. Используется cron-задачей проверки ставки;
- `findByDate(date)` — сравнение `DATE("dateTime")`;
- `findOne(id)` / `findOneDto(id)`;
- `updateFields(id, fields)` — частичное обновление `info`, `reason`, `selected`, `marked`, `ready`;
- приватные `toEntity`, `toMatchDto`, `parseDateTime`, `formatDateTime` — даты хранятся в UTC.

`MatchesAnalyzerService`:

- `BATCH_SIZE = 50` — размер пачки в одном запросе к AI, `MAX_BATCHES = 40` — предохранитель от бесконечного цикла, `UPDATE_CHUNK_SIZE = 500` — чанк для bulk-update, `MIN_SCORE_THRESHOLD = 6`, `TOP_N = 10`;
- `analyzeUnprocessed()` — оценивает **все** неоценённые матчи пачками по `BATCH_SIZE` (цикл до опустошения выборки), сохраняет `aiScore`/`aiReason`/`aiMarket`, затем глобально выбирает топ-N и выставляет `selected`/`marked`;
- `analyzeOneDeep(id)` — глубокий анализ, пропускает уже обработанные матчи;
- `buildMatchMd()` — Markdown из полей, если `info` пуст;
- `saveDeepAnalysis()` — раскладывает JSON в колонки + `deepAnalysis`.

### `AiModule`

- Динамический модуль: `AiModule.register(config?)`, провайдер `AI_CONFIG`, экспортирует `AiService`.
- `AiService.chat()` — обёртка OpenAI SDK; передаёт `thinking` и `reasoning_effort` в теле запроса.
- `AiService.chatJson<T>()` — извлекает JSON: снимает markdown-обёртку, убирает BOM, пробует `JSON.parse`, ищет `{...}`, восстанавливает обрезанные скобки.
- Ошибки `402/429/401` преобразуются в понятные сообщения.

**Не дублируй** создание клиента OpenAI в других сервисах — используй `AiService`.

### `NbBetParserMainModule`

- `NbBetParserMainService.parseMatches()` — Playwright (`playwright-extra` + stealth), `https://nb-bet.com/Results`, сохранение HTML в `app/debug/`, JSDOM, `parseMatchesFromDocument`, upsert, событие `matches.parsed`.
- `NbBetParserDetailService.parseMatch(match)` — открывает `match.url`, последовательно кликает вкладки («Мотивация», «Прогнозы», «Сводная», «Между собой») и собирает Markdown в `info` через хелперы `helpers/extract-*.ts`.
- `NbBetParserDetailService.parseMatchScore(match)` — открывает `match.url`, сначала проверяет перенос/отмену (`extractMatchResolution`) и при обнаружении пишет `status = 'postponed' | 'canceled'` без разбора счёта; иначе извлекает финальный счёт (`extractFinalScore`), пишет `finalScore` + `status = 'finished'`, эмитит `match.score_parsed` и публикует `StateService.finalScoreParsed()`.
- `NbBetParserDetailService.checkPendingBet()` — `@Cron('0 */2 * * * *')`: раз в 2 минуты берёт один матч из `findOneWithPendingBet()` и вызывает `parseMatchScore()`. Флаг `pendingBetRunning` не даёт тикам наложиться. Цепочка: `match.score_parsed` → `MatchesAnalyzerService.analyzeOneScore()` → `betStatus` + `match_bet_checked`.
- `helpers/extract-match-resolution.ts` — `extractMatchResolution(doc)` возвращает `'postponed' | 'canceled' | null` по прямому тексту «Перенесён»/«Перенесен»/«Отменён» (и английским вариантам) в карточке матча. Счёт таких матчей (`0:0`) не считается финальным.
- Хелперы должны оставаться «чистыми»: принимают `Document` и возвращают типизированные данные, без побочных эффектов.

Селекторы `nb-bet.com` хрупкие. При изменении вёрстки:
1. сохрани свежий HTML в `app/debug/`;
2. обнови только нужный `extract-*` хелпер;
3. добавь/обнови unit-тест на фрагменте HTML, если это возможно.

### `RabbitmqModule`

- Очередь `matches_queue`, `durable: true`.
- Клиент `MATCHES_SERVICE` инжектится как `@Inject('MATCHES_SERVICE')`.
- Исходящие события: `matches.parsed`, `matches.analyzed`, `match.parsed`, `match.score_parsed`.
- Обработчики событий — `MatchesPipelineController` (`app/src/nb-bet-parser-main/matches-pipeline.controller.ts`):
  - `matches.parsed` → `MatchesAnalyzerService.analyzeUnprocessed()`;
  - `matches.analyzed` → `NbBetParserDetailService.parseMatch()` для каждого `topId`, затем `StateService.allDone()`;
  - `match.parsed` → `MatchesAnalyzerService.analyzeOneDeep()`;
  - `match.score_parsed` → `MatchesAnalyzerService.analyzeOneScore()` — проверка, сыграла ли ставка, запись `betStatus`.
- Обработчики ловят ошибки и не пробрасывают их (только логируют), чтобы сообщение подтверждалось при `noAck: false`.

### `StateModule`

Файлы — `app/src/state/`.

- `state.config.ts` — `REDIS_URL` (по умолчанию `redis://localhost:6379`) и канал `STATE_CHANNEL = 'soccerstat:state'`.
- `state.types.ts` — контракт `ServerStateEvent` (`type`, `status`, `stage`, `message`, `progress`, `data`, `updatedAt`). Стадии: `parsing`, `parsed`, `analyzing`, `analyzed`, `detail-parsed`, `deep`, `deep-done`, `all-done`. Поле `data` (`ServerStateData`) несёт `count`, `total`, `selected`, список отобранных `matches` и инфо о конкретном `match`. При изменении синхронизируй `frontend/src/types/state.ts`.
- `RedisService` — publisher и subscriber `ioredis`. Redis **не критичен**: при недоступности состояние доставляется локальным подписчикам, приложение не падает. `onModuleInit` не бросает исключений, ошибки только логируются.
- `StateService` — единственная точка публикации: `parsingStart/Done`, `analyzingStart/Progress/Done`, `detailParsed`, `deepStart/Done`, `allDone`, `fail`, базовый `update(patch)`. Инжектится в `NbBetParserMainService`, `NbBetParserDetailService`, `MatchesAnalyzerService` и `MatchesPipelineController`.
- `StateController` — `@Sse()` на `GET /events`: первым сообщением снапшот, далее обновления и heartbeat каждые 15 с.

Правило: не публикуй состояние напрямую в Redis из сервисов — используй `StateService`, чтобы формат события оставался единым.

## 4. База данных и миграции

- Сущность: `app/src/matches/match.entity.ts`.
- Миграции: `app/src/migrations/*.ts`.
- Команды — только из корня: `npm run migrate:show|migrate:run|migrate:create`.
- `data-source.ts` использует `synchronize: true`. Это удобно локально, но опасно для production. Не добавляй новые поля только через `synchronize`, создавай миграцию.
- Не изменяй уже применённые миграции — создавай новую.

## 5. Добавление endpoint

1. Метод в соответствующем контроллере (`matches.controller.ts`, `nb-bet-parser-main.controller.ts`).
2. Бизнес-логика — в сервисе, не в контроллере.
3. DTO/интерфейс — рядом с сущностью или в `*.interface.ts`.
4. Обнови `frontend/src/types/match.ts` и API-функции, если контракт виден фронтенду.
5. Обнови `docs/ai/architecture.md` (таблица endpoint'ов).

## 6. Тесты и проверки

```bash
npm test               # unit, Vitest
npm run test:e2e       # e2e, vitest.config.e2e.ts
npm run lint           # oxlint --type-aware
npm run build:api      # nest build
```

Тесты лежат в `app/src/**/*.spec.ts` и `app/test/`. Для новых сервисов добавляй unit-тесты с моками репозитория и `AiService`.

## 7. Частые ошибки

| Симптом | Причина / решение |
|---|---|
| `ECONNREFUSED postgres:5432` при локальном запуске | `DB_HOST` по умолчанию `postgres`; задай `DB_HOST=localhost` в `app/.env` (он перекрывает корневой `.env`) |
| `OpenAIError: Missing credentials` | Не задан `AI_API_KEY`: заполни его в `app/.env` или корневом `.env` — загрузчик [`env.ts`](../app/src/env.ts) подхватит файл автоматически |
| `EACCES: permission denied, rmdir app/dist/...` | `dist` создан Docker-контейнером от root; останови контейнер и удали каталог из контейнера/с хоста с правами |
| `EBADENGINE` | NestJS CLI 12 требует Node 22+; обнови Node |
| `Redis недоступен` в логах | Подними контейнер `redis` (`docker compose up -d redis`) или задай `REDIS_URL`; API продолжит работать без реалтайм-состояния |
| Пустой ответ AI | DeepSeek вернул `reasoning_content`; `AiService` уже обрабатывает это |
| Ошибка JSON от AI | Проверь `maxTokens`, `finish_reason=length`, схему ответа |
| Парсер не находит элементы | Изменилась вёрстка nb-bet; обнови `helpers/extract-*.ts` |

## 8. Безопасность

- `AI_API_KEY` читается только из окружения. Не логируй ключ и не коммить `.env`.
- Не отключай CORS «навсегда» и не добавляй wildcard-и в production без необходимости.
- Не выполняй пользовательский ввод в Playwright-селекторах без валидации.
