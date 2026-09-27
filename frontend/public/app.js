// Runs in the viewer's BROWSER. It calls the backend directly using
// API_URL, which the frontend server injects via /config.js.
const API = window.APP_CONFIG.API_URL.replace(/\/$/, '');

const $ = (id) => document.getElementById(id);

function setBadge(el, up) {
  el.textContent = up ? 'UP' : 'DOWN';
  el.className = 'badge ' + (up ? 'up' : 'down');
}

function showMessage(text, isError) {
  $('message').textContent = text;
  $('message').className = 'message' + (isError ? ' error' : '');
}

async function checkHealth() {
  $('fe-host').textContent = window.APP_CONFIG.FRONTEND_HOST;
  $('be-url').textContent = API;
  try {
    const res = await fetch(API + '/api/health');
    const data = await res.json();
    setBadge($('be-status'), true);
    $('be-host').textContent = data.backend.hostname;
    setBadge($('db-status'), data.database.status === 'up');
    $('db-host').textContent = data.database.host;
    $('db-version').textContent = data.database.version || ('error: ' + data.database.error);
  } catch (err) {
    // Browser could not reach the backend at all (service down, wrong IP, port blocked by security group...)
    setBadge($('be-status'), false);
    setBadge($('db-status'), false);
    $('be-host').textContent = 'unreachable';
    $('db-host').textContent = 'unknown';
    $('db-version').textContent = '-';
  }
}

async function loadProducts() {
  const tbody = $('products');
  tbody.innerHTML = '';
  try {
    const res = await fetch(API + '/api/products');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showMessage(data.length + ' product(s) loaded.');
    for (const p of data) {
      const tr = document.createElement('tr');
      for (const value of [p.id, p.name, '$' + Number(p.price).toFixed(2), p.stock]) {
        const td = document.createElement('td');
        td.textContent = value;
        tr.appendChild(td);
      }
      const td = document.createElement('td');
      const btn = document.createElement('button');
      btn.textContent = 'Delete';
      btn.className = 'danger';
      btn.onclick = () => deleteProduct(p.id);
      td.appendChild(btn);
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
  } catch (err) {
    showMessage('Could not load products: ' + err.message, true);
  }
}

async function deleteProduct(id) {
  await fetch(API + '/api/products/' + id, { method: 'DELETE' });
  loadProducts();
}

$('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const body = {
    name: form.name.value,
    price: form.price.value,
    stock: form.stock.value || 0,
  };
  try {
    const res = await fetch(API + '/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    form.reset();
    loadProducts();
  } catch (err) {
    showMessage('Could not add product: ' + err.message, true);
  }
});

$('refresh-health').addEventListener('click', () => {
  checkHealth();
  loadProducts();
});

checkHealth();
loadProducts();
