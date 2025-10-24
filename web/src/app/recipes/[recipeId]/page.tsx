'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Breadcrumbs from '@/components/Breadcrumbs';
import type { Recipe, RecipeIngredient, Material } from '@/types/inventory';

type RecipeIngredientPayload = {
  id: string;
  recipe_id?: string;
  material_id: string;
  quantity: number;
  unit: string;
  is_critical?: boolean;
  notes?: string | null;
  created_at?: string;
  material?: Material | Material[] | null;
};

export default function RecipeDetailPage() {
  const params = useParams();
  const recipeId = params.recipeId as string;
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecipe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId]);

  const fetchRecipe = async () => {
    try {
      const res = await fetch(`/api/recipes/${recipeId}`);
      if (!res.ok) {
        throw new Error('Failed to load recipe');
      }
      const data = await res.json();
      const raw = data.recipe;
      if (!raw) {
        setRecipe(null);
        return;
      }

      const items: RecipeIngredientPayload[] = Array.isArray(raw.recipe_ingredients)
        ? (raw.recipe_ingredients as RecipeIngredientPayload[])
        : [];

      const ingredients: RecipeIngredient[] = items.map((item) => {
            const material = Array.isArray(item.material) ? item.material[0] : item.material ?? null;
            return {
              id: item.id,
              recipe_id: item.recipe_id ?? raw.id,
              material_id: item.material_id,
              quantity: item.quantity,
              unit: item.unit,
              is_critical: Boolean(item.is_critical),
              notes: item.notes ?? null,
              created_at: item.created_at ?? '',
              material: material ?? undefined,
            };
          });

      const normalized: Recipe = {
        id: raw.id,
        name: raw.name,
        recipe_code: raw.recipe_code,
        product_category: raw.product_category ?? null,
        base_beef_weight: raw.base_beef_weight,
        target_yield_weight: raw.target_yield_weight ?? null,
        description: raw.description ?? null,
        instructions: raw.instructions ?? null,
        version: raw.version ?? 1,
        is_active: raw.is_active ?? true,
        created_at: raw.created_at ?? '',
        updated_at: raw.updated_at ?? '',
        ingredients,
      };

      setRecipe(normalized);
    } catch (error) {
      console.error('Failed to load recipe', error);
      setRecipe(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center py-12">Loading recipe...</div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center py-12">Recipe not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <Breadcrumbs items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Recipes', href: '/recipes' },
          { label: recipe.name, href: `/recipes/${recipeId}` }
        ]} />

        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold">{recipe.name}</h1>
              <p className="text-gray-600 mt-1">{recipe.recipe_code}</p>
            </div>
            <button
              onClick={() => window.location.href = `/recipe/new?recipe=${recipeId}`}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Create Batch
            </button>
          </div>

          {/* Recipe Info */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Recipe Details</h2>
            
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Base Beef Weight</p>
                <p className="font-medium text-lg">{recipe.base_beef_weight}g</p>
              </div>
              {recipe.target_yield_weight && (
                <div>
                  <p className="text-sm text-gray-600">Target Yield</p>
                  <p className="font-medium text-lg">{recipe.target_yield_weight}g</p>
                </div>
              )}
              {recipe.product_category && (
                <div>
                  <p className="text-sm text-gray-600">Category</p>
                  <p className="font-medium text-lg">{recipe.product_category}</p>
                </div>
              )}
            </div>

            {recipe.description && (
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-1">Description</p>
                <p className="text-gray-800">{recipe.description}</p>
              </div>
            )}

            {recipe.instructions && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Instructions</p>
                <p className="text-gray-800 whitespace-pre-wrap">{recipe.instructions}</p>
              </div>
            )}
          </div>

          {/* Ingredients */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Bill of Materials</h2>
            
            {!recipe.ingredients || recipe.ingredients.length === 0 ? (
              <p className="text-gray-500">No ingredients defined</p>
            ) : (
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Material
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Code
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Quantity
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                      Critical
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recipe.ingredients.map((ing) => (
                    <tr key={ing.id}>
                      <td className="px-4 py-3">
                        <span className="font-medium">{ing.material?.name}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {ing.material?.material_code}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {ing.quantity} {ing.unit}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {ing.is_critical && (
                          <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                            Critical
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
