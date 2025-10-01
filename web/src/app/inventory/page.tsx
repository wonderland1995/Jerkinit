'use client';

import { useEffect, useState } from 'react';
import Breadcrumbs from '@/components/Breadcrumbs';
import type { MaterialInventorySummary } from '@/types/inventory';

export default function InventoryPage() {
  const [inventory, setInventory] = useState<MaterialInventorySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    const res = await fetch('/api/inventory/summary');
    const data = await res.json();
    setInventory(data.inventory);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/' },
        { label: 'Inventory', href: '/inventory' }
      ]} />
      
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold">Ingredient Inventory</h1>
        <button
          onClick={() => window.location.href = '/inventory/receive'}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Receive Material
        </button>
      </div>

      {loading ? (
        <p>Loading inventory...</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">On Hand</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Lots</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Next Expiry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {inventory.map((item) => (
                <tr key={item.material.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900">{item.material.name}</div>
                      <div className="text-sm text-gray-500">{item.material.material_code}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{item.material.category}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-medium ${item.is_low_stock ? 'text-red-600' : 'text-gray-900'}`}>
                      {item.total_on_hand.toFixed(0)} {item.material.unit}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-500">{item.lot_count}</td>
                  <td className="px-6 py-4">
                    {item.is_low_stock && (
                      <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                        Low Stock
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {item.nearest_expiry_date ? new Date(item.nearest_expiry_date).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}