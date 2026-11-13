import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const apiTarget = process.env.CARRITO_API_PROXY || 'http://localhost:8000';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    // Permite usar Kong en el puerto estándar o en un puerto QA aislado.
    proxy: { '/api': { target: apiTarget, changeOrigin: true } },
  },
});
