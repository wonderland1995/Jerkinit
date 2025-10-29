// src/app/inventory/beef/receive/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useToast } from '@/components/ToastProvider';
import type { Material, Supplier } from '@/types/inventory';

type Unit = 'g' | 'kg';

type BeefReceiveForm = {
  material_id: string;
  supplier_id: string | null;
  lot_number: string;
  internal_lot_code: string;
  received_date: string;
  expiry_date: string | null;
  quantity: number;
  unit: Unit;
  unit_cost: number | null;
  storage_location: string | null;
  receiving_temp_c: number;
  packaging_intact: boolean;
  odour_ok: boolean;
  visual_ok: boolean;
  notes: string | null;
};

export default function BeefReceivePage() {
  const router = useRouter();
  const toast = useToast();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [saving, setSaving] = useState(false);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [form, setForm] = useState<BeefReceiveForm>({
    material_id: '',
    supplier_id: null,
    lot_number: '',
    internal_lot_code: '',
    received_date: today,
    expiry_date: null,
    quantity: 0,
    unit: 'kg',
    unit_cost: null,
    storage_location: null,
    receiving_temp_c: 4,
    packaging_intact: true,
    odour_ok: true,
    visual_ok: true,
    notes: null,
  });

  // Load beef materials + suppliers
  useEffect(() => {
    (async () => {
      const [mRes, sRes] = await Promise.all([fetch('/api/materials'), fetch('/api/suppliers')]);
      const mJson = (await mRes.json()) as { materials?: Material[] };
      const sJson = (await sRes.json()) as { suppliers?: Supplier[] };
      const beefMats = (mJson.materials ?? []).filter(m => m.category === 'beef');
      setMaterials(beefMats);
      setSuppliers(sJson.suppliers ?? []);
      // pick the first beef material by default
      if (beefMats.length > 0 && !form.material_id) {
        setForm(f => ({ ...f, material_id: beefMats[0].id, unit: 'kg' }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const passRule = useMemo(() => {
    return (
      form.receiving_temp_c <= 5 &&
      form.packaging_intact &&
      form.odour_ok &&
      form.visual_ok
    );
  }, [form.receiving_temp_c, form.packaging_intact, form.odour_ok, form.visual_ok]);

  const canSave = useMemo(() => {
    return (
      form.material_id &&
      form.lot_number.trim().length > 0 &&
      form.received_date &&
      form.quantity > 0
    );
  }, [form.material_id, form.lot_number, form.received_date, form.quantity]);

  const gramsPreview = useMemo(() => (form.unit === 'kg' ? form.quantity * 1000 : form.quantity), [form.quantity, form.unit]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);

    try {
      const res = await fetch('/api/lots/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok && res.status !== 207) {
        const errJson = (await res.json().catch(() => ({ error: 'Failed' }))) as { error?: string };
        toast.error(errJson.error ?? 'Failed to receive beef');
        setSaving(false);
        return;
      }

      const okJson = (await res.json().catch(() => ({}))) as { id?: string; internal_lot_code?: string; warning?: string };
      if (okJson.warning) {
        console.warn(okJson.warning);
      }

      toast.success('Beef lot received', {
        description: okJson.internal_lot_code ? `Internal code: ${okJson.internal_lot_code}` : undefined,
      });
      router.push('/inventory'); // tweak destination as you like
    } catch (err) {
      console.error(err);
      toast.error('Failed to receive beef');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-6">
        <Breadcrumbs items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Inventory', href: '/inventory' },
          { label: 'Receive Beef', href: '/inventory/beef/receive' }
        ]} />

        <h1 className="text-3xl font-bold mb-6">Receive Beef</h1>

        <form onSubmit={onSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Material + Supplier */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Beef Material *</label>
              <select
                required
                value={form.material_id}
                onChange={(e) => setForm(f => ({ ...f, material_id: e.target.value }))}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Select beef material…</option>
                {materials.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.material_code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
              <select
                value={form.supplier_id ?? ''}
                onChange={(e) => setForm(f => ({ ...f, supplier_id: e.target.value || null }))}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">—</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Lot info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Lot # *</label>
              <input
                required
                value={form.lot_number}
                onChange={(e) => setForm(f => ({ ...f, lot_number: e.target.value }))}
                className="w-full border rounded px-3 py-2"
                placeholder="e.g. ABC123"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Internal Lot Code</label>
              <input
                value={form.internal_lot_code}
                onChange={(e) => setForm(f => ({ ...f, internal_lot_code: e.target.value }))}
                className="w-full border rounded px-3 py-2"
                placeholder="Leave blank to auto-generate"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Storage Location</label>
              <input
                value={form.storage_location ?? ''}
                onChange={(e) => setForm(f => ({ ...f, storage_location: e.target.value || null }))}
                className="w-full border rounded px-3 py-2"
                placeholder="e.g. Coolroom A, Shelf 3"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Received Date *</label>
              <input
                type="date"
                required
                value={form.received_date}
                onChange={(e) => setForm(f => ({ ...f, received_date: e.target.value }))}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
              <input
                type="date"
                value={form.expiry_date ?? ''}
                onChange={(e) => setForm(f => ({ ...f, expiry_date: e.target.value || null }))}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Cost (optional)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.unit_cost ?? ''}
                onChange={(e) => setForm(f => ({ ...f, unit_cost: e.target.value ? Number(e.target.value) : null }))}
                className="w-full border rounded px-3 py-2"
                placeholder="$ per kg"
              />
            </div>
          </div>

          {/* Quantity */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={form.quantity}
                onChange={(e) => setForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                className="w-full border rounded px-3 py-2"
                placeholder="e.g. 120"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
              <select
                value={form.unit}
                onChange={(e) => setForm(f => ({ ...f, unit: e.target.value as Unit }))}
                className="w-full border rounded px-3 py-2"
              >
                <option value="kg">kg</option>
                <option value="g">g</option>
              </select>
            </div>
            <div className="flex items-end">
              <div className="text-sm text-gray-600">
                <span className="font-medium">Preview:</span> {gramsPreview.toLocaleString()} g stored
              </div>
            </div>
          </div>

          {/* QA on receipt */}
          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Receiving QA</h2>
              <span className={`px-3 py-1 rounded-full text-sm ${passRule ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {passRule ? 'PASS' : 'REVIEW'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Temperature (°C) *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={form.receiving_temp_c}
                  onChange={(e) => setForm(f => ({ ...f, receiving_temp_c: Number(e.target.value) }))}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <label className="flex items-center gap-2 mt-7">
                <input
                  type="checkbox"
                  checked={form.packaging_intact}
                  onChange={(e) => setForm(f => ({ ...f, packaging_intact: e.target.checked }))}
                />
                <span className="text-sm">Packaging intact</span>
              </label>
              <label className="flex items-center gap-2 mt-7">
                <input
                  type="checkbox"
                  checked={form.odour_ok}
                  onChange={(e) => setForm(f => ({ ...f, odour_ok: e.target.checked }))}
                />
                <span className="text-sm">Odour OK</span>
              </label>
              <label className="flex items-center gap-2 mt-7">
                <input
                  type="checkbox"
                  checked={form.visual_ok}
                  onChange={(e) => setForm(f => ({ ...f, visual_ok: e.target.checked }))}
                />
                <span className="text-sm">Visual OK</span>
              </label>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                rows={3}
                value={form.notes ?? ''}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value || null }))}
                className="w-full border rounded px-3 py-2"
                placeholder="Optional observations (e.g. MSA grade sighted, packaging lot marks, photos stored elsewhere)"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !canSave}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Receive Beef'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
