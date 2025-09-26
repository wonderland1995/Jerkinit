// src/components/RecipeForm.tsx

'use client';

import type { Product, RecipeFormState } from '../types/database';

interface RecipeFormProps {
  products: Product[];
  formState: RecipeFormState;
  onFormChange: (state: RecipeFormState) => void;
  onSubmit: () => void;
}

export function RecipeForm({
  products,
  formState,
  onFormChange,
  onSubmit
}: RecipeFormProps) {
  const handleInputChange = (field: keyof RecipeFormState, value: string) => {
    onFormChange({
      ...formState,
      [field]: value,
      error: null // Clear error on input change
    });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="product" className="block text-sm font-medium text-gray-700 mb-2">
            Select Product *
          </label>
          <select
            id="product"
            value={formState.selectedProductId}
            onChange={(e) => handleInputChange('selectedProductId', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
            disabled={formState.isLoading || !products || products.length === 0}
          >
            <option value="">Choose a product...</option>
            {products && products.length > 0 ? (
              products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.code})
                </option>
              ))
            ) : (
              <option value="" disabled>No products available</option>
            )}
          </select>
        </div>
        
        <div>
          <label htmlFor="beefWeight" className="block text-sm font-medium text-gray-700 mb-2">
            Beef Weight (kg) *
          </label>
          <input
            type="number"
            id="beefWeight"
            value={formState.beefWeight}
            onChange={(e) => handleInputChange('beefWeight', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter weight in kg"
            step="0.001"
            min="0.001"
            required
            disabled={formState.isLoading}
          />
        </div>
      </div>
      
      <div>
        <label htmlFor="operator" className="block text-sm font-medium text-gray-700 mb-2">
          Operator Name (Optional)
        </label>
        <input
          type="text"
          id="operator"
          value={formState.operatorName}
          onChange={(e) => handleInputChange('operatorName', e.target.value)}
          className="w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter your name"
          disabled={formState.isLoading}
        />
      </div>
      
      {formState.error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">{formState.error}</p>
        </div>
      )}
      
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={formState.isLoading || !products || products.length === 0 || !formState.selectedProductId || !formState.beefWeight}
          className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {formState.isLoading ? (
            <>
              <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
              Creating...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Batch & Get Recipe
            </>
          )}
        </button>
      </div>
    </form>
  );
}