// VITE_API_URL comes from frontend/.env and is baked in at BUILD time (npm run build).
// The browser calls the backend directly at this address.
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

async function request(path, options) {
  const res = await fetch(API_URL + path, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const getHealth = async () => {
  // /api/health answers 503 when the DB is down but still sends useful JSON
  const res = await fetch(API_URL + '/api/health');
  return res.json();
};

export const getProducts = () => request('/api/products');

export const addProduct = (product) =>
  request('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  });

export const updateProduct = (id, product) =>
  request(`/api/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  });

export const deleteProduct =(id) => request(`/api/products/${id}`, { method: 'DELETE' });
