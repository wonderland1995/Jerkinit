'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Recipe {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  is_active: boolean;
  recipe_code: string;
}

export default function EditRecipePage() {
  const { recipeId } = useParams<{ recipeId: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/recipes/${recipeId}`);
      const data = await res.json();
      setRecipe(data.recipe);
      setLoading(false);
    })();
  }, [recipeId]);

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
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to update recipe');
      }
      router.push(`/recipes/${recipeId}`);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (!recipe) return <div className="p-6">Not found</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Edit Recipe</h1>

      <label className="block">
        <span className="text-sm font-medium">Name</span>
        <input
          className="border rounded p-2 w-full"
          value={recipe.name ?? ''}
          onChange={(e) => setRecipe(prev => prev ? { ...prev, name: e.target.value } : null)}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Description</span>
        <textarea
          className="border rounded p-2 w-full"
          rows={3}
          value={recipe.description ?? ''}
          onChange={(e) => setRecipe(prev => prev ? { ...prev, description: e.target.value } : null)}
        />
      </label>

      <label className="inline-flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!recipe.is_active}
          onChange={(e) => setRecipe(prev => prev ? { ...prev, is_active: e.target.checked } : null)}
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
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}