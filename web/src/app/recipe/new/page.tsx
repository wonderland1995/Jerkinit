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
type CreateBatchResponse = {
  batch_id: string | null;
  lines: RecipeLine[];
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
      .then((r) => r.json() as Promise<{ data: Product[] }>)
      .then(({ data }) => setProducts(data ?? []))
      .catch(() => setProducts([]));
  }, []);

  const anyFail = useMemo(() => {
    return lines.some((l) => {
      const a = actuals[l.line_no];
      if (a == null || Number.isNaN(a)) return false;
      const diff = Math.abs(a - l.target_amount);
      return diff > l.target_amount * (l.tolerance_pct / 100);
    });
  }, [lines, actuals]);

  async function createBatch() {
    if (!productId || !beefKg) return;
    setLoading(true);
    setErr(null);
    setBatchId(null);
    setLines([]);
    setActuals({});
    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ product_id: productId, beef_kg: beefKg }),
      });
      const json: CreateBatchResponse | { error: string } = await res.json();
      if (!res.ok) throw new Error((json as any).error || "Failed to create batch");
      const ok = json as CreateBatchResponse;
      setBatchId(ok.batch_id);
      setLines(
        (ok.lines || []).map((l) => ({
          ...l,
          target_amount: Number(l.target_amount),
          tolerance_pct: Number(l.tolerance_pct),
          is_cure: Boolean(l.is_cure),
        }))
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  function setActual(lineNo: number, value: string) {
    const v = value === "" ? NaN : Number(value);
    setActuals((prev) => ({ ...prev, [lineNo]: v }));
  }

  return (
    <main className="p-6 max-w-3xl">
      {/* ...rest unchanged... */}
    </main>
  );
}
