import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { createPool } from './db.js';
import { createLogger } from './logger.js';
import { migrate } from './migrator.js';

// CLI: `node src/migrate.js`. Se ejecuta como job one-shot antes de cada despliegue.
const config = loadConfig();
const logger = createLogger({ level: config.logLevel, version: config.version });
const pool = createPool(config.db, logger);
const dir = fileURLToPath(new URL('../migrations', import.meta.url));

try {
  await migrate(pool, dir, logger);
} catch (err) {
  logger.fatal({ err }, 'migración fallida');
  process.exitCode = 1;
} finally {
  await pool.end();
}
