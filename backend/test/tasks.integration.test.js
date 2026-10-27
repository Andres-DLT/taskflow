import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { after, before, describe, it } from 'node:test';
import { createPool } from '../src/db.js';
import { createLogger } from '../src/logger.js';
import { migrate } from '../src/migrator.js';
import { createPgTaskRepository } from '../src/repository.js';

// Tests contra un PostgreSQL real. En CI se levanta como service container;
// en local: `docker compose up -d db` y DATABASE_URL=postgres://taskflow:taskflow@localhost:5432/taskflow
const url = process.env.DATABASE_URL;

describe('repositorio PostgreSQL', { skip: !url && 'DATABASE_URL no definida' }, () => {
  const logger = createLogger({ level: 'silent' });
  const migrationsDir = fileURLToPath(new URL('../migrations', import.meta.url));
  let pool;
  let repo;

  before(async () => {
    pool = createPool({ connectionString: url, max: 2 }, logger);
    await migrate(pool, migrationsDir, logger);
    await pool.query('TRUNCATE tasks RESTART IDENTITY');
    repo = createPgTaskRepository(pool);
  });

  after(async () => {
    await pool?.end();
  });

  it('las migraciones son idempotentes', async () => {
    const applied = await migrate(pool, migrationsDir, logger);
    assert.deepEqual(applied, []);
  });

  it('ciclo CRUD completo', async () => {
    const task = await repo.create('Integración');
    assert.equal(task.title, 'Integración');
    assert.equal(task.done, false);

    const updated = await repo.update(task.id, { done: true });
    assert.equal(updated.done, true);
    assert.equal(updated.title, 'Integración');

    assert.equal((await repo.list()).length, 1);
    assert.equal(await repo.remove(task.id), true);
    assert.equal(await repo.update(task.id, { done: false }), null);
  });

  it('ping verifica la conexión', async () => {
    await repo.ping();
  });
});
