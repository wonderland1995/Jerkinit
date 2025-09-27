// src/app/recipe/new/page.tsx

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RecipeForm } from '@/components/RecipeForm';
import { RecipeTable } from '@/components/RecipeTable';
import { PrintableRecipe } from '@/components/PrintableRecipe';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { AlertMessage } from '@/components/AlertMessage';
import type {
  Product,
  CreateBatchResponse,
  RecipeLineItem,
  RecipeFormState,
  BatchRecipeState
} from '@/types/database';

export default function NewRecipePage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);

  const [formState, setFormState] = useState<RecipeFormState>({
    selectedProductId: '',
    beefWeight: '',
    operatorName: '',
    isLoading: false,
    error: null
  });

  const [batchState, setBatchState] = useState<BatchRecipeState>({
    batchId: null,
    batchUuid: null,
    productName: null,
    ingredients: [],
    isComplete: false,
    beefWeightKg: null,
  });

  const printRef = useRef<HTMLDivElement>(null);

  // Fetch products on mount
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setProductsLoading(true);
      setProductsError(null);

      const response = await fetch('/api/products');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch products`);
      }

      const data = await response.json();
      if (!data.products) {
        throw new Error('Invalid response format');
      }
      setProducts(data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      setProductsError(error instanceof Error ? error.message : 'Failed to load products');
      setProducts([]); // Set empty array on error
    } finally {
      setProductsLoading(false);
    }
  };

  const handleCreateBatch = async () => {
    if (!formState.selectedProductId || !formState.beefWeight) {
      setFormState(prev => ({
        ...prev,
        error: 'Please select a product and enter beef weight'
      }));
      return;
    }

    try {
      setFormState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/batches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_id: formState.selectedProductId,
          beef_weight_kg: parseFloat(formState.beefWeight),
          created_by: formState.operatorName || null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create batch');
      }

      const data: CreateBatchResponse = await response.json();
      const weightKg = parseFloat(formState.beefWeight);

      // Transform ingredients to RecipeLineItems
      const recipeItems: RecipeLineItem[] = data.ingredients.map(ing => ({
        ...ing,
        actual_amount: null,
        in_tolerance: null
      }));

      setBatchState({
        batchId: data.batch_id,
        batchUuid: data.batch_uuid,
        productName: data.product_name,
        ingredients: recipeItems,
        isComplete: false,
        beefWeightKg: weightKg,
      });

      // Reset form
      setFormState({
        selectedProductId: '',
        beefWeight: '',
        operatorName: '',
        isLoading: false,
        error: null
      });

    } catch (error) {
      setFormState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'An error occurred'
      }));
    }
  };

  const handleUpdateIngredient = async (ingredientName: string, actualAmount: number) => {
    if (!batchState.batchUuid) return;

    try {
      const response = await fetch('/api/batches', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batch_id: batchState.batchUuid,
          ingredient_name: ingredientName,
          actual_amount: actualAmount,
          measured_by: formState.operatorName || null
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update ingredient');
      }

      const data = await response.json();

      // Update local state
      setBatchState(prev => {
        const updatedIngredients = prev.ingredients.map(ing => {
          if (ing.ingredient_name === ingredientName) {
            return {
              ...ing,
              actual_amount: actualAmount,
              in_tolerance: data.in_tolerance
            };
          }
          return ing;
        });

        // Check if all ingredients have been measured
        const isComplete = updatedIngredients.every(ing => ing.actual_amount !== null);

        return {
          ...prev,
          ingredients: updatedIngredients,
          isComplete
        };
      });

    } catch (error) {
      console.error('Failed to update ingredient:', error);
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;

    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) return;

    const styles = `
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; }
        .print-content { max-width: 800px; margin: 0 auto; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #000; padding: 8px; text-align: left; }
        th { background-color: #f0f0f0; font-weight: bold; }
        .header { margin-bottom: 20px; }
        .header h1 { font-size: 24px; margin-bottom: 10px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
        .info-item { font-size: 14px; }
        .cure-warning { background-color: #ffeb3b; padding: 10px; margin-top: 20px; font-weight: bold; }
        @media print {
          body { padding: 0; }
          .cure-warning { break-inside: avoid; }
        }
      </style>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Recipe Card - ${batchState.batchId}</title>
          ${styles}
        </head>
        <body>
          ${printRef.current.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleReset = () => {
    setBatchState({
      batchId: null,
      batchUuid: null,
      productName: null,
      ingredients: [],
      isComplete: false,
      beefWeightKg: null,
    });
    setFormState({
      selectedProductId: '',
      beefWeight: '',
      operatorName: '',
      isLoading: false,
      error: null
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-8">
          {/* Back button (touch-friendly) */}
          <div className="mb-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 active:scale-[0.99]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Dashboard
            </Link>
          </div>

          {/* Breadcrumbs */}
          <nav className="text-sm text-gray-500 mb-2">
            <span className="inline-flex items-center gap-2">
              <Link href="/" className="hover:text-gray-900">Home</Link>
              <span>/</span>
              <span className="hover:text-gray-900">Recipe</span>
              <span>/</span>
              <span className="text-gray-900 font-medium">New</span>
            </span>
          </nav>

          <h1 className="text-3xl font-bold text-gray-900">Recipe Builder</h1>
          <p className="mt-2 text-gray-600">
            Beef Jerky Manufacturing Traceability System
          </p>
        </header>

        {productsLoading ? (
          <LoadingSpinner />
        ) : productsError ? (
          <AlertMessage type="error" message={productsError} />
        ) : (
          <>
            {!batchState.batchId ? (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-6">Create New Batch</h2>
                <RecipeForm
                  products={products}
                  formState={formState}
                  onFormChange={setFormState}
                  onSubmit={handleCreateBatch}
                />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-xl font-semibold">Batch Recipe</h2>
                      <div className="mt-2 space-y-1">
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Batch ID:</span> {batchState.batchId}
                        </p>
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Product:</span> {batchState.productName}
                        </p>
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Beef Weight:</span>{' '}
                          {batchState.beefWeightKg != null ? batchState.beefWeightKg : 'N/A'} kg
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      {/* QA Management */}
                      <button
                        onClick={() => router.push(`/qa/batch/${batchState.batchUuid}`)}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        QA Management
                      </button>

                      <button
                        onClick={handlePrint}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                        disabled={!batchState.isComplete}
                        title={!batchState.isComplete ? 'Complete all measurements first' : ''}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Print Recipe
                      </button>

                      <button
                        onClick={handleReset}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        New Batch
                      </button>
                    </div>
                  </div>

                  <RecipeTable
                    ingredients={batchState.ingredients}
                    onUpdateAmount={handleUpdateIngredient}
                  />

                  {batchState.isComplete && (
                    <div className="mt-6 space-y-4">
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-green-800 font-medium">
                          ✓ All ingredients measured — Recipe card ready to print
                        </p>
                      </div>

                      {/* Next Steps / QA prompt */}
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h3 className="text-sm font-semibold text-blue-900 mb-2">Next Steps:</h3>
                        <ol className="text-sm text-blue-700 space-y-1 ml-4 list-decimal">
                          <li>Complete QA checkpoints during production</li>
                          <li>Upload required documentation</li>
                          <li>Perform final quality checks</li>
                          <li>Submit for batch release approval</li>
                        </ol>
                        <button
                          onClick={() => router.push(`/qa/batch/${batchState.batchUuid}`)}
                          className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          Go to QA Management →
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Hidden printable content */}
                <div className="hidden">
                  <div ref={printRef}>
                    <PrintableRecipe
                      batchId={batchState.batchId || ''}
                      productName={batchState.productName || ''}
                      beefWeight={batchState.beefWeightKg ?? 0}
                      ingredients={batchState.ingredients}
                      operatorName={formState.operatorName}
                      createdAt={new Date().toISOString()}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
