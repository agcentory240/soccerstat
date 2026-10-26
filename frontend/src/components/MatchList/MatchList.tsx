import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import type { Match } from '../../types/match';
import { MatchCard } from '../MatchCard/MatchCard';
import { useMatchesStore } from '../../store/useMatchesStore';
import { fetchMatch } from '../../api/matches';

interface MatchListProps {
  matches: Match[];
  loading: boolean;
  error: string | null;
}

export function MatchList({ matches, loading, error }: MatchListProps) {

  const { id } = useParams<{ id: string }>()

  const serverState = useMatchesStore((s) => s.serverState)
  const updateMatch = useMatchesStore((s) => s.updateMatch)

  /** Ключ `<id>:<updatedAt>` последнего обработанного события — защита от повторов. */
  const lastCardUpdateRef = useRef<string | null>(null)

  /**
   * Финальный счёт и результат проверки ставки приходят событиями `score-parsed`
   * и `bet-checked`. Перечитываем только тот матч, который есть в списке,
   * и точечно заменяем его карточку — без полной перезагрузки списка.
   */
  useEffect(() => {
    if (!serverState || serverState.status !== 'done') return
    if (serverState.stage !== 'score-parsed' && serverState.stage !== 'bet-checked') return

    const eventMatchId = serverState.data?.match?.id
    if (eventMatchId == null) return

    // Матча нет в текущем списке — перечитывать нечего.
    const inList = useMatchesStore.getState().matches.some((m) => m.id === eventMatchId)
    if (!inList) return

    const eventKey = `${eventMatchId}:${serverState.updatedAt}`
    if (lastCardUpdateRef.current === eventKey) return
    lastCardUpdateRef.current = eventKey

    void fetchMatch(eventMatchId)
      .then((updated) => updateMatch(updated))
      .catch(() => {
        // Фоновое обновление одной карточки не должно ломать список.
      })
  }, [serverState, updateMatch])

  if (loading) {
    return <div className="p-4 text-slate-400 text-sm">Загрузка матчей...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-400 text-sm">Ошибка: {error}</div>;
  }

  if (matches.length === 0) {
    return <div className="p-4 text-slate-500 text-sm">Матчей нет</div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Заголовок — фиксированный */}
      <div className="px-4 py-2 border-b border-slate-800 text-xs text-slate-400 shrink-0">
        Найдено: {matches.length}
      </div>

      {/* Список — скроллящийся */}
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto p-3 space-y-2 gap-1">
        {matches.map((match) => (
          <MatchCard key={match.id} match={match} active={match.id === parseInt(id?id:'0')}/>
        ))}
      </div>
    </div>
  );
}