'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Breadcrumbs from '@/components/Breadcrumbs';
import type { Recipe } from '@/types/inventory';

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecipes();
  }, []);

  const fetchRecipes = async () => {
    const res = await fetch('/api/recipes');
    const data = await res.json();
    setRecipes(data.recipes);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/' },
        { label: 'All recipes', href: '/recipes' }
      ]} />

      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold">Recipes</h1>
        <button
          onClick={() => window.location.href = '/recipes/new'}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Create Recipe
        </button>
      </div>

      <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-gray-700">
        <p>
          Each recipe links directly to a product. Make sure the product exists before starting a new recipe.
          Manage them on the{' '}
          <Link href="/products" className="font-semibold text-blue-700 underline hover:text-blue-900">
            Products page
          </Link>
          .
        </p>
      </div>

      {loading ? (
        <p>Loading recipes...</p>
      ) : recipes.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 mb-4">No recipes created yet</p>
          <button
            onClick={() => window.location.href = '/recipes/new'}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            Create Your First Recipe
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recipes.map((recipe) => (
            <div 
              key={recipe.id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer"
              onClick={() => window.location.href = `/recipes/${recipe.id}`}
            >
              <div className="p-6">
             <div className="flex justify-between items-start mb-3">
  <h3 className="text-xl font-semibold">{recipe.name}</h3>
  <div className="flex items-center gap-2">
    {recipe.is_active && (
      <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
        Active
      </span>
    )}
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        window.location.href = `/recipes/${recipe.id}/edit`;
      }}
      className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
      title="Edit recipe"
    >
      Edit
    </button>
  </div>
</div>

                
                <p className="text-sm text-gray-600 mb-2">
                  Code: {recipe.recipe_code}
                </p>
                
                {recipe.product_category && (
                  <p className="text-sm text-gray-600 mb-3">
                    Category: {recipe.product_category}
                  </p>
                )}

                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Base Beef:</span>
                    <span className="font-medium">{(recipe.base_beef_weight / 1000).toFixed(2)} kg</span>
                  </div>
                  {recipe.target_yield_weight && (
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-600">Target Yield:</span>
                      <span className="font-medium">{recipe.target_yield_weight}g</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-600">Ingredients:</span>
                    <span className="font-medium">{recipe.ingredients?.length || 0}</span>
                  </div>
                </div>

                {recipe.description && (
                  <p className="text-sm text-gray-500 mt-3 line-clamp-2">
                    {recipe.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
