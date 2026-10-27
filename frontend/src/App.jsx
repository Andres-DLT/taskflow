import { useEffect, useState } from 'react';
import { api } from './api.js';

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

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(null);

  useEffect(() => {
    api
      .listTasks()
      .then(setTasks)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    api.version().then(setVersion).catch(() => {});
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!title.trim()) return;
    try {
      const task = await api.createTask(title);
      setTasks((current) => [task, ...current]);
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

  return (
    <main className="container">
      <header>
        <h1>TaskFlow</h1>
        <p className="muted">{loading ? 'Cargando…' : `${pending} pendientes de ${tasks.length}`}</p>
      </header>

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

      <ul className="tasks">
        {tasks.map((task) => (
          <TaskItem key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} />
        ))}
      </ul>

      <footer className="muted">
        {version ? `v${version.version} · ${version.commit.slice(0, 7)}` : 'versión desconocida'}
      </footer>
    </main>
  );
}
