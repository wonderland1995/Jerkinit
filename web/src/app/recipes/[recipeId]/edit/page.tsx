'use client';

import { useEffect, useState, ChangeEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';

// ---- Types (align with your DB) ----
type Unit = 'g' | 'kg' | 'ml' | 'L' | 'units';

type RecipeIngredient = {
  id: string;
  material_id: string;
  quantity: number;
  unit: Unit;
  tolerance_percentage: number | null;
  is_critical: boolean;
  is_cure: boolean;
  display_order: number;
  notes: string | null;
};

type Recipe = {
  id: string;
  product_id: string;
  name: string;
  recipe_code: string;
  base_beef_weight: number;
  target_yield_weight: number | null;
  description: string | null;
  instructions: string | null;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  recipe_ingredients: RecipeIngredient[];
};

type RecipeGetResponse = { recipe: Recipe } | { error: string };
type PutResponse = { ok: true } | { error: string };

export default function EditRecipePage() {
  const { recipeId } = useParams<{ recipeId: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [recipe, setRecipe] = useState<Recipe | null>(null);

  // Fetch recipe
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/recipes/${recipeId}`);
      let data: RecipeGetResponse | null = null;
      try {
        data = (await res.json()) as RecipeGetResponse;
      } catch {
        data = { error: 'Invalid server response' };
      }
      if (cancelled) return;

      if (!res.ok || ('error' in (data ?? {}))) {
        setRecipe(null);
        setLoading(false);
        return;
      }
      setRecipe((data as { recipe: Recipe }).recipe);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  // Change handlers (no any)
  const onTextChange =
    (field: 'name' | 'description' | 'instructions') =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!recipe) return;
      const value = e.currentTarget.value;
      setRecipe({ ...recipe, [field]: value });
    };

  const onActiveChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!recipe) return;
    setRecipe({ ...recipe, is_active: e.currentTarget.checked });
  };

  // Save
  const save = async () => {
    if (!recipe) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/recipes/${recipeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: recipe.name,
          description: recipe.description,
          instructions: recipe.instructions,
          is_active: recipe.is_active,
        }),
      });

      let data: PutResponse | null = null;
      try {
        data = (await res.json()) as PutResponse;
      } catch {
        data = null;
      }

      if (!res.ok || !data || ('error' in data)) {
        const msg =
          (data && 'error' in data && typeof data.error === 'string')
            ? data.error
            : 'Failed to update recipe';
        alert(msg);
        return;
      }

      router.push(`/recipes/${recipeId}`);
    } catch (_error) {
      alert('Failed to update recipe');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Loading…</div>;
  if (!recipe) return <div className="p-6">Recipe not found</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Edit Recipe</h1>

      <label className="block">
        <span className="text-sm font-medium">Name</span>
        <input
          className="border rounded p-2 w-full"
          value={recipe.name}
          onChange={onTextChange('name')}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Description</span>
        <textarea
          className="border rounded p-2 w-full"
          rows={3}
          value={recipe.description ?? ''}
          onChange={onTextChange('description')}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Instructions</span>
        <textarea
          className="border rounded p-2 w-full"
          rows={5}
          value={recipe.instructions ?? ''}
          onChange={onTextChange('instructions')}
        />
      </label>

      <label className="inline-flex items-center gap-2">
        <input
          type="checkbox"
          checked={recipe.is_active}
          onChange={onActiveChange}
        />
        <span className="text-sm">Active</span>
      </label>

      <div className="flex gap-3">
        <button
          className="px-4 py-2 rounded border"
          type="button"
          onClick={() => router.back()}
        >
          Cancel
        </button>
        <button
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
          type="button"
          onClick={save}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
