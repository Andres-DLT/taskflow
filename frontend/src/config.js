// Repositorio enlazado desde la app (código, commits y pipeline). Se puede sobrescribir en build.
export const REPO_URL = import.meta.env.VITE_REPO_URL ?? 'https://github.com/Andres-DLT/taskflow';

// Intervalos de refresco: la lista se sincroniza sola entre dispositivos.
export const TASKS_REFRESH_MS = 5_000;
export const STATUS_REFRESH_MS = 10_000;
