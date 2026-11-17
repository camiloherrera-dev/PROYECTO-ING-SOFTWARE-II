import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { embebido, recibirSesion } from './hostApp';
import './style.css';

// Solo desarrollo: el token de prueba se guarda en .env.local
if (import.meta.env.VITE_DEV_TOKEN) localStorage.setItem('token', import.meta.env.VITE_DEV_TOKEN);

// Dentro del Host App, el token es el del login de Keycloak: se espera antes de montar, para que la
// primera llamada al backend ya salga con el usuario correcto.
if (embebido) await recibirSesion();

createApp(App).use(createPinia()).mount('#app');
