import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const apiTarget = process.env.CARRITO_API_PROXY || 'http://localhost:8000';

export default defineConfig({
  plugins: [vue()],
  server: {
    // Puerto fijo del contrato del Host App v1.2: el 5173 es de Catálogo.
    port: 5175,
    strictPort: true,
    // Todas las llamadas /api/* van a Kong: así se evita CORS en desarrollo.
    // Si Kong corre en otro puerto (KONG_PROXY_PORT), arranca con CARRITO_API_PROXY=http://localhost:8100
    proxy: { '/api': { target: apiTarget, changeOrigin: true } },
  },
});
