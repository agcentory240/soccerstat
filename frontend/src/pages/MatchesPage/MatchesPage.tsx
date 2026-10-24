import { useEffect } from 'react'
import { Outlet, useOutletContext } from 'react-router-dom'
import { useMatchesStore } from '../../store/useMatchesStore'
import { MatchList } from '../../components/MatchList'
import type { LayoutContext } from '../../components/Layout/Layout'

export function MatchesPage() {
  const matches = useMatchesStore((s) => s.matches)
  const loading = useMatchesStore((s) => s.loading)
  const error = useMatchesStore((s) => s.error)
  const loadMatches = useMatchesStore((s) => s.loadMatches)
  const connectEvents = useMatchesStore((s) => s.connectEvents)
  const { asideVisible } = useOutletContext<LayoutContext>()

  useEffect(() => {
    loadMatches()
  }, [loadMatches])

  useEffect(() => connectEvents(), [connectEvents])

  return (
    <div className="flex h-full">
      {asideVisible && (
        <aside className="w-1/4 shrink-0 overflow-hidden border-r border-slate-800">
          <MatchList matches={matches} loading={loading} error={error} />
        </aside>
      )}
      <section className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </section>
    </div>
  )
}
