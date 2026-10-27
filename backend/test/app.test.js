import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/logger.js';
import { createMetrics } from '../src/metrics.js';
import { createMemoryTaskRepository } from '../src/repository.js';

function buildApp(repo = createMemoryTaskRepository()) {
  return createApp({
    repo,
    logger: createLogger({ level: 'silent' }),
    metrics: createMetrics({ collectDefault: false }),
    info: { version: '1.2.3', commit: 'abc123' },
  });
}

describe('endpoints operativos', () => {
  it('GET /healthz responde ok', async () => {
    const res = await request(buildApp()).get('/healthz').expect(200);
    assert.deepEqual(res.body, { status: 'ok' });
  });

  it('GET /readyz responde 200 cuando la DB está accesible', async () => {
    await request(buildApp()).get('/readyz').expect(200);
  });

  it('GET /readyz responde 503 si la DB falla', async () => {
    const repo = { ...createMemoryTaskRepository(), ping: async () => { throw new Error('down'); } };
    const res = await request(buildApp(repo)).get('/readyz').expect(503);
    assert.equal(res.body.status, 'unavailable');
  });

  it('GET /readyz responde 503 mientras drena conexiones', async () => {
    const app = buildApp();
    app.locals.draining = true;
    await request(app).get('/readyz').expect(503);
  });

  it('GET /api/version expone versión y commit', async () => {
    const res = await request(buildApp()).get('/api/version').expect(200);
    assert.deepEqual(res.body, { version: '1.2.3', commit: 'abc123' });
  });

  it('GET /metrics expone el histograma HTTP con la ruta parametrizada', async () => {
    const app = buildApp();
    await request(app).get('/api/tasks/999').expect(404);
    await request(app).get('/api/tasks').expect(200);
    const res = await request(app).get('/metrics').expect(200);
    assert.match(res.text, /http_request_duration_seconds_count\{[^}]*route="\/api\/tasks\/"/);
  });

  it('aplica cabeceras de seguridad y oculta X-Powered-By', async () => {
    const res = await request(buildApp()).get('/healthz');
    assert.equal(res.headers['x-powered-by'], undefined);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
  });

  it('devuelve 404 JSON para rutas desconocidas', async () => {
    const res = await request(buildApp()).get('/nope').expect(404);
    assert.deepEqual(res.body, { error: 'not_found' });
  });
});

describe('API /api/tasks', () => {
  let app;
  beforeEach(() => {
    app = buildApp();
  });

  it('crea, lista, actualiza y borra una tarea', async () => {
    const created = await request(app).post('/api/tasks').send({ title: '  Desplegar  ' }).expect(201);
    assert.equal(created.body.title, 'Desplegar');
    assert.equal(created.body.done, false);

    const list = await request(app).get('/api/tasks').expect(200);
    assert.equal(list.body.length, 1);

    const updated = await request(app)
      .patch(`/api/tasks/${created.body.id}`)
      .send({ done: true })
      .expect(200);
    assert.equal(updated.body.done, true);

    await request(app).delete(`/api/tasks/${created.body.id}`).expect(204);
    await request(app).delete(`/api/tasks/${created.body.id}`).expect(404);
  });

  it('valida el título', async () => {
    await request(app).post('/api/tasks').send({}).expect(400);
    await request(app).post('/api/tasks').send({ title: '   ' }).expect(400);
    await request(app).post('/api/tasks').send({ title: 'x'.repeat(201) }).expect(400);
  });

  it('valida id y campos en PATCH', async () => {
    await request(app).patch('/api/tasks/abc').send({ done: true }).expect(400);
    await request(app).patch('/api/tasks/1').send({}).expect(400);
    await request(app).patch('/api/tasks/1').send({ done: 'yes' }).expect(400);
    await request(app).patch('/api/tasks/1').send({ done: true }).expect(404);
  });

  it('rechaza JSON mal formado con 400', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Content-Type', 'application/json')
      .send('{"title":')
      .expect(400);
    assert.equal(res.body.error, 'invalid_json');
  });

  it('rechaza payloads demasiado grandes con 413', async () => {
    await request(app).post('/api/tasks').send({ title: 'x'.repeat(20_000) }).expect(413);
  });
});
