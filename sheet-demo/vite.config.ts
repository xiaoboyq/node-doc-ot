import { defineConfig } from 'vite';
export default defineConfig({ server: { port: 5173, proxy: { '/health': 'http://localhost:8787' } }, optimizeDeps: { include: ['sharedb/lib/client'] } });
