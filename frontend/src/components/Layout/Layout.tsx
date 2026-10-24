import { useState } from 'react';
import { TopMenu } from '../TopMenu/TopMenu';
import { Outlet } from 'react-router-dom';

/** Контекст Layout для вложенных страниц (доступен через useOutletContext). */
export interface LayoutContext {
  asideVisible: boolean;
}

export function Layout() {
  const [asideVisible, setAsideVisible] = useState(true);

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100">
      <TopMenu
        asideVisible={asideVisible}
        onToggleAside={() => setAsideVisible((visible) => !visible)}
      />
      <main className="flex-1 min-h-0 overflow-hidden">
        <Outlet context={{ asideVisible } satisfies LayoutContext} />
      </main>
    </div>
  );
}
