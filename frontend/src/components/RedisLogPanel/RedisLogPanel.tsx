/**
 * Правая панель для логов Redis.
 * Пока показывает заглушку — сюда будет подключён поток событий из Redis.
 */
export function RedisLogPanel() {
  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-hidden border-l border-slate-800 bg-slate-900">
      <div className="shrink-0 border-b border-slate-800 px-4 py-2 text-xs uppercase tracking-wide text-slate-400">
        Логи Redis
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
        <svg
          className="h-8 w-8 text-slate-600"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
        <p className="text-sm text-slate-400">Пока пусто</p>
        <p className="text-xs text-slate-500">
          Здесь будут отображаться события из Redis
        </p>
      </div>
    </aside>
  );
}
