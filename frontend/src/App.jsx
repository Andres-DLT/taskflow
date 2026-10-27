import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { REPO_URL, STATUS_REFRESH_MS, TASKS_REFRESH_MS } from './config.js';
import HowItWorks from './HowItWorks.jsx';

function TaskItem({ task, onToggle, onDelete }) {
  return (
    <li className={task.done ? 'task done' : 'task'}>
      <label>
        <input type="checkbox" checked={task.done} onChange={() => onToggle(task)} />
        <span>{task.title}</span>
      </label>
      <button type="button" className="ghost" aria-label={`Borrar ${task.title}`} onClick={() => onDelete(task)}>
        ✕
      </button>
    </li>
  );
}

// Ejecuta fn al montar y cada intervalMs mientras la pestaña esté visible.
function usePolling(fn, intervalMs) {
  useEffect(() => {
    fn();
    const id = setInterval(() => {
      if (!document.hidden) fn();
    }, intervalMs);
    return () => clearInterval(id);
  }, [fn, intervalMs]);
}

function refreshTasks(setTasks, setError, setLoading) {
  return api
    .listTasks()
    .then((list) => {
      setTasks(list);
      setError(null);
    })
    .catch((err) => setError(err.message))
    .finally(() => setLoading(false));
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState(null);
  const [healthy, setHealthy] = useState(null);
  const [view, setView] = useState('tasks');

  const loadTasks = useCallback(() => refreshTasks(setTasks, setError, setLoading), []);
  const loadStatus = useCallback(() => {
    api.ready().then(() => setHealthy(true)).catch(() => setHealthy(false));
    api.version().then(setInfo).catch(() => {});
  }, []);

  usePolling(loadTasks, TASKS_REFRESH_MS);
  usePolling(loadStatus, STATUS_REFRESH_MS);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!title.trim()) return;
    try {
      const task = await api.createTask(title);
      setTasks((current) => [task, ...current.filter((t) => t.id !== task.id)]);
      setTitle('');
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleToggle(task) {
    try {
      const updated = await api.updateTask(task.id, { done: !task.done });
      setTasks((current) => current.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(task) {
    try {
      await api.deleteTask(task.id);
      setTasks((current) => current.filter((t) => t.id !== task.id));
    } catch (err) {
      setError(err.message);
    }
  }

  const pending = tasks.filter((t) => !t.done).length;
  const commit = info?.commit ?? '';

  return (
    <main className="container">
      <header>
        <h1>TaskFlow</h1>
        <p className="muted">
          <span className={healthy === false ? 'dot down' : 'dot ok'} aria-hidden="true" />
          {healthy === false ? 'Sin conexión con el servidor' : 'En línea · se sincroniza sola entre dispositivos'}
        </p>
        <nav className="tabs" aria-label="Secciones">
          <button
            type="button"
            className={view === 'tasks' ? 'tab active' : 'tab'}
            aria-pressed={view === 'tasks'}
            onClick={() => setView('tasks')}
          >
            Tareas
          </button>
          <button
            type="button"
            className={view === 'how' ? 'tab active' : 'tab'}
            aria-pressed={view === 'how'}
            onClick={() => setView('how')}
          >
            Cómo funciona
          </button>
        </nav>
      </header>

      {view === 'tasks' ? (
        <>
          <p className="hint">
            Prueba a abrir esta misma página en otro dispositivo: lo que añadas aquí aparecerá allí en
            unos segundos, porque todo se guarda en la base de datos del servidor.
          </p>

          <form onSubmit={handleSubmit} className="new-task">
            <input
              aria-label="Nueva tarea"
              placeholder="¿Qué hay que hacer?"
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <button type="submit">Añadir</button>
          </form>

          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}

          <p className="muted counter">{loading ? 'Cargando…' : `${pending} pendientes de ${tasks.length}`}</p>

          <ul className="tasks">
            {tasks.map((task) => (
              <TaskItem key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} />
            ))}
          </ul>
        </>
      ) : (
        <HowItWorks info={info} healthy={healthy} />
      )}

      <footer className="muted">
        {info ? (
          <>
            Versión {info.version} ·{' '}
            {commit && commit !== 'local' ? (
              <a href={`${REPO_URL}/commit/${commit}`} target="_blank" rel="noreferrer">
                commit {commit.slice(0, 7)}
              </a>
            ) : (
              'build local'
            )}{' '}
            · {info.environment}
          </>
        ) : (
          'versión desconocida'
        )}
      </footer>
    </main>
  );
}
