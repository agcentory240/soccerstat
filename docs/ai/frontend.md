# Frontend (React) — инструкции

## 1. Стек и структура

- React 19, TypeScript 6, Vite 8.
- React Router 7, Zustand 5, `react-markdown`.
- Tailwind CSS 4 через `@tailwindcss/vite`; часть компонентов использует SCSS-модули.

```text
frontend/src/
├── api/           # HTTP-клиент (matches.ts) и SSE-подписка (events.ts)
├── components/    # Layout, MatchCard, MatchList, MatchDetails, Markdown, TopMenu, RedisLogPanel
├── hooks/         # useMatch
├── pages/         # MatchesPage
├── store/         # useMatchesStore (Zustand)
├── types/         # match.ts — контракт API, state.ts — состояние сервера
├── utils/         # error.ts — извлечение сообщения из unknown
└── App.tsx        # роутинг
```

## 2. Роутинг

`App.tsx`:

- `/` → редирект на `/prognoses`;
- `/prognoses` → `MatchesPage` со списком;
- `/prognoses/:id` → `MatchDetails` внутри `Outlet`;
- без `id` показывается `MatchDetailsPlaceholder`.

Новые страницы добавляй как вложенные route внутри `Layout`, сохраняя двухпанельную компоновку.

## 3. Состояние (Zustand)

`useMatchesStore`:

- `matches`, `loading`, `refreshing`, `error`;
- `serverState`, `eventsConnected` — состояние сервера из SSE и статус соединения;
- `eventLogs` — журнал событий Redis (`ServerStateLogEntry[]`, кольцевой буфер на 300 записей), пополняется при каждом SSE-событии;
- `loadMatches()` — `GET /matches`, сортировка (selected сверху, затем по дате), лимит 500;
- `refreshAll()` — парсинг списка → повторная загрузка. AI-анализ и парсинг деталей запускаются на бэкенде автоматически по цепочке событий RabbitMQ, вызывать `analyzeMatches()` вручную не нужно;
- `connectEvents()` — открывает `EventSource` на `GET /events`, возвращает функцию отписки. Повторный вызов не создаёт новое соединение. При `status = done` на стадиях `parsed` / `analyzed` автоматически вызывает `loadMatches()`. Состояния `detail-parsed`, `deep-done`, `all-done` несут `data.match` / `data.matches` и используются для отображения прогресса.
- Подписка `connectEvents()` запускается в `Layout` (а не в `MatchesPage`), чтобы SSE жил всё время работы приложения и не зависел от текущей страницы.

### Панель логов Redis

`components/RedisLogPanel` — правая колонка с журналом событий из Redis (SSE).

- Компонент всегда смонтирован в `Layout`; видимость переключается через проп `visible` (класс `hidden`), поэтому при скрытии подписка и накопление записей не прекращаются.
- Список компактный (`text-[11px] font-mono`), с дататаймом `ДД.ММ ЧЧ:ММ:СС`, стадией и сообщением; контейнер скроллируемый (`overflow-y-auto`).
- Автопрокрутка вниз при новых записях, пока пользователь находится у нижнего края.

Правила:

- Не создавай второй стор для тех же данных.
- Селекторы типизированы: `useMatchesStore((s) => s.matches)` — без `any`.
- Ошибки приводи к строке через `getErrorMessage` из `utils/error.ts`.

## 4. API-слой

`src/api/matches.ts` — HTTP-запросы:

- `API_URL` — базовый адрес (`http://localhost:3000`), импортируй его, не дублируй строку;
- `fetchMatches()`
- `parseMatches()`
- `analyzeMatches()`
- `parseMatchDetails(id)`
- `analizeMatchDetails(id)` (историческое имя, менять только вместе с вызовами)

`src/api/events.ts` — SSE:

- `subscribeToServerState({ onState, onConnectionChange })` — открывает `EventSource` на `${API_URL}/events`, парсит сообщения `type: 'state'`, игнорирует heartbeat (`type: 'ping'`), возвращает функцию отписки;
- переподключение выполняет сам браузер, отдельный реконнект писать не нужно.

При доработке базового URL:
- вынеси его в `import.meta.env.VITE_API_URL` с fallback на `http://localhost:3000`;
- обнови `.env.example`;
- не дублируй URL в компонентах и хуках.

## 5. Типы и контракт

`frontend/src/types/match.ts` — зеркало `MatchEntity`:

- поля в camelCase: `oddsHome`, `oddsDraw`, `oddsAway`, `aiScore`, `deepAnalyzed`, `finalDecision`, `deepAnalysis` и т.д.;
- `FinalDecision = 'СТАВИТЬ' | 'ПРОПУСТИТЬ' | 'НАБЛЮДАТЬ'`;
- `DeepAnalysis` повторяет JSON-схему глубокого анализа.

При изменении backend-контракта **обязательно** обнови этот файл и проверь компоненты. Не вводи альтернативные интерфейсы с теми же полями.

## 6. Компоненты и стили

- Функциональные компоненты, хуки, без классов.
- Один компонент — одна папка с `index.ts` для реэкспорта.
- Стили: Tailwind-классы для компоновки; SCSS-модули — для специфичных компонентов.
- Пользовательские тексты — на русском.
- Markdown от AI рендери через `Markdown`-компонент, не вставляй HTML через `dangerouslySetInnerHTML`.
- `TopMenu` содержит выпадающее меню «Сервис» (pgAdmin, RabbitMQ, Redis Insight, API) и кнопку-бутерброд справа, которая скрывает/показывает правую панель [`RedisLogPanel`](frontend/src/components/RedisLogPanel/RedisLogPanel.tsx) с логами Redis. Видимость панели хранится в `Layout`; сама панель рендерится вне `Outlet`, поэтому живёт на всех страницах. Левый `aside` со списком матчей в `MatchesPage` показывается всегда.

Генерация заготовок: `vite-plugin-create`, конфиг `frontend/vite-create.config.json`, шаблоны в `frontend/templates/`. Каталог `templates/` исключён из ESLint, так как содержит плейсхолдеры `{{name}}`.

## 7. Проверки

```bash
npm run lint -w @soccerstat/frontend
npm run build -w @soccerstat/frontend   # tsc -b && vite build
```

Или из корня: `npm run lint` и `npm run build:web`.

Частые ошибки:
- `TS6133: ... is declared but never read` — удали неиспользуемый импорт/параметр;
- `@typescript-eslint/no-explicit-any` — опиши тип или используй `unknown` + `getErrorMessage`;
- `react-hooks/set-state-in-effect` — не вызывай `setState` синхронно в эффекте; если это осознанная загрузка, добавь точечный `eslint-disable-next-line` с пояснением.

## 8. UX-правила

- Всегда показывай состояния `loading`, `error`, `empty`.
- Кнопки, запускающие парсинг/анализ, блокируй на время операции (`refreshing`/`parsing`).
- Статус фоновых операций показывай из `serverState` (`TopMenu`): parsing/analyzing — анимация, error — красный, done — зелёный; прогресс бери из `progress`.
- Не скрывай ошибки API — выводи понятное сообщение пользователю.
- Даты и коэффициенты форматируй единообразно.
