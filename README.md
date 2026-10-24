# SoccerStat

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
