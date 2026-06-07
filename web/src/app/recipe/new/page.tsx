'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search, ArrowLeft, Package } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';

interface RecipeRecord {
  id: string;
  product_id: string | null;
  name: string;
  recipe_code: string;
  base_beef_weight: number;
  target_yield_weight: number | null;
  description: string | null;
  created_at: string;
  product?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export default function CreateBatchPage() {
  const router = useRouter();
  const toast = useToast();

  const [recipes, setRecipes] = useState<RecipeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [selectedRecipe, setSelectedRecipe] = useState<RecipeRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [batchWeight, setBatchWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/recipes', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load recipes');
        const data = (await res.json()) as { recipes?: RecipeRecord[] };
        if (!cancelled) {
          setRecipes(data.recipes ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch recipes', error);
          toast.error('Unable to load recipes right now.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [toast]);

  const filteredRecipes = useMemo(() => {
    if (!search.trim()) return recipes;
    const needle = search.toLowerCase();
    return recipes.filter((recipe) => {
      const productName = recipe.product?.name ?? '';
      return (
        recipe.name.toLowerCase().includes(needle) ||
        recipe.recipe_code.toLowerCase().includes(needle) ||
        productName.toLowerCase().includes(needle)
      );
    });
  }, [recipes, search]);

  const openModalForRecipe = (recipe: RecipeRecord) => {
    setSelectedRecipe(recipe);
    const defaultWeight =
      typeof recipe.base_beef_weight === 'number' && recipe.base_beef_weight > 0
        ? (recipe.base_beef_weight / 1000).toString()
        : '1';
    setBatchWeight(defaultWeight);
    setNotes('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedRecipe(null);
    setBatchWeight('');
    setNotes('');
    setCreating(false);
  };

  const handleCreateBatch = async () => {
    if (!selectedRecipe) return;
    const weightNumber = Number(batchWeight);
    if (!Number.isFinite(weightNumber) || weightNumber <= 0) {
      toast.error('Enter a positive beef weight in kilograms.');
      return;
    }

    const linkedProductId = selectedRecipe.product_id ?? selectedRecipe.product?.id ?? null;
    if (!linkedProductId) {
      toast.error('This recipe is not linked to a product yet.');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/batches/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: linkedProductId,
          recipe_id: selectedRecipe.id,
          beef_weight_kg: weightNumber,
          notes: notes.trim() || null,
          created_by: 'Operator',
        }),
      });

      if (!res.ok) {
        const error = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(error.error ?? 'Failed to create batch');
      }

      const data = (await res.json().catch(() => ({}))) as { batch?: { id: string } };
      toast.success('Batch created successfully.');
      closeModal();
      if (data.batch?.id) {
        router.push(`/batches/${data.batch.id}`);
      } else {
        router.push('/batches');
      }
    } catch (error) {
      console.error('Batch creation failed', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create batch');
      setCreating(false);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-3 shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
            <span className="text-sm font-medium text-slate-600">Loading recipes…</span>
          </div>
        </div>
      );
    }

    if (filteredRecipes.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center text-gray-500">
          <Package className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="font-medium text-gray-700">No recipes found</p>
          <p className="mt-1 text-sm">Try adjusting your search or create a recipe first.</p>
        </div>
      );
    }

    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredRecipes.map((recipe) => {
          const productName = recipe.product?.name ?? 'Unlinked product';
          const productCode = recipe.product?.code ?? '—';
          return (
            <button
              key={recipe.id}
              type="button"
              onClick={() => openModalForRecipe(recipe)}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md active:translate-y-0 active:shadow-sm"
            >
              <div className="text-xs font-semibold uppercase text-emerald-600">
                {productName}
              </div>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">{recipe.name}</h3>
              <p className="text-sm text-slate-500">Code: {recipe.recipe_code}</p>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
                <div>
                  <dt className="text-xs uppercase text-slate-400">Base beef</dt>
                  <dd className="font-semibold">
                    {(recipe.base_beef_weight / 1000).toFixed(2)} kg
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-400">Target yield</dt>
                  <dd className="font-semibold">
                    {recipe.target_yield_weight
                      ? `${(recipe.target_yield_weight / 1000).toFixed(2)} kg`
                      : '—'}
                  </dd>
                </div>
              </dl>

              {recipe.description && (
                <p className="mt-3 line-clamp-2 text-sm text-slate-500">
                  {recipe.description}
                </p>
              )}

              <div className="mt-4 flex items-center justify-between text-xs text-slate-400 border-t border-slate-100 pt-3">
                <span>Product: {productCode}</span>
                <span>{new Date(recipe.created_at).toLocaleDateString('en-AU')}</span>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="border-b bg-white sticky top-14 z-30">
        <div className="mx-auto max-w-6xl px-4 sm:px-5 py-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Create a batch</h1>
              <p className="text-sm text-slate-500 hidden sm:block">Select a recipe, then enter the beef weight.</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-5 py-6 space-y-6">
        {/* Search bar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Choose a recipe</p>
              <p className="text-xs text-slate-500 mt-0.5">Tap a card to enter batch details.</p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                placeholder="Search recipes or products"
              />
            </div>
          </div>
        </div>

        {renderContent()}
      </main>

      {/* Modal — slides up full-width on mobile, centered dialog on desktop */}
      {modalOpen && selectedRecipe ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="w-full rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl sm:mx-4">
            {/* Mobile drag handle */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="h-1 w-10 rounded-full bg-gray-300" />
            </div>

            <div className="px-6 pt-4 pb-6 sm:p-6">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                  {selectedRecipe.product?.name ?? 'Unlinked product'}
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">{selectedRecipe.name}</h3>
                <p className="text-sm text-slate-500">Recipe code: {selectedRecipe.recipe_code}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="flex items-center justify-between text-sm font-semibold text-slate-700 mb-1.5">
                    Beef weight (kg)
                    <span className="text-xs font-normal text-slate-400">
                      Base: {(selectedRecipe.base_beef_weight / 1000).toFixed(2)} kg
                    </span>
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0.1}
                    step={0.1}
                    value={batchWeight}
                    onChange={(e) => setBatchWeight(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Notes <span className="font-normal text-slate-400">(optional)</span></label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 resize-none"
                    placeholder="Batch notes, shift info, etc."
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={creating}
                  className="w-full sm:w-auto rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateBatch}
                  disabled={creating}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60 shadow-md shadow-emerald-200"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                  {creating ? 'Creating batch…' : 'Create batch'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
