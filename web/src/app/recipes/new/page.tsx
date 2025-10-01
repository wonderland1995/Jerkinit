'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Breadcrumbs from '@/components/Breadcrumbs';
import type { Material, CreateRecipeRequest } from '@/types/inventory';

export default function CreateRecipePage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [formData, setFormData] = useState<CreateRecipeRequest>({
    name: '',
    recipe_code: '',
    product_category: '',
    base_beef_weight: 1000,
    target_yield_weight: null,
    description: '',
    instructions: '',
    ingredients: [],
  });
  const [saving, setSaving] = useState(false);

useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    const res = await fetch('/api/materials');
    const data = await res.json();
    setMaterials(data.materials);
  };

  const addIngredient = () => {
    setFormData({
      ...formData,
      ingredients: [
        ...formData.ingredients,
        {
          material_id: '',
          quantity: 0,
          unit: 'g',
          is_critical: false,
          notes: null,
        },
      ],
    });
  };

  const updateIngredient = (index: number, field: string, value: any) => {
    const updated = [...formData.ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, ingredients: updated });
  };

  const removeIngredient = (index: number) => {
    const updated = formData.ingredients.filter((_, i) => i !== index);
    setFormData({ ...formData, ingredients: updated });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        alert('Recipe created successfully!');
        window.location.href = '/recipes';
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      alert('Failed to create recipe');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/' },
        { label: 'Recipes', href: '/recipes' },
        { label: 'New Recipe', href: '/recipes/new' }
      ]} />

      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Create New Recipe</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recipe Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="e.g., Original Beef Jerky"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recipe Code *
              </label>
              <input
                type="text"
                required
                value={formData.recipe_code}
                onChange={(e) => setFormData({ ...formData, recipe_code: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="e.g., RCP-001"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Category
              </label>
              <input
                type="text"
                value={formData.product_category || ''}
                onChange={(e) => setFormData({ ...formData, product_category: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="e.g., Original, Teriyaki"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Base Beef Weight (g) *
              </label>
              <input
                type="number"
                required
                min="1"
                value={formData.base_beef_weight}
                onChange={(e) => setFormData({ ...formData, base_beef_weight: parseFloat(e.target.value) })}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Yield (g)
              </label>
              <input
                type="number"
                min="1"
                value={formData.target_yield_weight || ''}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  target_yield_weight: e.target.value ? parseFloat(e.target.value) : null 
                })}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="Brief description of this recipe..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instructions
            </label>
            <textarea
              rows={4}
              value={formData.instructions || ''}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="Step-by-step preparation instructions..."
            />
          </div>

          {/* Ingredients Section */}
          <div className="border-t pt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Ingredients</h2>
              <button
                type="button"
                onClick={addIngredient}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                + Add Ingredient
              </button>
            </div>

            {formData.ingredients.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No ingredients added yet. Click "Add Ingredient" to start.</p>
            ) : (
              <div className="space-y-3">
                {formData.ingredients.map((ingredient, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                    <div className="flex-1">
                      <select
                        required
                        value={ingredient.material_id}
                        onChange={(e) => updateIngredient(index, 'material_id', e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2"
                      >
                        <option value="">Select material...</option>
                        {materials.map((mat) => (
                          <option key={mat.id} value={mat.id}>
                            {mat.name} ({mat.material_code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-32">
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={ingredient.quantity}
                        onChange={(e) => updateIngredient(index, 'quantity', parseFloat(e.target.value))}
                        className="w-full border border-gray-300 rounded px-3 py-2"
                        placeholder="Quantity"
                      />
                    </div>

                    <div className="w-20">
                      <select
                        value={ingredient.unit}
                        onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2"
                      >
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                        <option value="ml">ml</option>
                        <option value="L">L</option>
                      </select>
                    </div>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={ingredient.is_critical}
                        onChange={(e) => updateIngredient(index, 'is_critical', e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm">Critical</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => removeIngredient(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="px-6 py-2 border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || formData.ingredients.length === 0}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Recipe'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}