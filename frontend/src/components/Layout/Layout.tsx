import { useEffect, useState } from 'react';
import { TopMenu } from '../TopMenu/TopMenu';
import { RedisLogPanel } from '../RedisLogPanel';
import { Outlet } from 'react-router-dom';
import { useMatchesStore } from '../../store/useMatchesStore';

export function Layout() {
  const [logPanelVisible, setLogPanelVisible] = useState(true);
  const connectEvents = useMatchesStore((s) => s.connectEvents);

  // SSE-подписка на Redis живёт всё время работы приложения:
  // независимо от текущей страницы и видимости панели логов.
  useEffect(() => connectEvents(), [connectEvents]);

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100">
      <TopMenu
        logPanelVisible={logPanelVisible}
        onToggleLogPanel={() => setLogPanelVisible((visible) => !visible)}
      />
      <div className="flex flex-1 min-h-0">
        <main className="flex-1 min-w-0 min-h-0 overflow-hidden">
          <Outlet />
        </main>
        <RedisLogPanel visible={logPanelVisible} />
      </div>
    </div>
  );
}
