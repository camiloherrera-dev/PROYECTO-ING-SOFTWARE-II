import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    // Todas las llamadas /api/* van a Kong (:8000): así se evita CORS en desarrollo
    proxy: { '/api': 'http://localhost:8000' },
  },
});