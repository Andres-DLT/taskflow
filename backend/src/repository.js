const COLUMNS = 'id, title, done, created_at AS "createdAt", updated_at AS "updatedAt"';

export function createPgTaskRepository(pool) {
  return {
    async list() {
      const { rows } = await pool.query(
        `SELECT ${COLUMNS} FROM tasks ORDER BY created_at DESC, id DESC LIMIT 500`,
      );
      return rows;
    },
    async create(title) {
      const { rows } = await pool.query(
        `INSERT INTO tasks (title) VALUES ($1) RETURNING ${COLUMNS}`,
        [title],
      );
      return rows[0];
    },
    async update(id, { title, done }) {
      const { rows } = await pool.query(
        `UPDATE tasks
            SET title = COALESCE($2, title), done = COALESCE($3, done), updated_at = now()
          WHERE id = $1
        RETURNING ${COLUMNS}`,
        [id, title ?? null, done ?? null],
      );
      return rows[0] ?? null;
    },
    async remove(id) {
      const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
      return rowCount > 0;
    },
    async ping() {
      await pool.query('SELECT 1');
    },
  };
}

// Implementación en memoria para tests unitarios (misma interfaz que la de PostgreSQL).
export function createMemoryTaskRepository() {
  const tasks = new Map();
  let nextId = 1;
  return {
    async list() {
      return [...tasks.values()].reverse();
    },
    async create(title) {
      const now = new Date().toISOString();
      const task = { id: nextId++, title, done: false, createdAt: now, updatedAt: now };
      tasks.set(task.id, task);
      return task;
    },
    async update(id, { title, done }) {
      const task = tasks.get(id);
      if (!task) return null;
      Object.assign(task, {
        title: title ?? task.title,
        done: done ?? task.done,
        updatedAt: new Date().toISOString(),
      });
      return task;
    },
    async remove(id) {
      return tasks.delete(id);
    },
    async ping() {},
  };
}
