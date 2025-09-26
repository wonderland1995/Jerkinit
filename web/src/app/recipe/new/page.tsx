"use client";
import { useEffect, useMemo, useState } from "react";

type Product = { id: string; sku: string; name: string };
type RecipeLine = {
  line_no: number;
  ingredient_name: string;
  target_amount: number;
  uom: string;
  tolerance_pct: number;
  is_cure: boolean;
};

export default function RecipeBuilder() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState<string>("");
  const [beefKg, setBeefKg] = useState<number>(10);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [lines, setLines] = useState<RecipeLine[]>([]);
  const [actuals, setActuals] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/products")
      .then(r => r.json())
      .then(({ data }) => setProducts(data ?? []))
      .catch(() => setProducts([]));
  }, []);

  const anyFail = useMemo(() => {
    return lines.some(l => {
      const a = actuals[l.line_no];
      if (a == null || Number.isNaN(a)) return false;
      const diff = Math.abs(a - l.target_amount);
      return diff > (l.target_amount * (l.tolerance_pct / 100));
    });
  }, [lines, actuals]);

  async function createBatch() {
    if (!productId || !beefKg) return;
    setLoading(true); setErr(null); setBatchId(null); setLines([]); setActuals({});
    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ product_id: productId, beef_kg: beefKg }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create batch");
      setBatchId(json.batch_id);
      // normalize numeric
      setLines((json.lines || []).map((l: any) => ({
        line_no: l.line_no,
        ingredient_name: l.ingredient_name,
        target_amount: Number(l.target_amount),
        uom: l.uom,
        tolerance_pct: Number(l.tolerance_pct),
        is_cure: !!l.is_cure,
      })));
    } catch (e: any) {
      setErr(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function setActual(lineNo: number, value: string) {
    const v = value === "" ? NaN : Number(value);
    setActuals(prev => ({ ...prev, [lineNo]: v }));
  }

  return (
    <main className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Recipe Builder</h1>
      <p className="text-sm text-gray-600 mt-1">
        Select a product and enter beef weight. We’ll create a batch, scale the recipe, and you can record actuals.
      </p>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium">Product</label>
          <select
            className="mt-1 w-full border rounded p-2"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">Select product…</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Beef (kg)</label>
          <input
            type="number"
            step="0.01"
            className="mt-1 w-full border rounded p-2"
            value={beefKg}
            onChange={(e) => setBeefKg(parseFloat(e.target.value))}
          />
        </div>
      </section>

      <div className="mt-4">
        <button
          onClick={createBatch}
          disabled={loading || !productId || !beefKg}
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create Batch & Scale"}
        </button>
      </div>

      {err && <p className="mt-4 text-red-600">{err}</p>}

      {batchId && (
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Batch: {batchId}</h2>
            <div className={`text-sm ${anyFail ? "text-red-600" : "text-green-700"}`}>
              {anyFail ? "⚠️ Out-of-tolerance items present" : "✓ All within tolerance (so far)"}
            </div>
          </div>

          <div className="mt-3 border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">#</th>
                  <th className="text-left p-2">Ingredient</th>
                  <th className="text-right p-2">Target</th>
                  <th className="text-right p-2">Actual</th>
                  <th className="text-left p-2">UOM</th>
                  <th className="text-left p-2">Tol</th>
                  <th className="text-left p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const a = actuals[l.line_no];
                  const hasActual = a != null && !Number.isNaN(a);
                  const diff = hasActual ? Math.abs(a - l.target_amount) : 0;
                  const ok = hasActual ? diff <= (l.target_amount * (l.tolerance_pct / 100)) : null;
                  return (
                    <tr key={l.line_no} className="border-t">
                      <td className="p-2">{l.line_no}</td>
                      <td className="p-2">
                        {l.ingredient_name} {l.is_cure && <span className="text-xs text-purple-700 font-semibold">CURE</span>}
                      </td>
                      <td className="p-2 text-right font-mono">{l.target_amount.toFixed(2)}</td>
                      <td className="p-2 text-right">
                        <input
                          inputMode="decimal"
                          className="w-28 border rounded p-1 text-right font-mono"
                          placeholder="0.00"
                          value={Number.isNaN(a) || a == null ? "" : a}
                          onChange={(e) => setActual(l.line_no, e.target.value)}
                        />
                      </td>
                      <td className="p-2">{l.uom}</td>
                      <td className="p-2">±{l.tolerance_pct}%</td>
                      <td className="p-2">
                        {ok === null ? <span className="text-gray-400">—</span> :
                         ok ? <span className="text-green-700">✓ OK</span> :
                              <span className="text-red-600">✗ Out</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Print later hook */}
          <div className="mt-4 flex gap-2">
            <button
              className="px-3 py-2 rounded border"
              onClick={() => window.print()}
            >
              Print Recipe
            </button>
            <button
              className="px-3 py-2 rounded border"
              onClick={() => alert("Save coming next (weigh events).")}
            >
              Save Weigh Events
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
