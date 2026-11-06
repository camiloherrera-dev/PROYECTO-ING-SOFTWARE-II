const BASE = '/api/carrito';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`, // RNF-01
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const mensaje = res.status === 401
      ? 'Tu sesión expiró. Vuelve a iniciar sesión.'
      : data?.mensaje || 'Ocurrió un error inesperado';
    throw { ...data, status: res.status, codigo: data?.codigo, mensaje };
  }
  return data;
}

export const getCart = () => request('');
export const addItem = (productId, cantidad) =>
  request('/items', { method: 'POST', body: JSON.stringify({ productId, cantidad }) });
export const updateQuantity = (productId, cantidad) =>
  request(`/items/${encodeURIComponent(productId)}`, { method: 'PUT', body: JSON.stringify({ cantidad }) });


// Sprint 2
export const removeItem = (productId) =>
  request(`/items/${encodeURIComponent(productId)}`, { method: 'DELETE' }); // HU-04
export const clearCart = () => request('', { method: 'DELETE' });           // HU-05
// Sprint 3
export const checkAvailability = () => request('/disponibilidad');                 // HU-09
export const createCheckout = () => request('/checkout', { method: 'POST' });      // HU-08
export const confirmCheckout = (checkoutId) =>
  request(`/checkout/${encodeURIComponent(checkoutId)}/confirmar`, { method: 'POST' }); // HU-10