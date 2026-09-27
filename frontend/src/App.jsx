import { useEffect, useState } from 'react';
import { API_URL, getHealth, getProducts, addProduct, deleteProduct } from './api.js';

function Badge({ up }) {
  if (up === null) return <span className="badge">…</span>;
  return <span className={'badge ' + (up ? 'up' : 'down')}>{up ? 'UP' : 'DOWN'}</span>;
}

function TierStatus({ onRecheck }) {
  const [health, setHealth] = useState(null);
  const [reachable, setReachable] = useState(null);

  const check = async () => {
    try {
      setHealth(await getHealth());
      setReachable(true);
    } catch {
      // Browser could not reach the backend at all
      // (service down, wrong IP, port blocked by security group...)
      setHealth(null);
      setReachable(false);
    }
  };

  useEffect(() => {
    check();
  }, []);

  const db = health?.database;
  return (
    <>
      <section className="tiers">
        <div className="tier">
          <h2>1 · Frontend</h2>
          <Badge up={true} />
          <p>Served by: <code>Nginx</code></p>
          <p>Address: <code>{window.location.host}</code></p>
        </div>
        <div className="arrow">→</div>
        <div className="tier">
          <h2>2 · Backend</h2>
          <Badge up={reachable} />
          <p>API: <code>{API_URL}</code></p>
          <p>Host: <code>{reachable === false ? 'unreachable' : health?.backend.hostname || '-'}</code></p>
        </div>
        <div className="arrow">→</div>
        <div className="tier">
          <h2>3 · Database</h2>
          <Badge up={reachable === false ? false : db ? db.status === 'up' : null} />
          <p>Host: <code>{db?.host || 'unknown'}</code></p>
          <p>Version: <code>{db ? db.version || 'error: ' + db.error : '-'}</code></p>
        </div>
      </section>
      <button className="secondary" onClick={() => { check(); onRecheck(); }}>↻ Re-check connections</button>
    </>
  );
}

function AddProductForm({ onAdded, onError }) {
  const empty = { name: '', price: '', stock: '' };
  const [form, setForm] = useState(empty);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try {
      await addProduct({ name: form.name, price: form.price, stock: form.stock || 0 });
      setForm(empty);
      onAdded();
    } catch (err) {
      onError('Could not add product: ' + err.message);
    }
  };

  return (
    <section className="card">
      <h2>Add a product</h2>
      <form onSubmit={submit}>
        <input name="name" placeholder="Product name" required maxLength={100} value={form.name} onChange={update} />
        <input name="price" type="number" step="0.01" min="0" placeholder="Price" required value={form.price} onChange={update} />
        <input name="stock" type="number" min="0" placeholder="Stock" value={form.stock} onChange={update} />
        <button type="submit">Add</button>
      </form>
    </section>
  );
}

export default function App() {
  const [products, setProducts] = useState([]);
  const [message, setMessage] = useState({ text: '', error: false });

  const load = async () => {
    try {
      const data = await getProducts();
      setProducts(data);
      setMessage({ text: `${data.length} product(s) loaded.`, error: false });
    } catch (err) {
      setProducts([]);
      setMessage({ text: 'Could not load products: ' + err.message, error: true });
    }
  };

  const remove = async (id) => {
    try {
      await deleteProduct(id);
    } catch (err) {
      setMessage({ text: 'Could not delete product: ' + err.message, error: true });
      return;
    }
    load();
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <header>
        <h1>🛒 ShopLite</h1>
        <p>A simple 3-tier app: React + Nginx → Node.js API → MySQL, each on its own EC2 instance</p>
      </header>
      <main>
        <TierStatus onRecheck={load} />
        <AddProductForm onAdded={load} onError={(text) => setMessage({ text, error: true })} />
        <section className="card">
          <h2>Products <small>(rows read from MySQL through the API)</small></h2>
          <p className={'message' + (message.error ? ' error' : '')}>{message.text}</p>
          <table>
            <thead>
              <tr><th>ID</th><th>Name</th><th>Price</th><th>Stock</th><th></th></tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{p.name}</td>
                  <td>${Number(p.price).toFixed(2)}</td>
                  <td>{p.stock}</td>
                  <td><button className="danger" onClick={() => remove(p.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
