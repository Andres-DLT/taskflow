import { Router } from 'express';

const MAX_TITLE = 200;

function parseId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 && id <= 2_147_483_647 ? id : null;
}

function validateTitle(title) {
  if (typeof title !== 'string') return 'title debe ser un string';
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > MAX_TITLE) return `title debe tener entre 1 y ${MAX_TITLE} caracteres`;
  return null;
}

const badRequest = (res, message) => res.status(400).json({ error: 'validation_error', message });

export function tasksRouter(repo) {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json(await repo.list());
  });

  router.post('/', async (req, res) => {
    const error = validateTitle(req.body?.title);
    if (error) return badRequest(res, error);
    res.status(201).json(await repo.create(req.body.title.trim()));
  });

  router.patch('/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return badRequest(res, 'id inválido');

    const { title, done } = req.body ?? {};
    if (title === undefined && done === undefined) return badRequest(res, 'nada que actualizar');
    if (title !== undefined) {
      const error = validateTitle(title);
      if (error) return badRequest(res, error);
    }
    if (done !== undefined && typeof done !== 'boolean') return badRequest(res, 'done debe ser boolean');

    const task = await repo.update(id, { title: title?.trim(), done });
    if (!task) return res.status(404).json({ error: 'not_found' });
    res.json(task);
  });

  router.delete('/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return badRequest(res, 'id inválido');
    const removed = await repo.remove(id);
    res.status(removed ? 204 : 404).end();
  });

  return router;
}
