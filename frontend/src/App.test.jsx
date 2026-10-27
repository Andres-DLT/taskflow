import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';

const json = (body, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url, options = {}) => {
        if (url === '/api/version') return json({ version: '1.0.0', commit: 'abcdef1234' });
        if (url === '/api/tasks' && options.method === 'POST') {
          const { title } = JSON.parse(options.body);
          return json({ id: 2, title, done: false }, 201);
        }
        if (url === '/api/tasks') return json([{ id: 1, title: 'Configurar CI', done: false }]);
        return json({ error: 'not_found' }, 404);
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('muestra las tareas y la versión desplegada', async () => {
    render(<App />);
    expect(await screen.findByText('Configurar CI')).toBeTruthy();
    expect(await screen.findByText('v1.0.0 · abcdef1')).toBeTruthy();
    expect(screen.getByText('1 pendientes de 1')).toBeTruthy();
  });

  it('añade una tarea nueva', async () => {
    render(<App />);
    await screen.findByText('Configurar CI');
    fireEvent.change(screen.getByLabelText('Nueva tarea'), { target: { value: 'Desplegar a prod' } });
    fireEvent.click(screen.getByText('Añadir'));
    expect(await screen.findByText('Desplegar a prod')).toBeTruthy();
  });

  it('muestra un error si la API falla', async () => {
    fetch.mockImplementation(() => json({ message: 'Servicio no disponible' }, 503));
    render(<App />);
    expect((await screen.findByRole('alert')).textContent).toBe('Servicio no disponible');
  });
});
