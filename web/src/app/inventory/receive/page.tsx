'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Breadcrumbs from '@/components/Breadcrumbs';
import type { Material, Supplier, ReceiveLotRequest } from '@/types/inventory';

export default function ReceiveLotPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [formData, setFormData] = useState<ReceiveLotRequest>({
    material_id: '',
    supplier_id: null,
    lot_number: '',
    received_date: new Date().toISOString().split('T')[0],
    expiry_date: null,
    quantity_received: 0,
    unit_cost: null,
    certificate_of_analysis_url: null,
    notes: null,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [matRes, suppRes] = await Promise.all([
      fetch('/api/materials'),
      fetch('/api/suppliers'),
    ]);
    
    const matData = await matRes.json();
    const suppData = await suppRes.json();
    
    setMaterials(matData.materials);
    setSuppliers(suppData.suppliers);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/lots/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Lot received successfully! Internal code: ${data.lot.internal_lot_code}`);
        window.location.href = '/inventory';
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      alert('Failed to receive lot');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/' },
        { label: 'Inventory', href: '/inventory' },
        { label: 'Receive Material', href: '/inventory/receive' }
      ]} />

      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Receive Material</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Material *
            </label>
            <select
              required
              value={formData.material_id}
              onChange={(e) => setFormData({ ...formData, material_id: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="">Select material...</option>
              {materials.map((mat) => (
                <option key={mat.id} value={mat.id}>
                  {mat.name} ({mat.material_code}) - {mat.category}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Supplier
            </label>
            <select
              value={formData.supplier_id || ''}
              onChange={(e) => setFormData({ 
                ...formData, 
                supplier_id: e.target.value || null 
              })}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="">No supplier</option>
              {suppliers.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.name} {sup.supplier_code && `(${sup.supplier_code})`}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lot Number *
              </label>
              <input
                type="text"
                required
                value={formData.lot_number}
                onChange={(e) => setFormData({ ...formData, lot_number: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="Supplier's lot number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity Received *
              </label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={formData.quantity_received}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  quantity_received: parseFloat(e.target.value) 
                })}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Received Date *
              </label>
              <input
                type="date"
                required
                value={formData.received_date}
                onChange={(e) => setFormData({ ...formData, received_date: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expiry Date
              </label>
              <input
                type="date"
                value={formData.expiry_date || ''}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  expiry_date: e.target.value || null 
                })}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit Cost
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.unit_cost || ''}
              onChange={(e) => setFormData({ 
                ...formData, 
                unit_cost: e.target.value ? parseFloat(e.target.value) : null 
              })}
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="Cost per unit"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Certificate of Analysis URL
            </label>
            <input
              type="url"
              value={formData.certificate_of_analysis_url || ''}
              onChange={(e) => setFormData({ 
                ...formData, 
                certificate_of_analysis_url: e.target.value || null 
              })}
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              rows={3}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value || null })}
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="Additional notes..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="px-6 py-2 border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Receiving...' : 'Receive Lot'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}