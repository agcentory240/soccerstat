import { useState } from 'react';
import { TopMenu } from '../TopMenu/TopMenu';
import { RedisLogPanel } from '../RedisLogPanel';
import { Outlet } from 'react-router-dom';

export function Layout() {
  const [logPanelVisible, setLogPanelVisible] = useState(true);

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
        {logPanelVisible && <RedisLogPanel />}
      </div>
    </div>
  );
}
