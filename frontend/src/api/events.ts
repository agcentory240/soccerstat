import { API_URL } from './matches';
import type { ServerStateEvent, ServerStateMessage } from '../types/state';

interface StateSubscriptionHandlers {
  onState: (state: ServerStateEvent) => void;
  onConnectionChange?: (connected: boolean) => void;
}

/**
 * Подписка на SSE-поток состояния сервера.
 * Возвращает функцию отписки.
 */
export function subscribeToServerState(handlers: StateSubscriptionHandlers): () => void {
  const source = new EventSource(`${API_URL}/events`);

  source.onopen = () => handlers.onConnectionChange?.(true);

  source.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as ServerStateMessage;
      if (data.type === 'state') handlers.onState(data);
    } catch {
      // heartbeat и некорректные сообщения игнорируем
    }
  };

  source.onerror = () => handlers.onConnectionChange?.(false);

  return () => source.close();
}
