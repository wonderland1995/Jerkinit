'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Breadcrumbs from '@/components/Breadcrumbs';
import type { Recipe } from '@/types/inventory';

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
    const res = await fetch(`/api/recipes/${recipeId}`);
    const data = await res.json();
    setRecipe(data.recipe);
    setLoading(false);
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