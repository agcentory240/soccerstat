import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useMatchesStore } from '../../store/useMatchesStore';
import type { ServerStateEvent } from '../../types/state';

const INTERNAL_ITEMS = [
  { label: 'Главная', to: '/' },
  { label: 'TOP', to: '/top' },
  { label: 'Прогнозы', to: '/prognoses' },
  { label: 'Live', to: '/live' },  // когда добавишь
];

/** Служебные ссылки на внешние панели — собраны в выпадающее меню «Сервис». */
const SERVICE_ITEMS = [
  { label: 'Админка БД', href: 'http://localhost:5050' },
  { label: 'RabbitMQ', href: 'http://localhost:15672' },
  { label: 'Redis Insight', href: 'http://localhost:5540' },
  { label: 'Матчи (API)', href: 'http://localhost:3000/matches' },
];

interface TopMenuProps {
  logPanelVisible: boolean;
  onToggleLogPanel: () => void;
}

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

export function TopMenu({ logPanelVisible, onToggleLogPanel }: TopMenuProps) {

  const refreshing = useMatchesStore((s) => s.refreshing)
  const refreshAll = useMatchesStore((s) => s.refreshAll)
  const checkingBets = useMatchesStore((s) => s.checkingBets)
  const checkBets = useMatchesStore((s) => s.checkBets)
  const serverState = useMatchesStore((s) => s.serverState)
  const eventsConnected = useMatchesStore((s) => s.eventsConnected)
  const status = describeState(serverState, eventsConnected)

  const [serviceOpen, setServiceOpen] = useState(false)
  const serviceRef = useRef<HTMLDivElement>(null)

  // Закрываем выпадающее меню по клику вне его и по Escape.
  useEffect(() => {
    if (!serviceOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (serviceRef.current && !serviceRef.current.contains(event.target as Node)) {
        setServiceOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setServiceOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [serviceOpen])

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

      <div ref={serviceRef} className="relative">
        <button
          type="button"
          onClick={() => setServiceOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={serviceOpen}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition"
        >
          Сервис
          <svg
            className={`h-3 w-3 transition-transform ${serviceOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2 4.5 6 8.5 10 4.5" />
          </svg>
        </button>

        {serviceOpen && (
          <div
            role="menu"
            className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-md border border-slate-700 bg-slate-800 py-1 shadow-lg"
          >
            {SERVICE_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                onClick={() => setServiceOpen(false)}
                className="block px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition"
              >
                {item.label}
              </a>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={checkBets}
        disabled={checkingBets}
        className="px-3 py-1.5 text-sm text-white bg-sky-600 hover:bg-sky-500
                   rounded transition ml-auto disabled:opacity-60 disabled:cursor-not-allowed
                   flex items-center gap-2"
      >
        {checkingBets && (
          <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        )}
        {checkingBets ? 'Проверка...' : 'Проверить ставки'}
      </button>

      <button
        onClick={refreshAll}
        disabled={refreshing}
        className="px-3 py-1.5 text-sm text-white bg-emerald-600 hover:bg-emerald-500
                   rounded transition disabled:opacity-60 disabled:cursor-not-allowed
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

      <span className="ml-3 h-5 w-px bg-slate-700" aria-hidden="true" />

      <button
        type="button"
        onClick={onToggleLogPanel}
        aria-label={logPanelVisible ? 'Скрыть логи Redis' : 'Показать логи Redis'}
        aria-pressed={!logPanelVisible}
        title={logPanelVisible ? 'Скрыть логи Redis' : 'Показать логи Redis'}
        className="rounded p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 transition"
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
    </nav>
  );
}
