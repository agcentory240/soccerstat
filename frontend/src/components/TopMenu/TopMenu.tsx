import { NavLink } from 'react-router-dom';
import { useMatchesStore } from '../../store/useMatchesStore';
import type { ServerStateEvent } from '../../types/state';

const INTERNAL_ITEMS = [
  { label: 'Прогнозы', to: '/prognoses' },
  { label: 'Live', to: '/live' },  // когда добавишь
];

const EXTERNAL_ITEMS = [
  { label: 'Админка БД', href: 'http://localhost:5050' },
  { label: 'RabbitMQ', href: 'http://localhost:15672' },
  { label: 'Матчи (API)', href: 'http://localhost:3000/matches' },
];

function describeState(state: ServerStateEvent | null, connected: boolean) {
  if (!connected) {
    return { label: 'Нет связи с сервером', dot: 'bg-slate-500', text: 'text-slate-400' };
  }

  if (!state) {
    return { label: 'Подключение…', dot: 'bg-amber-400 animate-pulse', text: 'text-slate-300' };
  }

  switch (state.status) {
    case 'parsing':
      return { label: state.message, dot: 'bg-amber-400 animate-pulse', text: 'text-amber-300' };
    case 'analyzing':
      return { label: state.message, dot: 'bg-sky-400 animate-pulse', text: 'text-sky-300' };
    case 'error':
      return { label: state.message, dot: 'bg-red-500', text: 'text-red-300' };
    case 'done':
      return { label: state.message, dot: 'bg-emerald-400', text: 'text-emerald-300' };
    default:
      return { label: state.message, dot: 'bg-slate-500', text: 'text-slate-300' };
  }
}

export function TopMenu() {

  const refreshing = useMatchesStore((s) => s.refreshing)
  const refreshAll = useMatchesStore((s) => s.refreshAll)
  const serverState = useMatchesStore((s) => s.serverState)
  const eventsConnected = useMatchesStore((s) => s.eventsConnected)
  const status = describeState(serverState, eventsConnected)
  
  return (
    <nav className="flex items-center gap-2 p-3 bg-slate-900 border-b border-slate-700">
      <span className="text-emerald-400 font-bold mr-4">SoccerStat</span>

      {INTERNAL_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `px-3 py-1.5 text-sm rounded transition ${
              isActive
                ? 'bg-emerald-600 text-white'
                : 'text-slate-300 hover:text-white hover:bg-slate-700'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}

      {EXTERNAL_ITEMS.map((item) => (
        <a
          key={item.href}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition"
        >
          {item.label}
        </a>
      ))}

      <button
        onClick={refreshAll}
        disabled={refreshing}
        className="px-3 py-1.5 text-sm text-white bg-emerald-600 hover:bg-emerald-500
                   rounded transition ml-auto disabled:opacity-60 disabled:cursor-not-allowed
                   flex items-center gap-2"
      >
        {refreshing && (
          <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        )}
        {refreshing ? 'Обновление...' : 'Обновить матчи'}
      </button>

      <div
        className="ml-3 flex max-w-[320px] items-center gap-2"
        title={serverState ? `Обновлено: ${serverState.updatedAt}` : undefined}
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${status.dot}`} />
        <span className={`truncate text-xs ${status.text}`}>{status.label}</span>
        {serverState?.progress && serverState.progress.total > 0 && (
          <span className="shrink-0 text-xs text-slate-400">
            {serverState.progress.processed}/{serverState.progress.total}
          </span>
        )}
      </div>
    </nav>
  );
}