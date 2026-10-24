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

```bash
cp .env.example .env
```

Заполни минимум `AI_API_KEY`. `.env` исключён из git.

Варианты запуска:

### A. Локально

```bash
# API + frontend
npm run dev

# отдельно
DB_HOST=localhost npm run dev:api
npm run dev:web
```

Для локального API нужна доступная PostgreSQL (можно поднять только её через `docker compose up -d postgres rabbitmq`). Без `DB_HOST=localhost` API попытается подключиться к хосту `postgres`.

### B. Docker Compose

```bash
npm run docker:up
npm run docker:logs
npm run docker:down
```

Docker Compose читает `.env` из корня. `AI_API_KEY` обязателен — compose завершится с ошибкой, если он не задан.

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
