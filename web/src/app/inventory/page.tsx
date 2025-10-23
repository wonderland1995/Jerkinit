'use client';

import { Fragment, useEffect, useState } from 'react';
import Breadcrumbs from '@/components/Breadcrumbs';
import type { MaterialInventorySummary } from '@/types/inventory';

type BeefLot = {
  id: string;
  lot_number: string;
  internal_lot_code: string;
  current_balance: number;
  received_date: string | null;
  expiry_date: string | null;
  unit: string;
  supplier?: { name?: string | null } | null;
  material?: { id?: string; name?: string; category?: string; unit?: string } | null;
};

type LotAllocation = {
  id: string;
  batch_id: string;
  quantity_used: number;
  unit: string;
  allocated_at: string | null;
  batch: {
    id: string;
    batch_code: string;
    status: string | null;
    recipe_name: string | null;
    recipe_code: string | null;
  };
};

type RawRecipe = {
  name?: string | null;
  recipe_code?: string | null;
};

type RawBatch = {
  id?: string | number | null;
  batch_id?: string | number | null;
  status?: string | null;
  recipe?: RawRecipe | RawRecipe[] | null;
};

type RawLotAllocation = {
  id?: string | number | null;
  batch_id?: string | number | null;
  lot_id?: string | number | null;
  quantity_used?: number | string | null;
  unit?: string | null;
  allocated_at?: string | null;
  batch?: RawBatch | RawBatch[] | null;
};

const asSingle = <T,>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) {
    return value.length > 0 ? value[0] : null;
  }
  return value ?? null;
};

const formatDate = (value: string | null, withTime = false) => {
  if (!value) return '--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '--';
  }
  return withTime ? parsed.toLocaleString() : parsed.toLocaleDateString();
};

const formatQuantity = (quantity: number, unit: string) =>
  `${Number(quantity).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`;

export default function InventoryPage() {
  const [inventory, setInventory] = useState<MaterialInventorySummary[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [beefLots, setBeefLots] = useState<BeefLot[]>([]);
  const [loadingBeefLots, setLoadingBeefLots] = useState(true);
  const [beefLotsError, setBeefLotsError] = useState<string | null>(null);
  const [expandedLotId, setExpandedLotId] = useState<string | null>(null);
  const [lotAllocations, setLotAllocations] = useState<Record<string, LotAllocation[]>>({});
  const [allocationLoadingLot, setAllocationLoadingLot] = useState<string | null>(null);
  const [lotAllocationErrors, setLotAllocationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchInventorySummary();
    fetchBeefLots();
  }, []);

  const fetchInventorySummary = async () => {
    try {
      const res = await fetch('/api/inventory/summary');
      if (!res.ok) {
        throw new Error('Failed to fetch inventory summary');
      }
      const data = await res.json();
      setInventory(Array.isArray(data.inventory) ? data.inventory : []);
    } catch (error) {
      console.error('Failed to load inventory summary', error);
      setInventory([]);
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchBeefLots = async () => {
    try {
      const res = await fetch('/api/lots?category=beef');
      if (!res.ok) {
        throw new Error('Failed to fetch beef lots');
      }
      const data = await res.json();
      setBeefLots(Array.isArray(data.lots) ? data.lots : []);
      setBeefLotsError(null);
    } catch (error) {
      console.error('Failed to load beef lots', error);
      setBeefLots([]);
      setBeefLotsError('Unable to load beef lots right now.');
    } finally {
      setLoadingBeefLots(false);
    }
  };

  const ensureLotAllocations = async (lotId: string) => {
    if (lotAllocations[lotId] || allocationLoadingLot === lotId) {
      return;
    }

    setAllocationLoadingLot(lotId);
    setLotAllocationErrors((prev) => {
      const next = { ...prev };
      delete next[lotId];
      return next;
    });

    try {
      const res = await fetch(`/api/lots/${lotId}/batches`);
      if (!res.ok) {
        throw new Error('Failed to fetch batch allocations');
      }
      const data = await res.json();

      const normalized: LotAllocation[] = (Array.isArray(data.affected_batches) ? data.affected_batches : []).map(
        (usage: RawLotAllocation) => {
          const batch = asSingle(usage.batch);
          const recipe = batch ? asSingle(batch.recipe) : null;

          const rawBatchId = batch?.id ?? usage.batch_id ?? '';
          const batchId =
            typeof rawBatchId === 'string'
              ? rawBatchId
              : rawBatchId != null
              ? String(rawBatchId)
              : '';

          const rawBatchCode = batch?.batch_id ?? usage.batch_id ?? '';
          const batchCode =
            typeof rawBatchCode === 'string'
              ? rawBatchCode
              : rawBatchCode != null
              ? String(rawBatchCode)
              : '';

          const rawUsageId = usage.id;
          const allocationId =
            typeof rawUsageId === 'string'
              ? rawUsageId
              : rawUsageId != null
              ? String(rawUsageId)
              : `${batchCode}-${lotId}-${String(usage.allocated_at ?? Date.now())}`;

          const rawQuantity = usage.quantity_used ?? 0;
          const quantityUsed = typeof rawQuantity === 'number' ? rawQuantity : Number(rawQuantity);

          return {
            id: allocationId,
            batch_id: typeof usage.batch_id === 'string' ? usage.batch_id : String(usage.batch_id ?? batchCode),
            quantity_used: Number.isFinite(quantityUsed) ? quantityUsed : 0,
            unit: typeof usage.unit === 'string' && usage.unit.length > 0 ? usage.unit : 'kg',
            allocated_at: typeof usage.allocated_at === 'string' ? usage.allocated_at : null,
            batch: {
              id: batchId || batchCode || lotId,
              batch_code: batchCode || batchId || lotId,
              status: typeof batch?.status === 'string' ? batch.status : null,
              recipe_name: typeof recipe?.name === 'string' ? recipe.name : null,
              recipe_code: typeof recipe?.recipe_code === 'string' ? recipe.recipe_code : null,
            },
          };
        }
      );

      setLotAllocations((prev) => ({
        ...prev,
        [lotId]: normalized,
      }));
    } catch (error) {
      console.error(`Failed to load allocations for lot ${lotId}`, error);
      setLotAllocations((prev) => ({ ...prev, [lotId]: [] }));
      setLotAllocationErrors((prev) => ({
        ...prev,
        [lotId]: 'Unable to load batch allocations for this lot.',
      }));
    } finally {
      setAllocationLoadingLot(null);
    }
  };

  const toggleLotAllocations = (lotId: string) => {
    if (expandedLotId === lotId) {
      setExpandedLotId(null);
      return;
    }
    setExpandedLotId(lotId);
    void ensureLotAllocations(lotId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Inventory', href: '/inventory' },
        ]}
      />

      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold">Ingredient Inventory</h1>
        <button
          onClick={() => {
            window.location.href = '/inventory/receive';
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Receive Material
        </button>
      </div>

      {loadingSummary ? (
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
                      <div className="text-sm text-gray-500">{item.material.material_code ?? '--'}</div>
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
                      <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">Low Stock</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {item.nearest_expiry_date ? formatDate(item.nearest_expiry_date) : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-2xl font-semibold mb-4">Beef Lot Allocations</h2>
        {loadingBeefLots ? (
          <p>Loading beef lots...</p>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {beefLotsError ? (
              <div className="p-6 text-sm text-red-600">{beefLotsError}</div>
            ) : beefLots.length === 0 ? (
              <div className="p-6 text-sm text-gray-600">No beef lots available.</div>
            ) : (
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lot Number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Internal Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Received</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Current Balance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {beefLots.map((lot) => {
                    const supplierName = lot.supplier?.name ?? '--';
                    const materialUnit =
                      typeof lot.material?.unit === 'string' && lot.material.unit.length > 0 ? lot.material.unit : lot.unit;

                    return (
                      <Fragment key={lot.id}>
                        <tr className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div>
                              <div className="font-medium text-gray-900">{lot.lot_number}</div>
                              <div className="text-sm text-gray-500">{lot.material?.name ?? 'Beef'}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">{lot.internal_lot_code}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{formatDate(lot.received_date)}</td>
                          <td className="px-6 py-4 text-right text-sm text-gray-500">
                            {formatQuantity(Number(lot.current_balance ?? 0), materialUnit)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">{supplierName}</td>
                          <td className="px-6 py-4 text-sm">
                            <button
                              onClick={() => toggleLotAllocations(lot.id)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              {expandedLotId === lot.id ? 'Hide Allocations' : 'View Allocations'}
                            </button>
                          </td>
                        </tr>
                        {expandedLotId === lot.id && (
                          <tr>
                            <td colSpan={6} className="bg-gray-50 px-6 py-4">
                              {allocationLoadingLot === lot.id ? (
                                <p className="text-sm text-gray-600">Loading allocations...</p>
                              ) : lotAllocationErrors[lot.id] ? (
                                <p className="text-sm text-red-600">{lotAllocationErrors[lot.id]}</p>
                              ) : (lotAllocations[lot.id] ?? []).length === 0 ? (
                                <p className="text-sm text-gray-600">No batches have been allocated from this lot.</p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="min-w-full bg-white">
                                    <thead>
                                      <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                          Batch
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                          Recipe
                                        </th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                          Quantity Used
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                          Allocated
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                          Status
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                      {(lotAllocations[lot.id] ?? []).map((allocation) => (
                                        <tr key={allocation.id}>
                                          <td className="px-4 py-2 text-sm text-gray-900">
                                            {allocation.batch.batch_code}
                                          </td>
                                          <td className="px-4 py-2 text-sm text-gray-500">
                                            {allocation.batch.recipe_name
                                              ? `${allocation.batch.recipe_name}${
                                                  allocation.batch.recipe_code
                                                    ? ` (${allocation.batch.recipe_code})`
                                                    : ''
                                                }`
                                              : '--'}
                                          </td>
                                          <td className="px-4 py-2 text-right text-sm text-gray-500">
                                            {formatQuantity(allocation.quantity_used, allocation.unit)}
                                          </td>
                                          <td className="px-4 py-2 text-sm text-gray-500">
                                            {formatDate(allocation.allocated_at, true)}
                                          </td>
                                          <td className="px-4 py-2 text-sm text-gray-500">
                                            {allocation.batch.status ?? '--'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
