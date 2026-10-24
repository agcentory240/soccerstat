# Разработка и git-процесс

## 1. Требования

- Node.js **22 LTS** (на 20 сборка работает, но NestJS CLI 12 выдаёт `EBADENGINE`).
- npm **10+**.
- Docker и Docker Compose — для инфраструктуры.
- Для парсера нужен Chromium, устанавливаемый Playwright.

## 2. Установка

Только из корня:

```bash
npm install
```

Не запускай `npm install` внутри `app/` и `frontend/` — это создаст конкурирующие `node_modules` и lock-файлы. Единый lock-файл — `/package-lock.json`.

## 3. Окружение

API загружает `.env` автоматически — вручную экспортировать переменные не нужно.

```bash
cp .env.example .env          # общий файл проекта (адреса Docker-сервисов)
cp app/.env.example app/.env  # локальный override для запуска без Docker
```

Заполни минимум `AI_API_KEY`. Оба файла (`.env` и `app/.env`) исключены из git.

Порядок загрузки задаёт [`app/src/env.ts`](../app/src/env.ts):

1. `app/.env` — локальные переопределения (приоритет выше);
2. `<корень репозитория>/.env` — общий файл.

Уже заданные переменные окружения процесса (например, из `docker-compose.yml`) не перезаписываются. Загрузчик подключается первым импортом в [`app/src/main.ts`](../app/src/main.ts) и [`app/src/data-source.ts`](../app/src/data-source.ts), поэтому `ai.config.ts` и `state.config.ts` видят значения на этапе импорта.

Варианты запуска:

### A. Локально

```bash
# API + frontend
npm run dev

# отдельно
npm run dev:api
npm run dev:web
```

Для локального API нужны PostgreSQL, RabbitMQ и Redis (можно поднять только их через `docker compose up -d postgres rabbitmq redis`). В `app/.env` должны быть адреса `localhost` (`DB_HOST=localhost`, `RABBITMQ_URI=…@localhost:5672`, `REDIS_URL=redis://localhost:6379`) — в корневом `.env` указаны имена Docker-сервисов. Redis не обязателен для запуска: без него API работает, но состояние операций не транслируется на фронтенд.

### B. Docker Compose

```bash
npm run docker:up
npm run docker:logs
npm run docker:down
```

Docker Compose читает `.env` из корня. `AI_API_KEY` обязателен — compose завершится с ошибкой, если он не задан.

Веб-панели при запуске через Docker Compose: pgAdmin — `http://localhost:5050`, RabbitMQ Management — `http://localhost:15672`, Redis Insight — `http://localhost:5540`. Эти же ссылки собраны в выпадающем меню фронтенда «Сервис».

### C. MCP-сервер для PostgreSQL

Для прямого доступа ИИ-клиента (VS Code, Cursor, Claude Desktop) к базе используется `.mcp.json` в корне репозитория:

```bash
cp .mcp.json.example .mcp.json
```

Замените `<DB_USER>`, `<DB_PASSWORD>`, `<DB_PORT>` и `<DB_NAME>` на значения из `.env`. Для стандартного Docker Compose это `postgresql://myuser:mypassword@localhost:5432/mydb`.

- `.mcp.json` исключён из git — в нём пароль БД; в репозитории хранится только `.mcp.json.example`.
- Подключение идёт к `localhost:5432` (проброшенный порт контейнера `postgres`), а не к хосту `postgres` из Docker-сети.
- Используется `@modelcontextprotocol/server-postgres` (read-only SQL-запросы). Пакет помечен как deprecated, но рабочий; при необходимости его можно заменить на поддерживаемую альтернативу.

## 4. Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | `concurrently`: API watch + Vite |
| `npm run dev:api` / `dev:web` | По отдельности |
| `npm run build` | Сборка обоих пакетов |
| `npm run build:api` / `build:web` | По отдельности |
| `npm run lint` | oxlint + ESLint по всем workspace |
| `npm test` | Unit-тесты API |
| `npm run test:watch` / `test:cov` | Vitest watch / coverage |
| `npm run test:e2e` | E2E API |
| `npm run format` | Prettier для API |
| `npm run migrate:show` / `migrate:run` / `migrate:create` | TypeORM CLI |
| `npm run docker:up` / `docker:down` / `docker:logs` | Compose |

## 5. Git-процесс

Репозиторий один — `soccerstat`. Вложенных git-репозиториев в `app/` и `frontend/` быть не должно.

- Основная ветка: `main`.
- Ветки: `feature/<краткое-имя>`, `fix/<краткое-имя>`, `docs/<краткое-имя>`.
- Коммиты — осмысленные, в императиве, на русском или английском, но единообразно в рамках PR. Пример: `feat: добавить фильтр матчей по дате`.
- Не коммить секреты, `.env`, `node_modules/`, `dist/`, `app/debug/`, `coverage/`, `*.tsbuildinfo`.
- Не переписывай историю (`rebase`, `reset --hard`) в общей ветке без согласования.

Публикация нового репозитория:

```bash
git remote add origin git@github.com:<username>/soccerstat.git
git push -u origin main
```

## 6. Чек-лист перед коммитом

```bash
npm run lint
npm run build
npm test          # если затронуты сервисы/парсер/анализ
```

Дополнительно:

- [ ] контракт API и `frontend/src/types/match.ts` согласованы;
- [ ] новые миграции не ломают существующие;
- [ ] секреты не попали в diff;
- [ ] документация в `docs/ai/` обновлена, если изменились архитектура/команды/контракты;
- [ ] в `app/debug/` не добавлены файлы в git.

## 7. Troubleshooting

| Проблема | Решение |
|---|---|
| `EBADENGINE` | Обнови Node до 22 LTS |
| `ECONNREFUSED postgres:5432` | Задай `DB_HOST=localhost` или запусти контейнер `postgres` |
| `EACCES: permission denied, app/dist` | `dist` создан root-контейнером; останови контейнер и удали каталог с правами root |
| `Не запускается frontend` | Проверь `npm install` из корня и наличие `frontend/node_modules` или корневого `node_modules` |
| `Redis (publisher) недоступен` | Подними `redis` (`docker compose up -d redis`) или задай `REDIS_URL`; индикатор на фронтенде покажет «Нет связи с сервером» |
| `Playwright: Executable doesn't exist` | `npx playwright install chromium` |
| `AI provider: invalid API key` | Проверь `AI_API_KEY` в `.env` |
| `AI provider: insufficient balance` | Пополни баланс провайдера |
| Пустой список матчей | `GET /matches` отдаёт только `aiScore > 3`; запусти `POST /matches/analyze` |

## 8. Definition of Done

- Задача реализована минимальными изменениями и соответствует архитектуре.
- `npm run lint` и `npm run build` проходят.
- Тесты добавлены/обновлены при изменении логики.
- Документация обновлена.
- В ответе пользователю перечислены изменённые файлы, проверки и риски — на русском языке.
