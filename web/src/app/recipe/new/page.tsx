'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Product {
  id: string;
  name: string;
  code: string;
}

interface Recipe {
  id: string;
  name: string;
  recipe_code: string;
  product_id: string;
  base_beef_weight: number;
  ingredients?: { name: string; unit: string; quantityPerKg: number }[];
}

export default function NewBatchPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [beefWeight, setBeefWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchRecipes();
  }, []);

  useEffect(() => {
    // Auto-select recipe when product is selected
    if (selectedProductId && recipes.length > 0) {
      const productRecipe = recipes.find(r => r.product_id === selectedProductId);
      if (productRecipe) {
        setSelectedRecipeId(productRecipe.id);
      }
    }
  }, [selectedProductId, recipes]);

  const fetchProducts = async () => {
    const res = await fetch('/api/products');
    if (res.ok) {
      const data = await res.json();
      setProducts(data.products || []);
    }
  };

  const fetchRecipes = async () => {
    const res = await fetch('/api/recipes');
    if (res.ok) {
      const data = await res.json();
      setRecipes(data.recipes || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch('/api/batches/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: selectedProductId,
          recipe_id: selectedRecipeId || null,
          beef_weight_kg: parseFloat(beefWeight),
          created_by: 'User', // Replace with actual user from auth
          notes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/batches/${data.batch.id}`);
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      alert('Failed to create batch');
    } finally {
      setCreating(false);
    }
  };

  const selectedRecipe = recipes.find(r => r.id === selectedRecipeId);
  const scalingFactor = selectedRecipe && beefWeight 
    ? parseFloat(beefWeight) / selectedRecipe.base_beef_weight 
    : 1;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-5 py-4">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-700 mb-2"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold">Create New Batch</h1>
          <p className="text-gray-600 mt-1">Start a new production batch</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-5 py-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border shadow-sm p-6 space-y-6">
          {/* Product Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product *
            </label>
            <select
              required
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a product...</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.code})
                </option>
              ))}
            </select>
          </div>

          {/* Recipe Selection (if available) */}
          {recipes.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Recipe
              </label>
              <select
                value={selectedRecipeId}
                onChange={(e) => setSelectedRecipeId(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">No recipe (manual ingredients)</option>
                {recipes
                  .filter(r => !selectedProductId || r.product_id === selectedProductId)
                  .map((recipe) => (
                    <option key={recipe.id} value={recipe.id}>
                      {recipe.name} ({recipe.recipe_code})
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Beef Weight */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Beef Weight (kg) *
            </label>
            <input
              type="number"
              required
              min="0.1"
              step="0.1"
              value={beefWeight}
              onChange={(e) => setBeefWeight(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., 10.5"
            />
          </div>

          {/* Scaling Info */}
          {selectedRecipe && beefWeight && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Recipe Scaling</h3>
              <div className="text-sm text-blue-800 space-y-1">
                <p>Base recipe: {selectedRecipe.base_beef_weight} kg</p>
                <p>Your batch: {beefWeight} kg</p>
                <p className="font-semibold">Scaling factor: {scalingFactor.toFixed(2)}x</p>
                {selectedRecipe.ingredients && (
                  <p className="mt-2">All {selectedRecipe.ingredients.length} ingredients will be scaled automatically</p>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Any special notes for this batch..."
            />
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !selectedProductId || !beefWeight}
              className="flex-1 bg-gray-900 text-white px-6 py-3 rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {creating ? 'Creating...' : 'Create Batch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}