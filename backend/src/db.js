import pg from 'pg';

export function createPool(dbConfig, logger) {
  const pool = new pg.Pool({
    ...dbConfig,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    application_name: 'taskflow-api',
  });
  // Un error en un cliente inactivo no debe tumbar el proceso.
  pool.on('error', (err) => logger.error({ err }, 'error en cliente inactivo de PostgreSQL'));
  return pool;
}
