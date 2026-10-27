import { Link } from 'react-router-dom';
import type { Match } from '../../types/match';
import { formatMatchDateTime } from '../../utils/dateTime';
import { formatConfidence } from '../../utils/format';

interface MatchCardProps {
  match: Match;
}

export function MainMatchCard({ match }: MatchCardProps) {
  /**
   * Тон карточки по статусу ставки:
   * - `null` — событие в ожидании, нейтральное оформление;
   * - `true` — ставка зашла, зеленоватые рамка и фон;
   * - `false` — ставка не зашла, красноватые рамка и фон.
   */
  const cardToneClass =
    match.betStatus === null
      ? 'border-slate-800 bg-slate-900'
      : match.betStatus
        ? 'border-green-700/70 bg-green-950/40'
        : 'border-red-700/70 bg-red-950/40';

  /**
   * Уверенность модели в процентах — тот же расчёт, что в карточке списка
   * и в деталях матча ([`formatConfidence()`](frontend/src/utils/format.ts:14)).
   */
  const confidencePct = formatConfidence(
    match.confidence ?? match.deepAnalysis?.prediction?.confidence ?? null,
  );

  return (
    <article
      className={`relative flex min-h-[148px] flex-col gap-2 rounded-lg border p-3 cursor-pointer transition hover:brightness-110 focus-within:outline focus-within:outline-2 focus-within:outline-emerald-500 ${cardToneClass}`}
    >
      {/*
        Растянутая ссылка на страницу прогноза: покрывает всю карточку,
        открывается в новой вкладке. Вложенных <a> внутри карточки нет.
      */}
      <Link
        to={`/prognoses/${match.id}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Открыть прогноз: ${match.homeTeam} — ${match.awayTeam}`}
        className="absolute inset-0 rounded-lg"
      />

      {/* Страна · лига */}
      <div className="h-7 w-2/3 text-xs">{match.country} · {match.league} </div>

      {/* Время начала */}
      <div className="h-2 text-xs">{formatMatchDateTime(match.dateTime, { withYear: false })}</div>

      {/* Команды */}
      <div className="h-7 mt-1 flex flex-1 flex-col justify-center gap-1">
        <div className="h-4 text-sm font-medium truncate">{match.homeTeam}</div>
        <div className="h-4 text-sm font-medium truncate" >{match.awayTeam}</div>
      </div>

      {/* счет */}
      <div className='flex h3 flex-row '>
        {match.finalScore!==null && (
          <div className="text-xl text-slate-100 font-semibold">
              {match.finalScore}
          </div>
        )}
        {match.finalScore === null && (
          <div className=" text-slate-500 font-semibold">
              Ожидание...
          </div>
        )}        
      </div>


      {/* Ставка*/}
      <div className="flex gap-2 h-4">
        {match.mainBet && (
          <div className='flex gap-1 items-center'>
            <span className='text-xs'>
              Событие
            </span>
            <span className="text-orange-500 font-semibold text-sm">
                {match.mainBet}
            </span>
            {match.betCoefficient && (
              <span className="text-slate-300 text-xs">
                ({match.betCoefficient}
                {confidencePct !== null && ` · ${confidencePct}%`})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Статус ставки: зашла / не зашла / ожидание */}
      <div className="flex h-4 items-center">
        <span
          className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold ${
            match.betStatus === null
              ? 'bg-slate-500 text-white'
              : match.betStatus
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
          }`}
        >
          {match.betStatus === null
            ? 'Ожидание'
            : match.betStatus
              ? 'Ставка зашла'
              : 'Ставка не зашла'}
        </span>
      </div>
    </article>
  );
}
