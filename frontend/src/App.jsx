import { useEffect, useState } from 'react';
import { getHealth, getProducts, addProduct, updateProduct, deleteProduct } from './api.js';

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
      // Nginx could not reach the backend (502/504), or Nginx itself is down
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
          <p>API: <code>/api</code> (proxied by Nginx)</p>
          <p>Runtime: <code>{reachable === false ? 'unreachable' : reachable ? 'Node.js' : '-'}</code></p>
        </div>
        <div className="arrow">→</div>
        <div className="tier">
          <h2>3 · Database</h2>
          <Badge up={reachable === false ? false : db ? db.status === 'up' : null} />
          <p>Engine: <code>MySQL</code></p>
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

  // The row being edited: { id, name, price, stock }, or null
  const [editing, setEditing] = useState(null);

  const updateEditing = (e) => setEditing({ ...editing, [e.target.name]: e.target.value });

  const save = async () => {
    try {
      await updateProduct(editing.id, { name: editing.name, price: editing.price, stock: editing.stock || 0 });
    } catch (err) {
      setMessage({ text: 'Could not update product: ' + err.message, error: true });
      return;
    }
    setEditing(null);
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
              {products.map((p) =>
                editing?.id === p.id ? (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td><input name="name" required maxLength={100} value={editing.name} onChange={updateEditing} /></td>
                    <td><input name="price" type="number" step="0.01" min="0" value={editing.price} onChange={updateEditing} /></td>
                    <td><input name="stock" type="number" min="0" value={editing.stock} onChange={updateEditing} /></td>
                    <td className="actions">
                      <button onClick={save}>Save</button>
                      <button className="secondary" onClick={() => setEditing(null)}>Cancel</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.name}</td>
                    <td>${Number(p.price).toFixed(2)}</td>
                    <td>{p.stock}</td>
                    <td className="actions">
                      <button className="secondary" onClick={() => setEditing({ ...p })}>Edit</button>
                      <button className="danger" onClick={() => remove(p.id)}>Delete</button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
