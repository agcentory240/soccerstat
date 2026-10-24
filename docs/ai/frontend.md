# Frontend (React) — инструкции

## 1. Стек и структура

- React 19, TypeScript 6, Vite 8.
- React Router 7, Zustand 5, `react-markdown`.
- Tailwind CSS 4 через `@tailwindcss/vite`; часть компонентов использует SCSS-модули.

```text
frontend/src/
├── api/           # HTTP-клиент (matches.ts)
├── components/    # Layout, MatchCard, MatchList, MatchDetails, Markdown, TopMenu
├── hooks/         # useMatch
├── pages/         # MatchesPage
├── store/         # useMatchesStore (Zustand)
├── types/         # match.ts — контракт API
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
- `loadMatches()` — `GET /matches`, сортировка (selected сверху, затем по дате), лимит 500;
- `refreshAll()` — парсинг → анализ → повторная загрузка.

Правила:

- Не создавай второй стор для тех же данных.
- Селекторы типизированы: `useMatchesStore((s) => s.matches)` — без `any`.
- Ошибки приводи к строке через `getErrorMessage` из `utils/error.ts`.

## 4. API-слой

`src/api/matches.ts` — единственное место HTTP-запросов:

- `fetchMatches()`
- `parseMatches()`
- `analyzeMatches()`
- `parseMatchDetails(id)`
- `analizeMatchDetails(id)` (историческое имя, менять только вместе с вызовами)

Сейчас базовый URL захардкожен: `http://localhost:3000`. При доработке:
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
- Не скрывай ошибки API — выводи понятное сообщение пользователю.
- Даты и коэффициенты форматируй единообразно.
