import { useEffect, useRef } from 'react';
import type { Match } from '../../types/match';
import { MainMatchCard } from '../MainMatchCard';
import { MatchDayDivider } from '../MatchDayDivider';
import { useMatchesStore } from '../../store/useMatchesStore';
import { fetchMatch } from '../../api/matches';

interface MainMatchListProps {
  matches: Match[];
  loading: boolean;
  error: string | null;
}

/** Игровой день: ключ для React и дата для разделителя. */
interface MatchDayGroup {
  /** Дата в формате `YYYY-MM-DD` — стабильный ключ группы. */
  key: string;
  /** Исходная ISO-строка `dateTime` для форматирования подписи. */
  date: string;
  matches: Match[];
}

export function MainMatchList({ matches, loading, error }: MainMatchListProps) {
  const serverState = useMatchesStore((s) => s.serverState)
  const updateMatch = useMatchesStore((s) => s.updateMatch)

  /** Ключ `<id>:<updatedAt>` последнего обработанного события — защита от повторов. */
  const lastCardUpdateRef = useRef<string | null>(null)

  /**
   * Финальный счёт и результат проверки ставки приходят событиями
   * `score-parsed` и `bet-checked`. Перечитываем только тот матч, который есть
   * в текущем списке, и точечно заменяем его карточку — без полной
   * перезагрузки списка.
   */
  useEffect(() => {
    if (!serverState || serverState.status !== 'done') return
    if (serverState.stage !== 'score-parsed' && serverState.stage !== 'bet-checked') return

    const eventMatchId = serverState.data?.match?.id
    if (eventMatchId == null) return

    // Матча нет в текущем списке — перечитывать нечего.
    const inList = useMatchesStore
      .getState()
      .prognozedMatches.some((m) => m.id === eventMatchId)
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

  const days = groupMatchesByDay(matches);

  return (
    <div className="flex flex-col">
      {days.map((day) => (
        <section key={day.key}>
          <MatchDayDivider date={day.date} />

          {/* Пять карточек в ряд, остальные переносятся на следующую строку. */}
          <div className="grid grid-cols-5 gap-3">
            {day.matches.map((match) => (
              <MainMatchCard key={match.id} match={match}/>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * Группирует матчи по календарному дню начала, сохраняя порядок исходного списка.
 * День берётся прямо из строки `dateTime` (без пересчёта часового пояса).
 */
function groupMatchesByDay(matches: Match[]): MatchDayGroup[] {
  const groups = new Map<string, MatchDayGroup>();

  for (const match of matches) {
    const key = match.dateTime.slice(0, 10);

    const group = groups.get(key);
    if (group) {
      group.matches.push(match);
      continue;
    }

    groups.set(key, { key, date: match.dateTime, matches: [match] });
  }

  return Array.from(groups.values());
}
