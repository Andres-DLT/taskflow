import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Identificador arbitrario del advisory lock: evita que dos despliegues migren a la vez.
const LOCK_ID = 727_001;

// Migraciones SQL forward-only, cada una en su propia transacción.
export async function migrate(pool, dir, logger) {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);

    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.name));
    const pending = (await readdir(dir))
      .filter((f) => f.endsWith('.sql') && !applied.has(f))
      .sort();

    for (const file of pending) {
      const sql = await readFile(join(dir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        logger.info({ migration: file }, 'migración aplicada');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`falló la migración ${file}: ${err.message}`, { cause: err });
      }
    }
    if (pending.length === 0) logger.info('esquema al día, nada que migrar');
    return pending;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    client.release();
  }
}
