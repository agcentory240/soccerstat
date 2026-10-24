/**
 * Адрес Redis. В Docker Compose — `redis://redis:6379`,
 * при локальном запуске API — `redis://localhost:6379`.
 */
export const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/** Канал pub/sub, через который публикуется состояние сервера. */
export const STATE_CHANNEL = 'soccerstat:state';
