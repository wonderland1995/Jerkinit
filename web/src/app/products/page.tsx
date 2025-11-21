'use client';

import { useCallback, useEffect, useState } from 'react';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useToast } from '@/components/ToastProvider';
import type { Product } from '@/types/inventory';

interface ProductFormState {
  name: string;
  code: string;
  description: string;
  active: boolean;
}

const defaultForm: ProductFormState = {
  name: '',
  code: '',
  description: '',
  active: true,
};

export default function ProductsPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProductFormState>(defaultForm);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/products', { cache: 'no-store' });
      const data = (await res.json()) as { products?: Product[] };
      setProducts(Array.isArray(data.products) ? data.products : []);
    } catch (error) {
      console.error('Failed to load products', error);
      toast.error('Unable to load products.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      toast.error('Name and code are required.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          code: form.code.trim(),
          description: form.description.trim() || null,
          active: form.active,
        }),
      });
      const body = (await res.json()) as { product?: Product; error?: string };
      if (!res.ok || !body.product) {
        toast.error(body.error ?? 'Failed to create product.');
        return;
      }

      setProducts((prev) => [...prev, body.product!].sort((a, b) => a.name.localeCompare(b.name)));
      setForm(defaultForm);
      toast.success('Product added.');
    } catch (error) {
      console.error('Failed to create product', error);
      toast.error('Unable to create product.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Products', href: '/products' },
        ]}
      />

      <div className="flex flex-col gap-6">
        <section className="rounded-2xl bg-white p-6 shadow">
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
          <p className="mt-1 text-sm text-gray-600">
            Create a product first, then link it to recipes so batches stay organized.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. Signature Spicy Jerky"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Code</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 uppercase focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="SPC-001"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                rows={3}
                placeholder="Optional notes"
              />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Active
            </label>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Add product'}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-xl font-semibold text-gray-900">Existing products</h2>
          {loading ? (
            <p className="mt-4 text-gray-500">Loading…</p>
          ) : products.length === 0 ? (
            <p className="mt-4 text-gray-500">No products have been created yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Name</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Code</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Description</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td className="px-3 py-3 font-medium text-gray-900">{product.name}</td>
                      <td className="px-3 py-3 font-mono text-gray-700">{product.code}</td>
                      <td className="px-3 py-3 text-gray-600">
                        {product.description || <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            product.active
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {product.active ? 'Active' : 'Archived'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
