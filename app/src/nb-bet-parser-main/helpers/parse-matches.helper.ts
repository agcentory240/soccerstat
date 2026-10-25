import type { Match, MatchStatus } from '../match.interface.js';

interface LeagueInfo {
  '1': string;   // страна
  '2': string | null;  // код страны
  '3': string;   // название лиги
}

interface RawMatch {
  '1': number;   // тип: 1=предстоящий, 2=live, 3=завершённый
  '3': string;   // id матча
  '4': number;   // timestamp
  '5'?: { '1'?: number; '2'?: number; '3'?: number };
  '6'?: { '1'?: number; '2'?: number; '3'?: number };
  '7': string;   // хозяева
  '11'?: number; // голы хозяев (1-й тайм)
  '15': string;  // гости
  '19'?: number; // голы гостей (1-й тайм)
  '26'?: number; // голы хозяев (2-й тайм)
  '27'?: number; // голы гостей (2-й тайм)
  '53'?: number; // текущая минута (live)
}

/**
 * Преобразует числовой тип матча nb-bet (`RawMatch['1']`) в явный статус.
 *
 * 1 — предстоящий, 2 — live, 3 — завершённый.
 * Любое неожиданное значение считаем предстоящим матчем.
 */
export function resolveMatchStatus(type: number | undefined): MatchStatus {
  if (type === 2) return 'live';
  if (type === 3) return 'finished';
  return 'scheduled';
}

interface NextData {
  props: {
    initialState: {
      pageMatchResults: {
        leagues: Record<string, LeagueInfo>;
        matches: Record<string, RawMatch>;
        leagueToMatchesTable: Record<string, string[]>;
      };
    };
  };
}

export function parseMatchesFromDocument(doc: Document): Match[] {
  const script = doc.querySelector('script#__NEXT_DATA__');
  if (!script?.textContent) {
    console.warn('__NEXT_DATA__ not found');
    return [];
  }

  let data: NextData;
  try {
    data = JSON.parse(script.textContent);
  } catch (e) {
    console.error('Failed to parse __NEXT_DATA__:', e);
    return [];
  }

  const state = data.props?.initialState?.pageMatchResults;
  if (!state) {
    console.warn('pageMatchResults not found');
    return [];
  }

  const { leagues, matches, leagueToMatchesTable } = state;
  const results: Match[] = [];

  for (const [leagueIdStr, matchIds] of Object.entries(leagueToMatchesTable)) {
    const leagueInfo = leagues[leagueIdStr];
    if (!leagueInfo) continue;

    const country = leagueInfo['1'] || '';
    const league = leagueInfo['3'] || '';

    for (const matchId of matchIds) {
      const m = matches[matchId];
      if (!m) continue;

      // Статус матча: единственный надёжный источник — тип из nb-bet
      const status = resolveMatchStatus(m['1']);

      // URL
      const urlId = m['3'] || matchId;
      const prefix = status === 'live' ? 'LiveEvents' : 'Events';
      const url = `https://nb-bet.com/${prefix}/${urlId}`;

      // Дата и время
      const timestamp = m['4'];
      const date = timestamp ? new Date(timestamp) : null;
      const dateTime = date
        ? `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
        : '';

      // Команды
      const homeTeam = m['7'] || '';
      const awayTeam = m['15'] || '';

      // Счёт: (голы 1-го тайма + голы 2-го тайма) для каждой команды
      const home1 = m['11'] ?? 0;
      const home2 = m['26'] ?? 0;
      const away1 = m['19'] ?? 0;
      const away2 = m['27'] ?? 0;

      // Счёт показываем, только если матч не предстоящий
      // (у предстоящих нет полей для голов)
      const hasScore = status !== 'scheduled';
      const score = hasScore
        ? `${home1 + home2} : ${away1 + away2}`
        : null;

      // Live-минута актуальна только для идущих матчей.
      // Для завершённых принудительно сбрасываем в null,
      // иначе «последняя минута» залипает в БД.
      const liveTime =
        status === 'live' && m['53'] != null ? `${m['53']}'` : null;

      // Коэффициенты (текущие — из m['6'])
      const odds = m['6'] || {};
      results.push({
        country,
        league,
        url,
        dateTime,
        homeTeam,
        awayTeam,
        score,
        liveTime,
        status,
        odds: {
          home: odds['1'] != null ? String(odds['1']) : null,
          draw: odds['2'] != null ? String(odds['2']) : null,
          away: odds['3'] != null ? String(odds['3']) : null,
        },
      });
    }
  }

  return results;
}