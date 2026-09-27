// VITE_API_URL comes from frontend/.env and is baked in at BUILD time (npm run build).
// Empty (default): calls go to /api on the same server, and Nginx proxies them
// to the backend. Otherwise the browser calls the backend directly at this URL.
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function request(path, options) {
  const res = await fetch(API_URL + path, options);
  // Nginx returns an HTML page (not JSON) for errors like 502 Bad Gateway
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status} ${res.statusText}` }));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const getHealth = async () => {
  // /api/health answers 503 when the DB is down but still sends useful JSON.
  // Anything that isn't JSON (e.g. Nginx 502) means the backend is unreachable.
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
