import { hostname } from 'node:os';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createPool } from './db.js';
import { createLogger } from './logger.js';
import { createMetrics } from './metrics.js';
import { createPgTaskRepository } from './repository.js';

const config = loadConfig();
const logger = createLogger({ level: config.logLevel, version: config.version });
const pool = createPool(config.db, logger);

const app = createApp({
  repo: createPgTaskRepository(pool),
  logger,
  metrics: createMetrics(),
  // instance = hostname del contenedor: permite ver qué réplica atendió la petición.
  info: {
    version: config.version,
    commit: config.commit,
    environment: config.environment,
    instance: hostname(),
  },
});

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env }, 'API escuchando');
});
// Mayor que el idle timeout del proxy para evitar 502 por conexiones keep-alive cerradas.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

// Graceful shutdown: deja de aceptar conexiones, termina las peticiones en curso y cierra el pool.
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  app.locals.draining = true;
  logger.info({ signal }, 'apagando');

  const forceExit = setTimeout(() => {
    logger.error('timeout de apagado, forzando salida');
    process.exit(1);
  }, config.shutdownTimeoutMs);
  forceExit.unref();

  server.close(async (err) => {
    await pool.end().catch((poolErr) => logger.error({ err: poolErr }, 'error cerrando el pool'));
    logger.info('apagado completo');
    process.exit(err ? 1 : 0);
  });
  server.closeIdleConnections();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => {
  logger.fatal({ err }, 'promesa rechazada sin manejar');
  process.exit(1);
});
