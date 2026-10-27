import client from 'prom-client';

// Métricas RED (Rate, Errors, Duration) por ruta, expuestas en /metrics para Prometheus.
export function createMetrics({ collectDefault = true } = {}) {
  const registry = new client.Registry();
  if (collectDefault) client.collectDefaultMetrics({ register: registry });

  const httpDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duración de las peticiones HTTP en segundos',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
  });

  function middleware(req, res, next) {
    const end = httpDuration.startTimer();
    res.on('finish', () => {
      // Plantilla de la ruta (/api/tasks/:id) en lugar de la URL real, para acotar la cardinalidad.
      const route = req.route ? `${req.baseUrl}${req.route.path}` : 'unmatched';
      end({ method: req.method, route, status_code: res.statusCode });
    });
    next();
  }

  async function handler(_req, res) {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  }

  return { registry, middleware, handler };
}
