// The browser always calls /api on the same server that served this page.
// Nginx forwards /api to the backend's private IP (see nginx/shoplite.conf),
// so no backend address is ever built into the app or shown to users.

async function request(path, options) {
  const res = await fetch(path, options);
  // Nginx returns an HTML page (not JSON) for errors like 502 Bad Gateway
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status} ${res.statusText}` }));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

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

export const deleteProduct = (id) => request(`/api/products/${id}`, { method: 'DELETE' });
