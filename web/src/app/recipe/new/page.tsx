'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search, ArrowLeft } from 'lucide-react';
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
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading recipes…
        </div>
      );
    }

    if (filteredRecipes.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center text-gray-500">
          No recipes found. Try adjusting your search or create a recipe first.
        </div>
      );
    }

    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filteredRecipes.map((recipe) => {
          const productName = recipe.product?.name ?? 'Unlinked product';
          const productCode = recipe.product?.code ?? '—';
          return (
            <button
              key={recipe.id}
              type="button"
              onClick={() => openModalForRecipe(recipe)}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
            >
              <div className="text-xs font-semibold uppercase text-indigo-600">
                {productName}
              </div>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">{recipe.name}</h3>
              <p className="text-sm text-slate-500">Recipe code: {recipe.recipe_code}</p>

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

              <p className="mt-3 line-clamp-3 text-sm text-slate-500">
                {recipe.description ?? 'No description provided.'}
              </p>

              <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                <span>Product code: {productCode}</span>
                <span>{new Date(recipe.created_at).toLocaleDateString()}</span>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="text-right">
            <h1 className="text-2xl font-semibold text-slate-900">Create a Batch</h1>
            <p className="text-sm text-slate-500">Select a recipe then enter batch details.</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Choose a recipe</h2>
            <p className="text-sm text-slate-500">
              Recipes are already linked to products, so just select the one you want to run.
            </p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Search by recipe or product"
            />
          </div>
        </div>

        {renderContent()}
      </main>

      {modalOpen && selectedRecipe ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4">
              <p className="text-xs uppercase text-indigo-600">
                {selectedRecipe.product?.name ?? 'Unlinked product'}
              </p>
              <h3 className="mt-1 text-2xl font-semibold text-slate-900">{selectedRecipe.name}</h3>
              <p className="text-sm text-slate-500">
                Recipe code: {selectedRecipe.recipe_code}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="flex items-center justify-between text-sm font-medium text-slate-700">
                  Beef weight (kg)
                  <span className="text-xs font-normal text-slate-400">
                    Base {(selectedRecipe.base_beef_weight / 1000).toFixed(2)} kg
                  </span>
                </label>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={batchWeight}
                  onChange={(e) => setBatchWeight(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Notes</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Optional batch notes…"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                disabled={creating}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateBatch}
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Create batch
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
