import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Автоматическая загрузка переменных окружения из `.env`.
 *
 * Порядок поиска (побеждает первый найденный файл для каждой переменной):
 * 1. `app/.env` — локальные переопределения разработчика (адреса `localhost`);
 * 2. `<корень репозитория>/.env` — общий файл проекта.
 *
 * Уже установленные переменные окружения процесса имеют приоритет над файлами,
 * поэтому значения из Docker Compose (`docker-compose.yml`) не перезаписываются.
 *
 * Модуль подключается ради побочного эффекта: `import './env.js';` должен идти
 * первым в точке входа, чтобы конфиги, читающие `process.env` на этапе импорта
 * (`ai.config.ts`, `state.config.ts`), увидели загруженные значения.
 */

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

/** Пути к `.env` относительно расположения модуля (работает и из `src`, и из `dist`). */
const ENV_PATHS = [
  resolve(MODULE_DIR, '..', '.env'),
  resolve(MODULE_DIR, '..', '..', '.env'),
];

/**
 * Упрощённый парсер `.env` для версий Node без `process.loadEnvFile`
 * (метод появился в Node 20.12).
 */
function parseEnvContent(content: string): Array<[string, string]> {
  const entries: Array<[string, string]> = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) entries.push([key, value]);
  }

  return entries;
}

/** Загружает один файл `.env`, не перезаписывая уже заданные переменные. */
function applyEnvFile(filePath: string): void {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(filePath);
    return;
  }

  for (const [key, value] of parseEnvContent(readFileSync(filePath, 'utf8'))) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/** Загружает доступные `.env` и возвращает список фактически прочитанных файлов. */
export function loadEnv(): string[] {
  const loaded: string[] = [];

  for (const filePath of ENV_PATHS) {
    if (!existsSync(filePath)) continue;

    try {
      applyEnvFile(filePath);
      loaded.push(filePath);
      console.log(`[env] Переменные окружения загружены из ${filePath}`);
    } catch (error) {
      console.warn(
        `[env] Не удалось загрузить ${filePath}: ${(error as Error).message}`,
      );
    }
  }

  return loaded;
}

// Побочный эффект при импорте — так `.env` гарантированно загружается
// раньше модулей, читающих `process.env` на верхнем уровне.
loadEnv();
