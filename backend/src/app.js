import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { tasksRouter } from './routes/tasks.js';

const QUIET_PATHS = new Set(['/healthz', '/readyz', '/metrics']);

export function createApp({ repo, logger, metrics, info }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Un único salto: el reverse proxy (Caddy).
  app.locals.draining = false;

  app.use(helmet());
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => QUIET_PATHS.has(req.url) } }));
  app.use(metrics.middleware);
  app.use(express.json({ limit: '10kb' }));

  // Liveness: el proceso responde. No depende de la base de datos.
  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

  // Readiness: puede recibir tráfico (DB accesible y no está drenando conexiones).
  app.get('/readyz', async (req, res) => {
    if (req.app.locals.draining) return res.status(503).json({ status: 'draining' });
    try {
      await repo.ping();
      res.json({ status: 'ready' });
    } catch (err) {
      req.log.warn({ err }, 'readiness check fallido');
      res.status(503).json({ status: 'unavailable' });
    }
  });

  app.get('/metrics', metrics.handler);
  app.get('/api/version', (_req, res) => res.json(info));
  app.use('/api/tasks', tasksRouter(repo));

  app.use((_req, res) => res.status(404).json({ error: 'not_found' }));

  app.use((err, req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_json' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'payload_too_large' });
    req.log.error({ err }, 'error no controlado');
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}
