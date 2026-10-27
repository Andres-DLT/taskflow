// Cliente HTTP mínimo. Las rutas son relativas: el reverse proxy enruta /api al backend.
async function request(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Error ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  listTasks: () => request('/api/tasks'),
  createTask: (title) => request('/api/tasks', { method: 'POST', body: JSON.stringify({ title }) }),
  updateTask: (id, changes) =>
    request(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(changes) }),
  deleteTask: (id) => request(`/api/tasks/${id}`, { method: 'DELETE' }),
  version: () => request('/api/version'),
};
