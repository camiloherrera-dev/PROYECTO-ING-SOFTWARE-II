// Integración con el Host App (contrato del Host App v1.2 y v1.3). Todo lo que este módulo sabe del
// cascarón está aquí.

const HOST_APP = import.meta.env.VITE_HOST_APP || 'http://localhost:5050';

/** Dentro del Host App el módulo corre en un iframe: su ventana no es la de más arriba. */
export const embebido = window.self !== window.top;

/**
 * Espera la sesión que manda el Host App (mensaje "sesion") y deja el token donde lo lee cartApi.js
 * (localStorage 'token'). Solo se acepta del origen del Host App. También se queda escuchando: el
 * Host App vuelve a mandar la sesión cuando renueva el token, cada ~4 minutos.
 *
 * Resuelve con el primer mensaje, o a los 2 segundos si no llega ninguno.
 */
export function recibirSesion() {
  return new Promise((resolve) => {
    window.addEventListener('message', (e) => {
      if (e.origin !== HOST_APP || e.data?.tipo !== 'sesion') return;
      if (e.data.token) localStorage.setItem('token', e.data.token);
      else localStorage.removeItem('token');
      resolve();
    });
    window.parent.postMessage({ tipo: 'pedir-sesion' }, HOST_APP);
    setTimeout(resolve, 2000);
  });
}

/** Le pide al Host App que lleve al usuario a iniciar sesión. */
export function pedirLogin() {
  window.parent.postMessage({ tipo: 'iniciar-sesion' }, HOST_APP);
}

/**
 * Lee ?agregar={id} de la dirección (contrato del Host App v1.2, sección 9.1) y lo quita, para que
 * recargar la página no agregue el producto otra vez.
 */
export function tomarProductoAAgregar() {
  const parametros = new URLSearchParams(window.location.search);
  const id = parametros.get('agregar');
  if (!id) return null;
  parametros.delete('agregar');
  const resto = parametros.toString();
  window.history.replaceState(null, '', window.location.pathname + (resto ? `?${resto}` : ''));
  return id;
}

/** /carrito/pedidos abre directamente el historial: es la entrada «Órdenes» del Host App. */
export const abrirEnPedidos = window.location.pathname.startsWith('/carrito/pedidos');
