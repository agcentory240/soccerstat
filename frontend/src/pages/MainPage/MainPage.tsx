import { Outlet } from 'react-router-dom'
export function MainPage() {

  return (
    <div className="flex h-full">
      <section className="w-full overflow-y-auto">
        <Outlet />
      </section>
    </div>
  )
}
