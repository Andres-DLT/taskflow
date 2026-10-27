import pino from 'pino';

// Logs JSON estructurados a stdout: el runtime de contenedores se encarga del transporte.
export function createLogger({ level = 'info', version = 'dev' } = {}) {
  return pino({
    level,
    base: { service: 'taskflow-api', version },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: ['req.headers.authorization', 'req.headers.cookie'],
  });
}
