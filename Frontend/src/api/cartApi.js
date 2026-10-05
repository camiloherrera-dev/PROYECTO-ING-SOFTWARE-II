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
    throw { status: res.status, codigo: data?.codigo, mensaje };
  }
  return data;
}

export const getCart = () => request('');
export const addItem = (productId, cantidad) =>
  request('/items', { method: 'POST', body: JSON.stringify({ productId, cantidad }) });
export const updateQuantity = (productId, cantidad) =>
  request(`/items/${encodeURIComponent(productId)}`, { method: 'PUT', body: JSON.stringify({ cantidad }) });