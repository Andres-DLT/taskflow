import { REPO_URL } from './config.js';

const ARCHITECTURE = [
  { name: 'Tu navegador', detail: 'Esta página (React)' },
  { name: 'Caddy', detail: 'HTTPS y reparto de carga' },
  { name: 'API Node.js', detail: '2 réplicas en producción' },
  { name: 'PostgreSQL', detail: 'Datos, con backup diario' },
];

const PIPELINE = [
  {
    title: 'Cambio en el portátil',
    text: 'Se programa y se prueba en local con Docker, igual que en producción.',
  },
  {
    title: 'Pull Request → CI',
    text: 'GitHub ejecuta tests, tests con base de datos real y busca contraseñas filtradas.',
  },
  {
    title: 'Seguridad',
    text: 'Trivy analiza las imágenes y bloquea el despliegue si hay vulnerabilidades graves.',
  },
  {
    title: 'Imagen firmada',
    text: 'Se construye la imagen Docker, con su inventario de software (SBOM) y una firma digital.',
  },
  {
    title: 'Staging',
    text: 'Se despliega sola en un entorno de pruebas y se verifica con smoke tests.',
  },
  {
    title: 'Producción',
    text: 'Tras una aprobación manual, despliegue blue/green sin cortar el servicio.',
  },
];

const SAFETY_NET = [
  'Si los smoke tests fallan, vuelve sola a la versión anterior.',
  'Backup de la base de datos antes de cada despliegue y cada noche.',
  'Monitorización 24/7 con alertas si sube la tasa de errores o cae el servicio.',
];

function StatusRow({ label, children }) {
  return (
    <div className="status-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default function HowItWorks({ info, healthy }) {
  const commit = info?.commit ?? '';
  const isLocal = !commit || commit === 'local';

  return (
    <section className="how" aria-label="Cómo funciona">
      <p className="lead">
        La app es sencilla a propósito: lo que demuestra es el <strong>camino</strong> que recorre un
        cambio desde un portátil hasta producción, de forma automática, segura y verificada.
      </p>

      <h2>Esta página, ahora mismo</h2>
      <dl className="status-grid">
        <StatusRow label="Estado">
          <span className={healthy ? 'ok' : 'down'}>
            {healthy === null ? 'comprobando…' : healthy ? 'API y base de datos OK' : 'sin conexión'}
          </span>
        </StatusRow>
        <StatusRow label="Entorno">{info?.environment ?? '—'}</StatusRow>
        <StatusRow label="Versión">{info?.version ?? '—'}</StatusRow>
        <StatusRow label="Commit">
          {isLocal ? (
            'local (no construido por el pipeline)'
          ) : (
            <a href={`${REPO_URL}/commit/${commit}`} target="_blank" rel="noreferrer">
              {commit.slice(0, 7)}
            </a>
          )}
        </StatusRow>
        <StatusRow label="Réplica">{info?.instance ?? '—'}</StatusRow>
      </dl>

      <h2>Arquitectura</h2>
      <ol className="arch">
        {ARCHITECTURE.map((node) => (
          <li key={node.name}>
            <strong>{node.name}</strong>
            <span>{node.detail}</span>
          </li>
        ))}
      </ol>

      <h2>Recorrido de un cambio</h2>
      <ol className="steps">
        {PIPELINE.map((step) => (
          <li key={step.title}>
            <strong>{step.title}</strong>
            <span>{step.text}</span>
          </li>
        ))}
      </ol>

      <h2>Si algo sale mal</h2>
      <ul className="safety">
        {SAFETY_NET.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <p className="links">
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          Ver el código
        </a>
        <a href={`${REPO_URL}/actions`} target="_blank" rel="noreferrer">
          Ver el pipeline en acción
        </a>
      </p>
    </section>
  );
}
