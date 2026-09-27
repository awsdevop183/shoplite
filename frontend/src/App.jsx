import { useEffect, useMemo, useState } from 'react';
import { getProducts, addProduct, updateProduct, deleteProduct } from './api.js';

const LOW_STOCK = 10;

const money = (n) => Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

function stockStatus(stock) {
  if (stock <= 0) return { key: 'out', label: 'Out of stock', tone: 'danger' };
  if (stock < LOW_STOCK) return { key: 'low', label: 'Low stock', tone: 'warning' };
  return { key: 'in', label: 'In stock', tone: 'success' };
}

function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <div className="brand">
          <span className="brand-logo">S</span>
          <span className="brand-name">ShopLite</span>
        </div>
        <div className="nav-links">
          <span className="nav-link active">Inventory</span>
        </div>
        <div className="user">
          <span className="avatar">AD</span>
          <span className="user-name">Admin</span>
        </div>
      </div>
    </nav>
  );
}

function StatCard({ label, value, hint, tone }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className={'stat-value' + (tone ? ' ' + tone : '')}>{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ProductForm({ product, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: product?.name ?? '',
    price: product?.price ?? '',
    stock: product?.stock ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave({ name: form.name.trim(), price: form.price, stock: form.stock || 0 });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div className="modal-body">
        <label className="field">
          <span>Product name</span>
          <input name="name" required maxLength={100} autoFocus value={form.name} onChange={update} placeholder="e.g. Wireless Mouse" />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Price (USD)</span>
            <input name="price" type="number" step="0.01" min="0" required value={form.price} onChange={update} placeholder="0.00" />
          </label>
          <label className="field">
            <span>Stock</span>
            <input name="stock" type="number" min="0" value={form.stock} onChange={update} placeholder="0" />
          </label>
        </div>
        {error && <p className="form-error">{error}</p>}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : product ? 'Save changes' : 'Add product'}
        </button>
      </div>
    </form>
  );
}

export default function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  // null = closed, {} = add, {id,...} = edit
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [toast, setToast] = useState(null);

  const notify = (text, tone = 'success') => {
    setToast({ text, tone, id: Date.now() });
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const load = async () => {
    try {
      setProducts(await getProducts());
      setLoadError('');
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const units = products.reduce((sum, p) => sum + Number(p.stock), 0);
    const value = products.reduce((sum, p) => sum + Number(p.price) * Number(p.stock), 0);
    const attention = products.filter((p) => stockStatus(p.stock).key !== 'in').length;
    return { count: products.length, units, value, attention };
  }, [products]);

  const visible = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.trim().toLowerCase());
    const matchesFilter = filter === 'all' || stockStatus(p.stock).key === filter;
    return matchesSearch && matchesFilter;
  });

  const save = async (data) => {
    if (editing.id) {
      await updateProduct(editing.id, data);
      notify(`"${data.name}" updated`);
    } else {
      await addProduct(data);
      notify(`"${data.name}" added`);
    }
    setEditing(null);
    load();
  };

  const confirmDelete = async () => {
    try {
      await deleteProduct(deleting.id);
      notify(`"${deleting.name}" deleted`);
      load();
    } catch (err) {
      notify('Could not delete: ' + err.message, 'danger');
    }
    setDeleting(null);
  };

  return (
    <>
      <Navbar />
      <main className="page">
        <header className="page-header">
          <div>
            <h1>Products</h1>
            <p className="muted">Manage your store's catalog and stock levels.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setEditing({})}>+ Add product</button>
        </header>

        <section className="stats">
          <StatCard label="Total products" value={stats.count} />
          <StatCard label="Units in stock" value={stats.units.toLocaleString('en-US')} />
          <StatCard label="Inventory value" value={money(stats.value)} />
          <StatCard
            label="Needs attention"
            value={stats.attention}
            hint="Low or out of stock"
            tone={stats.attention > 0 ? 'warning' : ''}
          />
        </section>

        <section className="card">
          <div className="toolbar">
            <input
              className="search"
              type="search"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by stock">
              <option value="all">All products</option>
              <option value="in">In stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
          </div>

          {loadError && (
            <div className="banner">
              <span>Couldn't load products: {loadError}</span>
              <button className="btn btn-ghost btn-sm" onClick={load}>Retry</button>
            </div>
          )}

          <div className="table-wrap">
            <table className="products">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="num">Price</th>
                  <th className="num">Stock</th>
                  <th>Status</th>
                  <th className="actions-col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => {
                  const status = stockStatus(p.stock);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="product-cell">
                          <span className="thumb">{p.name.charAt(0).toUpperCase()}</span>
                          <div>
                            <div className="product-name">{p.name}</div>
                            <div className="muted small">SKU-{String(p.id).padStart(4, '0')}</div>
                          </div>
                        </div>
                      </td>
                      <td className="num" data-label="Price">{money(p.price)}</td>
                      <td className="num" data-label="Stock">{p.stock}</td>
                      <td data-label="Status"><span className={'badge ' + status.tone}>{status.label}</span></td>
                      <td className="actions-col">
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(p)}>Edit</button>
                        <button className="btn btn-danger-ghost btn-sm" onClick={() => setDeleting(p)}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {loading && <p className="empty">Loading products…</p>}
            {!loading && !loadError && visible.length === 0 && (
              <p className="empty">
                {products.length === 0 ? 'No products yet. Add your first one.' : 'No products match your search.'}
              </p>
            )}
          </div>
        </section>
      </main>

      {editing && (
        <Modal title={editing.id ? 'Edit product' : 'Add product'} onClose={() => setEditing(null)}>
          <ProductForm product={editing.id ? editing : null} onSave={save} onCancel={() => setEditing(null)} />
        </Modal>
      )}

      {deleting && (
        <Modal title="Delete product" onClose={() => setDeleting(null)}>
          <div className="modal-body">
            <p>Delete <strong>{deleting.name}</strong>? This can't be undone.</p>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setDeleting(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={confirmDelete}>Delete</button>
          </div>
        </Modal>
      )}

      {toast && (
        <div key={toast.id} className={'toast ' + toast.tone} role="status">
          {toast.text}
        </div>
      )}
    </>
  );
}
