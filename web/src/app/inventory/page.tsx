'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Breadcrumbs from '@/components/Breadcrumbs';
import type { MaterialInventorySummary } from '@/types/inventory';
import { formatQuantity } from '@/lib/utils';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sortOption, setSortOption] = useState<'name' | 'stock' | 'expiry'>('name');

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

  const categories = useMemo(() => {
    const set = new Set<string>();
    inventory.forEach((item) => {
      const category = typeof item.material.category === 'string' ? item.material.category.trim() : '';
      if (category.length > 0) {
        set.add(category);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [inventory]);

  const inventoryStats = useMemo(() => {
    const totalMaterials = inventory.length;
    const lowStockCount = inventory.filter((item) => item.is_low_stock).length;
    const totalLots = inventory.reduce((sum, item) => sum + item.lot_count, 0);
    const now = new Date();
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + 30);
    const expiringSoon = inventory.filter((item) => {
      if (!item.nearest_expiry_date) return false;
      const exp = new Date(item.nearest_expiry_date);
      if (Number.isNaN(exp.getTime())) return false;
      return exp >= now && exp <= horizon;
    }).length;

    return { totalMaterials, lowStockCount, totalLots, expiringSoon };
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const normalizedCategory = categoryFilter.toLowerCase();

    const filtered = inventory.filter((item) => {
      const materialName = item.material.name ?? '';
      const materialCode = item.material.material_code ?? '';
      const materialCategory = item.material.category ?? '';

      const matchesSearch =
        term.length === 0 ||
        [materialName, materialCode, materialCategory].some((value) => value.toLowerCase().includes(term));

      const matchesCategory =
        normalizedCategory === 'all' || materialCategory.toLowerCase() === normalizedCategory;

      const matchesStock = !lowStockOnly || item.is_low_stock;

      return matchesSearch && matchesCategory && matchesStock;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sortOption === 'stock') {
        return Number(b.total_on_hand ?? 0) - Number(a.total_on_hand ?? 0);
      }
      if (sortOption === 'expiry') {
        const aDate = a.nearest_expiry_date ? new Date(a.nearest_expiry_date).getTime() : Number.POSITIVE_INFINITY;
        const bDate = b.nearest_expiry_date ? new Date(b.nearest_expiry_date).getTime() : Number.POSITIVE_INFINITY;
        return aDate - bDate;
      }
      const aName = a.material.name ?? '';
      const bName = b.material.name ?? '';
      return aName.localeCompare(bName);
    });

    return sorted;
  }, [inventory, searchTerm, categoryFilter, lowStockOnly, sortOption]);

  const hasInventory = filteredInventory.length > 0;

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

      {!loadingSummary && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Active Materials"
              value={inventoryStats.totalMaterials}
              accent="text-blue-600"
              hint="Tracked across all categories"
            />
            <SummaryCard
              label="Total Lots"
              value={inventoryStats.totalLots}
              accent="text-indigo-600"
              hint="Open lots available for allocation"
            />
            <SummaryCard
              label="Low Stock Alerts"
              value={inventoryStats.lowStockCount}
              accent="text-amber-600"
              hint="Below configured reorder levels"
            />
            <SummaryCard
              label="Expiring Soon"
              value={inventoryStats.expiringSoon}
              accent="text-rose-600"
              hint="Within the next 30 days"
            />
          </div>

          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
                <label className="relative flex-1">
                  <span className="sr-only">Search inventory</span>
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search by material, code, or category"
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </label>
                <label className="flex-1 sm:max-w-xs">
                  <span className="sr-only">Filter by category</span>
                  <select
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                    className="w-full rounded-md border border-gray-200 bg-white px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="all">All categories</option>
                    {categories.map((category) => (
                      <option key={category} value={category.toLowerCase()}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="sm:max-w-[180px]">
                  <span className="sr-only">Sort inventory</span>
                  <select
                    value={sortOption}
                    onChange={(event) => setSortOption(event.target.value as typeof sortOption)}
                    className="w-full rounded-md border border-gray-200 bg-white px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="name">Sort: A → Z</option>
                    <option value="stock">Sort: Stock (High → Low)</option>
                    <option value="expiry">Sort: Soonest Expiry</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setLowStockOnly((prev) => !prev)}
                  className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
                    lowStockOnly
                      ? 'bg-red-100 text-red-700 ring-2 ring-red-200'
                      : 'border border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="inline-block h-2 w-2 rounded-full bg-red-500" aria-hidden />
                  Low stock only
                </button>
                {(searchTerm || categoryFilter !== 'all' || lowStockOnly || sortOption !== 'name') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setCategoryFilter('all');
                      setLowStockOnly(false);
                      setSortOption('name');
                    }}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Reset filters
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {loadingSummary ? (
        <p>Loading inventory...</p>
      ) : (
        <>
          {hasInventory ? (
            <div className="space-y-6">
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm hidden md:block">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-6 py-3">Material</th>
                      <th className="px-6 py-3">Category</th>
                      <th className="px-6 py-3 text-right">On Hand</th>
                      <th className="px-6 py-3 text-right">Lots</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Next Expiry</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                    {filteredInventory.map((item) => (
                      <tr key={item.material.id} className="transition hover:bg-blue-50/40">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">{item.material.name}</div>
                          <div className="text-xs uppercase tracking-wide text-gray-500">
                            {item.material.material_code ?? 'No code'}
                          </div>
                        </td>
                        <td className="px-6 py-4 capitalize text-gray-600">{item.material.category ?? '—'}</td>
                        <td className="px-6 py-4 text-right">
                          <span className={`font-semibold ${item.is_low_stock ? 'text-red-600' : 'text-gray-900'}`}>
                            {formatQuantity(item.total_on_hand, item.material.unit)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-gray-600">{item.lot_count}</td>
                        <td className="px-6 py-4">
                          {item.is_low_stock ? (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                              Low stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                              In range
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {item.nearest_expiry_date ? formatDate(item.nearest_expiry_date) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-4 md:hidden">
                {filteredInventory.map((item) => (
                  <div key={item.material.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">{item.material.category ?? '—'}</p>
                        <h3 className="text-lg font-semibold text-gray-900">{item.material.name}</h3>
                        <p className="text-xs text-gray-500">{item.material.material_code ?? 'No code'}</p>
                      </div>
                      {item.is_low_stock ? (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                          Low stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          In range
                        </span>
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-gray-600">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">On hand</p>
                        <p className="mt-1 font-semibold text-gray-900">
                          {formatQuantity(item.total_on_hand, item.material.unit)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">Lots</p>
                        <p className="mt-1 font-medium text-gray-900">{item.lot_count}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">Next expiry</p>
                        <p className="mt-1 font-medium">
                          {item.nearest_expiry_date ? formatDate(item.nearest_expiry_date) : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">Status</p>
                        <p className="mt-1 font-medium text-gray-900">
                          {item.is_low_stock ? 'Reorder soon' : 'Healthy'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
              <p className="font-medium text-gray-700">No inventory matches your current filters.</p>
              <p className="mt-1">Try adjusting the search or reset your filters to see all materials.</p>
            </div>
          )}
        </>
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

function SummaryCard({
  label,
  value,
  hint,
  accent = 'text-gray-900',
}: {
  label: string;
  value: number;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${accent}`}>{value.toLocaleString()}</p>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}
