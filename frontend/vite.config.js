import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiTarget = process.env.VITE_API_PROXY ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Mismo enrutado que Caddy en producción: la API local atiende /api y los health checks.
    proxy: {
      '/api': apiTarget,
      '/healthz': apiTarget,
      '/readyz': apiTarget,
    },
  },
  build: {
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
  },
});
