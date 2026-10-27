import { readFileSync } from 'node:fs';

// Lee un secreto desde NAME_FILE (Docker secrets) o, en su defecto, desde NAME.
function readSecret(env, name) {
  const file = env[`${name}_FILE`];
  if (file) return readFileSync(file, 'utf8').trim();
  return env[name];
}

export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const password = readSecret(env, 'DB_PASSWORD');

  // Fail fast: en producción no se arranca con credenciales por defecto.
  if (nodeEnv === 'production' && !env.DATABASE_URL && !password) {
    throw new Error('DB_PASSWORD o DB_PASSWORD_FILE es obligatorio en producción');
  }

  return Object.freeze({
    env: nodeEnv,
    port: Number(env.PORT ?? 3000),
    logLevel: env.LOG_LEVEL ?? 'info',
    version: env.APP_VERSION ?? 'dev',
    commit: env.GIT_SHA ?? 'local',
    shutdownTimeoutMs: Number(env.SHUTDOWN_TIMEOUT_MS ?? 10_000),
    db: env.DATABASE_URL
      ? { connectionString: env.DATABASE_URL, max: Number(env.DB_POOL_MAX ?? 10) }
      : {
          host: env.DB_HOST ?? 'localhost',
          port: Number(env.DB_PORT ?? 5432),
          database: env.DB_NAME ?? 'taskflow',
          user: env.DB_USER ?? 'taskflow',
          password: password ?? 'taskflow',
          max: Number(env.DB_POOL_MAX ?? 10),
          ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
        },
  });
}
