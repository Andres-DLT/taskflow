import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';

const json = (body, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

const VERSION = { version: 'main', commit: 'abcdef1234567', environment: 'production', instance: 'a1b2c3' };

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url, options = {}) => {
        if (url === '/api/version') return json(VERSION);
        if (url === '/readyz') return json({ status: 'ready' });
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

  it('muestra las tareas y la versión desplegada con enlace al commit', async () => {
    render(<App />);
    expect(await screen.findByText('Configurar CI')).toBeTruthy();
    expect(screen.getByText('1 pendientes de 1')).toBeTruthy();
    const link = await screen.findByText('commit abcdef1');
    expect(link.getAttribute('href')).toBe('https://github.com/Andres-DLT/taskflow/commit/abcdef1234567');
  });

  it('añade una tarea nueva', async () => {
    render(<App />);
    await screen.findByText('Configurar CI');
    fireEvent.change(screen.getByLabelText('Nueva tarea'), { target: { value: 'Desplegar a prod' } });
    fireEvent.click(screen.getByText('Añadir'));
    expect(await screen.findByText('Desplegar a prod')).toBeTruthy();
  });

  it('explica el pipeline y el estado en vivo en "Cómo funciona"', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Cómo funciona'));
    expect(screen.getByText('Recorrido de un cambio')).toBeTruthy();
    expect(await screen.findByText('API y base de datos OK')).toBeTruthy();
    expect(screen.getByText('a1b2c3')).toBeTruthy();
    expect(screen.queryByLabelText('Nueva tarea')).toBeNull();
  });

  it('muestra un error si la API falla', async () => {
    fetch.mockImplementation(() => json({ message: 'Servicio no disponible' }, 503));
    render(<App />);
    expect((await screen.findByRole('alert')).textContent).toBe('Servicio no disponible');
    expect(await screen.findByText('Sin conexión con el servidor')).toBeTruthy();
  });
});
