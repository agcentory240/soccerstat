import { useEffect } from 'react'
import { useMatchesStore } from '../../store/useMatchesStore'
import { MatchList } from '../../components/MatchList'
import { Outlet } from 'react-router-dom'

export function MatchesPage() {
  const matches = useMatchesStore((s) => s.matches)
  const loading = useMatchesStore((s) => s.loading)
  const error = useMatchesStore((s) => s.error)
  const loadMatches = useMatchesStore((s) => s.loadMatches)

  // SSE-подписка на состояние сервера живёт в Layout — здесь не дублируем.
  useEffect(() => {
    loadMatches()
  }, [loadMatches])

  return (
    <div className="flex h-full">
      <aside className="w-1/4 ...">
        <MatchList matches={matches} loading={loading} error={error} />
      </aside>
      <section className="w-3/4 overflow-y-auto">
        <Outlet />
      </section>
    </div>
  )
}
