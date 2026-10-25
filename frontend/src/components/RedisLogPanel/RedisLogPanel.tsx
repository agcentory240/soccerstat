import { useEffect, useRef } from 'react';
import { useMatchesStore } from '../../store/useMatchesStore';
import type { ServerStateLogEntry, ServerStateStatus } from '../../types/state';

/** Компактный дататайм записи: ДД.ММ ЧЧ:ММ:СС. */
function formatAt(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return at;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}:${pad(d.getSeconds())}`;
}

const STATUS_TEXT: Record<ServerStateStatus, string> = {
  idle: 'text-slate-400',
  parsing: 'text-amber-300',
  analyzing: 'text-sky-300',
  done: 'text-emerald-300',
  error: 'text-red-300',
};

interface RedisLogPanelProps {
  /**
   * Видимость панели. Компонент остаётся смонтированным,
   * а события продолжают копиться в сторе даже при `visible = false`.
   */
  visible?: boolean;
}

function LogRow({ entry }: { entry: ServerStateLogEntry }) {
  return (
    <div className="flex items-start gap-1.5 border-b border-slate-800/60 px-2 py-0.5 font-mono text-[11px] leading-tight">
      <span className="shrink-0 text-slate-500" title={entry.at}>
        {formatAt(entry.at)}
      </span>
      <span className={`shrink-0 ${STATUS_TEXT[entry.status]}`}>
        [{entry.stage ?? entry.status}]
      </span>
      <span className="min-w-0 break-words text-slate-300">{entry.message}</span>
    </div>
  );
}

/**
 * Правая панель журнала событий Redis (SSE-поток `GET /events`).
 *
 * Журнал накапливается в `useMatchesStore`, поэтому панель можно скрывать —
 * поток Redis продолжает слушаться, записи не теряются.
 */
export function RedisLogPanel({ visible = true }: RedisLogPanelProps) {
  const logs = useMatchesStore((s) => s.eventLogs);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  // Автопрокрутка вниз при новых записях, если пользователь у нижнего края.
  useEffect(() => {
    if (!visible) return;
    const el = scrollRef.current;
    if (el && pinnedToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs.length, visible]);

  // При повторном показе панели возвращаемся к последней записи.
  useEffect(() => {
    if (!visible) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    pinnedToBottom.current = true;
  }, [visible]);

  return (
    <aside
      className={`${
        visible ? 'flex' : 'hidden'
      } w-80 shrink-0 flex-col overflow-hidden border-l border-slate-800 bg-slate-900`}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-3 py-2">
        <span className="text-xs uppercase tracking-wide text-slate-400">Логи Redis</span>
        <span className="text-[10px] text-slate-500">{logs.length}</span>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {logs.length === 0 ? (
          <p className="p-3 text-center text-xs text-slate-500">Пока пусто</p>
        ) : (
          logs.map((entry) => <LogRow key={entry.id} entry={entry} />)
        )}
      </div>
    </aside>
  );
}
