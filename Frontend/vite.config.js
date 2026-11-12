import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    // Todas las llamadas /api/* van a Kong: así se evita CORS en desarrollo.
    // Si Kong corre en otro puerto (KONG_PROXY_PORT), arranca con KONG_URL=http://localhost:8100
    proxy: { '/api': process.env.KONG_URL || 'http://localhost:8000' },
  },
});