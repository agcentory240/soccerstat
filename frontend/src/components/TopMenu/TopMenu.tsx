import { NavLink } from 'react-router-dom';
import { useMatchesStore } from '../../store/useMatchesStore';

const INTERNAL_ITEMS = [
  { label: 'Прогнозы', to: '/prognoses' },
  { label: 'Live', to: '/live' },  // когда добавишь
];

const EXTERNAL_ITEMS = [
  { label: 'Админка БД', href: 'http://localhost:5050' },
  { label: 'RabbitMQ', href: 'http://localhost:15672' },
  { label: 'Матчи (API)', href: 'http://localhost:3000/matches' },
];

export function TopMenu() {

  const refreshing = useMatchesStore((s) => s.refreshing)
  const refreshAll = useMatchesStore((s) => s.refreshAll)
  
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
    </nav>
  );
}