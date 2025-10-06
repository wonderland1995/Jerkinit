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
    base_beef_weight: 1,
    target_yield_weight: null,
    description: '',
    instructions: '',
      ingredients: [
    { material_id: '', quantity: 0, unit: 'g', is_critical: false, notes: null },
  ],
  });
  const [saving, setSaving] = useState(false);

type Product = { id: string; name: string; code: string };

const [products, setProducts] = useState<Product[]>([]);
const [productId, setProductId] = useState<string>("");
// Quick-add Material UI state
const [showQuickAdd, setShowQuickAdd] = useState(false);
const [newMat, setNewMat] = useState({
  name: "",
  material_code: "",
  category: "spice", // matches your DB enum
  unit: "g",         // matches your DB enum
});

const hasValid = formData.ingredients.some(ing => ing.material_id && Number(ing.quantity) > 0);


useEffect(() => {
  fetchMaterials();
  (async () => {
    const res = await fetch("/api/products");
    const data = await res.json();
    setProducts(data.products ?? []);
  })();
}, []);

const fetchMaterials = async () => {
    const res = await fetch('/api/materials');
    const data = await res.json();
    setMaterials(data.materials);
  };
const quickCreateMaterial = async () => {
  // light validation
  if (!newMat.name.trim() || !newMat.material_code.trim()) {
    alert("Please enter a name and a code");
    return;
  }

  const res = await fetch("/api/materials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: newMat.name.trim(),
      material_code: newMat.material_code.trim().toUpperCase(),
      category: newMat.category, // 'beef' | 'spice' | 'packaging' | 'additive' | 'cure' | 'other'
      unit: newMat.unit,         // 'g' | 'kg' | 'ml' | 'L' | 'units'
    }),
  });

  const json: { material?: Material; error?: string } = await res.json();
  if (!res.ok || !json.material) {
    alert(json.error ?? "Failed to create material");
    return;
  }

  const material = json.material as Material;

  // 1) Add to dropdown (keep sorted by name)
  setMaterials(prev => [...prev, material].sort((a, b) => a.name.localeCompare(b.name)));

  // 2) If there’s an empty ingredient row, auto-select this new material there and set the unit
  setFormData(prev => {
    const next = { ...prev };
    if (next.ingredients.length === 0) {
      next.ingredients = [{ material_id: "", quantity: 0, unit: "g", is_critical: false, notes: null }];
    }
    const firstEmpty = next.ingredients.findIndex(r => !r.material_id);
    const idx = firstEmpty === -1 ? 0 : firstEmpty;
    const row = { ...next.ingredients[idx], material_id: material.id, unit: material.unit };
    const clone = next.ingredients.slice();
    clone[idx] = row;
    next.ingredients = clone;
    return next;
  });

  // 3) Reset and hide the quick add panel
  setNewMat({ name: "", material_code: "", category: "spice", unit: "g" });
  setShowQuickAdd(false);
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

  const updateIngredient = (index: number, field: string, value: string | number | boolean) => {
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

  const validIngredients = formData.ingredients
    .filter(ing => ing.material_id && Number(ing.quantity) > 0 && ing.unit);

  if (validIngredients.length === 0) {
    alert('Please add at least one ingredient with a material and a quantity > 0.');
    setSaving(false);
    return;
  }

  try {
    const res = await fetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // product_id is optional; API will auto-create/reuse from recipe_code
      body: JSON.stringify({ ...formData, ingredients: validIngredients, product_id: productId || undefined }),
    });

    const data: { id?: string; error?: string } = await res.json().catch(() => ({} as never));
    if (!res.ok || !data.id) {
      alert(data.error ?? 'Failed to create recipe');
      return;
    }
    window.location.href = `/recipes/${data.id}`;
  } catch (_err) {
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
    Product *
  </label>
  <select
    required
    value={productId}
    onChange={(e) => setProductId(e.target.value)}
    className="w-full border border-gray-300 rounded px-3 py-2"
  >
    <option value="">Select product...</option>
    {products.map((p) => (
      <option key={p.id} value={p.id}>
        {p.name} ({p.code})
      </option>
    ))}
  </select>
</div>

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
  {/* Quick add material toggle + panel */}
  <div className="flex justify-between items-center mb-3">
    <div />
    <button
      type="button"
      onClick={() => setShowQuickAdd(s => !s)}
      className="text-sm px-3 py-1 rounded border hover:bg-gray-50"
    >
      {showQuickAdd ? "Close quick add" : "Quick add material"}
    </button>
  </div>

  {showQuickAdd && (
    <div className="mb-4 grid grid-cols-1 md:grid-cols-5 gap-2 bg-gray-50 p-3 rounded border">
      <input
        className="border rounded px-2 py-1"
        placeholder="Name (e.g., Garlic Powder)"
        value={newMat.name}
        onChange={(e) => setNewMat(m => ({ ...m, name: e.target.value }))}
      />
      <input
        className="border rounded px-2 py-1"
        placeholder="Code (e.g., GAR-PDR)"
        value={newMat.material_code}
        onChange={(e) => setNewMat(m => ({ ...m, material_code: e.target.value.toUpperCase() }))}
      />
      <select
        className="border rounded px-2 py-1"
        value={newMat.category}
        onChange={(e) => setNewMat(m => ({ ...m, category: e.target.value }))}
      >
        <option value="beef">beef</option>
        <option value="spice">spice</option>
        <option value="additive">additive</option>
        <option value="cure">cure</option>
        <option value="packaging">packaging</option>
        <option value="other">other</option>
      </select>
      <select
        className="border rounded px-2 py-1"
        value={newMat.unit}
        onChange={(e) => setNewMat(m => ({ ...m, unit: e.target.value }))}
      >
        <option value="g">g</option>
        <option value="kg">kg</option>
        <option value="ml">ml</option>
        <option value="L">L</option>
        <option value="units">units</option>
      </select>
      <button
        type="button"
        onClick={quickCreateMaterial}
        className="px-3 py-1 rounded bg-black text-white"
      >
        Add
      </button>
    </div>
  )}

            {formData.ingredients.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No ingredients added yet. Click &quot;Add Ingredient&quot; to start.</p>
            ) : (
              <div className="space-y-3">
                {formData.ingredients.map((ingredient, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                    <div className="flex-1">
<select
  required
  value={ingredient.material_id}
  onChange={(e) => {
    const id = e.currentTarget.value;
    const mat = materials.find(m => m.id === id);

    // update this row only
    setFormData(prev => {
      const next = { ...prev };
      const rows = next.ingredients.slice();
      const row = { ...rows[index] };

      row.material_id = id;
      if (mat) row.unit = mat.unit; // auto-fill unit from material

      rows[index] = row;
      next.ingredients = rows;
      return next;
    });
  }}
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
  min="0"
  step="0.01"
  value={ingredient.quantity}
  onChange={(e) => {
    const v = Number.isNaN(e.currentTarget.valueAsNumber) ? 0 : e.currentTarget.valueAsNumber;
    setFormData(prev => {
      const next = { ...prev };
      const rows = next.ingredients.slice();
      rows[index] = { ...rows[index], quantity: v };
      next.ingredients = rows;
      return next;
    });
  }}
  className="w-full border border-gray-300 rounded px-3 py-2"
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
                        <option value="units">units</option>
                      </select>
                    </div>

                    <label className="flex items-center">
                      <input
  type="checkbox"
  checked={ingredient.is_critical}
  onChange={(e) => {
    const v = e.currentTarget.checked;
    setFormData(prev => {
      const next = { ...prev };
      const rows = next.ingredients.slice();
      rows[index] = { ...rows[index], is_critical: v };
      next.ingredients = rows;
      return next;
    });
  }}
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
  disabled={saving || !hasValid}
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