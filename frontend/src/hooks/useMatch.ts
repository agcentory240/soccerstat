import { useCallback, useEffect, useState } from 'react';
import type { Match } from '../types/match';
import { getErrorMessage } from '../utils/error';

const API_URL = 'http://localhost:3000';

export function useMatch(id: string | undefined) {
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/matches/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          setMatch(null);
          return;
        }
        throw new Error(`Failed: ${res.status}`);
      }
      const data = await res.json();
      setMatch(data);
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // Намеренная загрузка данных при монтировании/смене id.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return { match, loading, error, refetch: load };
}