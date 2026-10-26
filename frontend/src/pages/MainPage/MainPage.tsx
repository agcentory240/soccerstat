import { useEffect } from 'react';
import { MainMatchList } from '../../components/MainMatchList';
import { useMatchesStore } from '../../store/useMatchesStore';

export function MainPage() {
  const prognozedMatches = useMatchesStore((s) => s.prognozedMatches);
  const loading = useMatchesStore((s) => s.loading);
  const error = useMatchesStore((s) => s.error);
  const loadPrognozeMatches = useMatchesStore((s) => s.loadPrognozeMatches);

  // Список нужен для группировки по игровым дням; SSE-подписка живёт в Layout.
  useEffect(() => {
    void loadPrognozeMatches();
  }, [loadPrognozeMatches]);

  return (
    <div className="flex h-full">
      <section className="w-full overflow-y-auto p-4">
        <MainMatchList matches={prognozedMatches} loading={loading} error={error} />
      </section>
    </div>
  );
}
