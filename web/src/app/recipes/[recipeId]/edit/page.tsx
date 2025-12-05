'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';
import { CURE_OPTIONS, type CureType, parseCureNote } from '@/lib/cure';

type Unit = 'g' | 'kg' | 'ml' | 'L' | 'units';

type Material = {
  id: string;
  name: string;
  material_code: string;
  unit: Unit;
};

type IngredientRow = {
  material_id: string;
  quantity: number;
  unit: Unit;
  is_critical: boolean;
  notes: string | null;
  is_cure: boolean;
  cure_type: CureType | null;
};

type RecipeIngredient = {
  id: string;
  material_id: string;
  quantity: number;
  unit: Unit;
  is_critical: boolean;
  notes: string | null;
  display_order: number;
  material?: Material;
  is_cure?: boolean;
  cure_type?: CureType | null;
};

type Recipe = {
  id: string;
  name: string;
  recipe_code: string;
  base_beef_weight: number;         // grams (storage)
  target_yield_weight: number | null;
  description: string | null;
  instructions: string | null;
  is_active: boolean;
  recipe_ingredients: RecipeIngredient[];
};

type RecipeGetResponse = { recipe: Recipe } | { error: string };
type PutResponse = { ok: true } | { error: string };

export default function EditRecipePage() {
  const { recipeId } = useParams<{ recipeId: string }>();
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [recipe, setRecipe] = useState<Recipe | null>(null);

  // local editable fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState<string>('');
  const [instructions, setInstructions] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [baseBeefKg, setBaseBeefKg] = useState<number>(1);
  const [targetYield, setTargetYield] = useState<number | null>(null);
  const [rows, setRows] = useState<IngredientRow[]>([]);

  // Load materials + recipe
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // materials
      const mRes = await fetch('/api/materials');
      const mJson = await mRes.json();
      const mList: Material[] = Array.isArray(mJson.materials) ? mJson.materials : [];
      if (!cancelled) setMaterials(mList);

      // recipe
      const rRes = await fetch(`/api/recipes/${recipeId}`);
      const rJson = (await rRes.json()) as RecipeGetResponse;
      if (cancelled) return;

      if (!rRes.ok || 'error' in rJson) {
        setRecipe(null);
        setLoading(false);
        return;
      }

      const rec = rJson.recipe;
      setRecipe(rec);
      setName(rec.name);
      setDescription(rec.description ?? '');
      setInstructions(rec.instructions ?? '');
      setIsActive(Boolean(rec.is_active));
      setBaseBeefKg(Number.isFinite(rec.base_beef_weight) ? Number(rec.base_beef_weight) / 1000 : 1);
      setTargetYield(
        typeof rec.target_yield_weight === 'number' ? rec.target_yield_weight : null
      );

      // map existing ingredients -> editable rows
      const mapped: IngredientRow[] = [...(rec.recipe_ingredients ?? [])]
        .sort((a, b) => a.display_order - b.display_order)
        .map((ri) => {
          const unit = ri.unit as Unit;
          const quantity = unit === 'kg' ? Number(ri.quantity) * 1000 : Number(ri.quantity);
          return {
            material_id: ri.material_id,
            quantity,
            unit: unit === 'kg' ? 'g' : unit,
            is_critical: Boolean(ri.is_critical),
            notes: ri.notes ?? null,
            is_cure: Boolean(ri.is_cure),
            cure_type: ri.cure_type ?? parseCureNote(ri.notes ?? null),
          };
        });
      setRows(mapped);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  const canSave = useMemo(() => {
    // need name + at least one ingredient with qty > 0
    if (!name.trim()) return false;
    const validCount = rows.filter((r) => r.material_id && (r.is_cure || Number(r.quantity) > 0) && r.unit).length;
    return validCount > 0;
  }, [name, rows]);

  const addRow = () => {
    // default: first material (if any)
    const defaultMaterial = materials[0]?.id ?? '';
    // default unit: always grams for consistency
    const defaultUnit: Unit = 'g';
    setRows((prev) => [
      ...prev,
      {
        material_id: defaultMaterial,
        quantity: 0,
        unit: defaultUnit,
        is_critical: false,
        notes: null,
        is_cure: false,
        cure_type: null,
      },
    ]);
  };

  const updateRow = <K extends keyof IngredientRow>(
    idx: number,
    key: K,
    value: IngredientRow[K]
  ) => {
    setRows((prev) =>
      prev.map((row, rowIdx) => {
        if (rowIdx !== idx) {
          if (key === 'is_cure' && value) {
            return { ...row, is_cure: false, cure_type: null };
          }
          return row;
        }

        if (key === 'is_cure') {
          const checked = Boolean(value);
          return {
            ...row,
            is_cure: checked,
            cure_type: checked ? row.cure_type ?? 'denkurit' : null,
          };
        }

        if (key === 'cure_type') {
          return { ...row, cure_type: value as CureType };
        }

        return { ...row, [key]: value };
      })
    );
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    if (!recipe) return;
    if (!canSave) {
      toast.error('Please add at least one valid ingredient.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        instructions: instructions.trim() || null,
        is_active: isActive,
        base_beef_weight: Math.round(baseBeefKg * 1000), // grams
        target_yield_weight: targetYield === null ? null : Number(targetYield),
        ingredients: rows
          .map((r) => ({
            material_id: r.material_id,
            quantity: Number(r.quantity),
            unit: 'g',
            is_critical: Boolean(r.is_critical),
            notes: r.notes && r.notes.trim() ? r.notes.trim() : null,
            is_cure: r.is_cure,
            cure_type: r.cure_type,
          }))
          .filter((ing) => ing.material_id && (ing.is_cure || ing.quantity > 0)),
      };

      const res = await fetch(`/api/recipes/${recipeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => ({} as PutResponse))) as PutResponse;
      if (!res.ok || 'error' in data) {
        toast.error(('error' in data && data.error) || 'Failed to update recipe');
        setSaving(false);
        return;
        }

      toast.success('Recipe updated successfully.');
      router.push(`/recipes/${recipeId}`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to update recipe');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Loading…</div>;
  if (!recipe) return <div className="p-6">Recipe not found</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Edit Recipe — {recipe.recipe_code}</h1>

      {/* Basics */}
      <div className="rounded-xl border bg-white p-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Name</span>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Active</span>
            <div className="mt-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.currentTarget.checked)}
              />{' '}
              <span className="text-sm">Enabled</span>
            </div>
          </label>

          <label className="block">
            <span className="text-sm font-medium">Base Beef Weight (g)</span>
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded border px-3 py-2"
              value={baseBeefKg}
              onChange={(e) => setBaseBeefGrams(Number(e.currentTarget.value || 0))}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Target Yield (g)</span>
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded border px-3 py-2"
              value={targetYield ?? ''}
              onChange={(e) =>
                setTargetYield(e.currentTarget.value ? Number(e.currentTarget.value) : null)
              }
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium">Description</span>
          <textarea
            rows={2}
            className="mt-1 w-full rounded border px-3 py-2"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            placeholder="Optional…"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Instructions</span>
          <textarea
            rows={4}
            className="mt-1 w-full rounded border px-3 py-2"
            value={instructions}
            onChange={(e) => setInstructions(e.currentTarget.value)}
            placeholder="Optional…"
          />
        </label>
      </div>

      {/* Ingredients */}
      <div className="rounded-xl border bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ingredients</h2>
          <button
            type="button"
            onClick={addRow}
            className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
          >
            + Add Ingredient
          </button>
        </div>

        {rows.length === 0 ? (
          <div className="rounded border border-dashed p-6 text-center text-gray-500">
            No ingredients yet. Click “Add Ingredient”.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="p-2">Material</th>
                  <th className="p-2 w-28">Qty</th>
                  <th className="p-2 w-24">Unit</th>
                  <th className="p-2 w-20">Critical</th>
                  <th className="p-2 w-32">Cure</th>
                  <th className="p-2">Notes</th>
                  <th className="p-2 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={`${r.material_id}-${idx}`} className="border-b last:border-0">
                    <td className="p-2">
                      <select
                        className="w-full rounded border px-2 py-1.5"
                        value={r.material_id}
                        onChange={(e) => {
                          const id = e.currentTarget.value;
                          updateRow(idx, 'material_id', id);
                          updateRow(idx, 'unit', 'g');
                        }}
                        required
                      >
                        <option value="">Select material…</option>
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.material_code})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        className="w-full rounded border px-2 py-1.5"
                        value={r.quantity}
                        onChange={(e) => updateRow(idx, 'quantity', Number(e.currentTarget.value || 0))}
                        required={!r.is_cure}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="w-full rounded border px-2 py-1.5 bg-gray-50 text-gray-700"
                        value="g"
                        disabled
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={r.is_critical}
                        onChange={(e) => updateRow(idx, 'is_critical', e.currentTarget.checked)}
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex flex-col gap-2 text-sm">
                        <label className="inline-flex items-center gap-2 text-purple-700">
                          <input
                            type="checkbox"
                            checked={r.is_cure}
                            onChange={(e) => updateRow(idx, 'is_cure', e.currentTarget.checked)}
                          />
                          Cure
                        </label>
                        {r.is_cure && (
                          <select
                            value={r.cure_type ?? 'denkurit'}
                            onChange={(e) => updateRow(idx, 'cure_type', e.currentTarget.value as CureType)}
                            className="rounded border border-purple-200 px-2 py-1.5 text-sm"
                          >
                            {CURE_OPTIONS.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label} ({option.nitritePercent}%)
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>
                    <td className="p-2">
                      <input
                        className="w-full rounded border px-2 py-1.5"
                        value={r.notes ?? ''}
                        onChange={(e) => updateRow(idx, 'notes', e.currentTarget.value || null)}
                        placeholder="Optional…"
                      />
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="rounded px-2 py-1 text-red-600 hover:bg-red-50"
                        title="Remove"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded border px-4 py-2"
            onClick={() => router.back()}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
            onClick={save}
            disabled={saving || !canSave}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}







