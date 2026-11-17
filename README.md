# SoccerStat
SoccerStat — AI-аналитика футбольных матчей: парсинг матчей, хранение в PostgreSQL и AI-разбор (быстрая оценка + глубокий анализ). Личный проект, сделанный, чтобы на практике освоить NestJS, очереди, Redis и работу с LLM-агентами.

**Что внутри:**
- Монорепо: NestJS API + React 19 SPA, общий `package.json` (npm workspaces).
- Асинхронный парсинг через RabbitMQ, кэш и pub/sub на Redis, SSE-стрим состояния сервера.
- AI-пайплайн на OpenAI SDK (DeepSeek): быстрая оценка пачки матчей и глубокий разбор по запросу.
- Документация для ИИ-агентов: `AGENTS.md`, `CLAUDE.md`, `docs/ai/*`, MCP-конфиг.

**Чем горжусь:**
- Спроектировал и собрал монорепо с нуля: API, фронтенд, очереди, Redis, Docker Compose.
- Выстроил работу с ИИ-агентами: правила в `AGENTS.md`, архитектура в `docs/ai/*`, MCP-конфиг — агент не «фантазирует», а работает по контексту.
- SSE-стриминг состояния через Redis pub/sub — сервер отдаёт события в реальном времени без поллинга.

**Как проверяю качество:**
- Unit/E2E-тесты API (`npm test`, `npm run test:e2e`).
- Миграции TypeORM с контролем схемы (`migrate:show`, `migrate:run`).
- Ручная проверка AI-ответов: сверка с исходными данными матча, отбраковка «галлюцинаций», повторный прогон на тех же данных.
- Линтеры (oxlint + ESLint) и сборка (`npm run build`) в чек-листе перед коммитом.
- 
Монорепозиторий SoccerStat: парсинг футбольных матчей с `nb-bet.com`, хранение в PostgreSQL и AI-анализ (быстрая оценка + глубокий разбор).

## Стек

- **API:** NestJS 12, TypeORM, PostgreSQL 17, RabbitMQ, Redis, Playwright + JSDOM, OpenAI SDK (DeepSeek).
- **Frontend:** React 19, Vite 8, TypeScript, Zustand, React Router, Tailwind CSS 4.
- **Инфраструктура:** Docker Compose (PostgreSQL, pgAdmin, RabbitMQ, Redis, API).

## Структура

```text
soccerstat/
├── app/                  # @soccerstat/api — NestJS backend
├── frontend/             # @soccerstat/frontend — React SPA
├── docs/ai/              # инструкции для ИИ-агентов
├── docker-compose.yml
├── package.json          # npm workspaces: app + frontend
└── AGENTS.md             # главные правила для агентов
```

## Быстрый старт

```bash
cp .env.example .env      # заполнить AI_API_KEY
npm install               # один lock-файл и общие node_modules
npm run dev               # API :3000 + frontend :5173
```

Для локального API без Docker задайте `DB_HOST=localhost` (или запустите `docker compose up -d postgres rabbitmq redis`).

### Docker Compose

```bash
npm run docker:up         # требует AI_API_KEY в .env
npm run docker:logs
npm run docker:down
```

- API: http://localhost:3000
- Frontend: http://localhost:5173
- pgAdmin: http://localhost:5050
- RabbitMQ UI: http://localhost:15672
- Redis: `localhost:6379`
- Redis Insight: http://localhost:5540

## Команды

| Команда | Действие |
|---|---|
| `npm run dev` | API и фронтенд одновременно |
| `npm run dev:api` / `npm run dev:web` | По отдельности |
| `npm run build` | Сборка API и фронтенда |
| `npm run lint` | oxlint + ESLint |
| `npm test` | Unit-тесты API |
| `npm run test:e2e` | E2E-тесты API |
| `npm run migrate:show` / `migrate:run` / `migrate:create` | TypeORM-миграции |
| `npm run docker:up` / `docker:down` / `docker:logs` | Docker Compose |

## API

| Метод | Путь | Назначение |
|---|---|---|
| `GET` | `/matches` | Матчи с `aiScore > 3` |
| `GET` | `/matches/by-date?date=YYYY-MM-DD` | Матчи за дату |
| `GET` | `/matches/:id` | Детали матча |
| `POST` | `/matches/analyze` | Быстрая AI-оценка пачки |
| `GET` | `/matches/:id/deep` | Глубокий AI-анализ |
| `GET` | `/parser/matches` | Парсинг списка матчей |
| `GET` | `/parser/matches/:id` | Парсинг деталей матча |
| `GET` | `/events` | SSE-поток состояния сервера (Redis pub/sub) |

## Документация

- [`AGENTS.md`](AGENTS.md) — правила работы ИИ-агентов (обязательный язык рассуждений — русский).
- [`docs/ai/architecture.md`](docs/ai/architecture.md) — архитектура и потоки данных.
- [`docs/ai/backend.md`](docs/ai/backend.md) — backend.
- [`docs/ai/frontend.md`](docs/ai/frontend.md) — frontend.
- [`docs/ai/ai-pipeline.md`](docs/ai/ai-pipeline.md) — промпты и AI-анализ.
- [`docs/ai/development.md`](docs/ai/development.md) — команды, git, окружение.

## Публикация

```bash
git remote add origin git@github.com:<username>/soccerstat.git
git push -u origin main
```

Секреты хранятся только в `.env` (исключён из git). Перед публикацией убедитесь, что `git status` не содержит `.env`, `node_modules/`, `dist/` и `app/debug/`.
