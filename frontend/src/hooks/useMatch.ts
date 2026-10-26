import { useCallback, useEffect, useState } from 'react';
import type { Match } from '../types/match';
import { getErrorMessage } from '../utils/error';

const API_URL = 'http://localhost:3000';

/** Опции повторной загрузки матча. */
interface LoadMatchOptions {
  /**
   * Не показывать состояние загрузки (и не сбрасывать ошибку).
   * Используется для фонового обновления по SSE-событию `bet-checked`,
   * чтобы уже отрисованный матч не пропадал из интерфейса.
   */
  silent?: boolean;
}

export function useMatch(id: string | undefined) {
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (options: LoadMatchOptions = {}) => {
    if (!id) return;

    const { silent = false } = options;

    if (!silent) {
      setLoading(true);
      setError(null);
    }

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
      if (!silent) setError(getErrorMessage(e));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // Намеренная загрузка данных при монтировании/смене id.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return { match, loading, error, refetch: load };
}