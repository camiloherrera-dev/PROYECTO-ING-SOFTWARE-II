import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

// Solo desarrollo: el token de prueba se guarda en .env.local
if (import.meta.env.VITE_DEV_TOKEN) localStorage.setItem('token', import.meta.env.VITE_DEV_TOKEN);

createApp(App).use(createPinia()).mount('#app');