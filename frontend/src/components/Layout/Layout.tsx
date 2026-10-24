import { TopMenu } from '../TopMenu/TopMenu';
import { Outlet } from 'react-router-dom';

export function Layout() {
  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100">
      <TopMenu />
      <main className="flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}