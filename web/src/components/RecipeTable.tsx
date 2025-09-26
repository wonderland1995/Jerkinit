// src/components/RecipeTable.tsx

'use client';

import { useState } from 'react';
import type { RecipeLineItem } from '../types/database';

interface RecipeTableProps {
  ingredients: RecipeLineItem[];
  onUpdateAmount: (ingredientName: string, actualAmount: number) => void;
}

export function RecipeTable({ ingredients, onUpdateAmount }: RecipeTableProps) {
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [tempValues, setTempValues] = useState<Record<string, string>>({});
  
  const handleEdit = (ingredientName: string, currentValue: number | null) => {
    setEditingRow(ingredientName);
    setTempValues({
      ...tempValues,
      [ingredientName]: currentValue?.toString() || ''
    });
  };
  
  const handleSave = (ingredientName: string) => {
    const value = parseFloat(tempValues[ingredientName]);
    if (!isNaN(value) && value >= 0) {
      onUpdateAmount(ingredientName, value);
      setEditingRow(null);
    }
  };
  
  const handleCancel = () => {
    setEditingRow(null);
    setTempValues({});
  };
  
  const handleKeyPress = (e: React.KeyboardEvent, ingredientName: string) => {
    if (e.key === 'Enter') {
      handleSave(ingredientName);
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };
  
  const getToleranceStatus = (item: RecipeLineItem) => {
    if (item.actual_amount === null) return null;
    return item.in_tolerance;
  };
  
  const getToleranceRange = (target: number, tolerance: number) => {
    const min = target * (1 - tolerance / 100);
    const max = target * (1 + tolerance / 100);
    return { min, max };
  };
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100 border-b-2 border-gray-300">
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Ingredient</th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Target</th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Unit</th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Tolerance</th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Range</th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Actual</th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Status</th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Action</th>
          </tr>
        </thead>
        <tbody>
          {ingredients.map((item, index) => {
            const isEditing = editingRow === item.ingredient_name;
            const toleranceStatus = getToleranceStatus(item);
            const { min, max } = getToleranceRange(item.target_amount, item.tolerance_percentage);
            
            return (
              <tr 
                key={item.ingredient_name}
                className={`border-b ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}
              >
                <td className="px-4 py-3 font-medium text-gray-900">
                  {item.ingredient_name}
                  {item.is_cure && (
                    <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                      CURE
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-center font-mono text-sm">
                  {item.target_amount.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-center text-sm">{item.unit}</td>
                <td className="px-4 py-3 text-center text-sm">
                  ±{item.tolerance_percentage}%
                </td>
                <td className="px-4 py-3 text-center text-sm text-gray-600 font-mono">
                  {min.toFixed(2)} - {max.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-center">
                  {isEditing ? (
                    <input
                      type="number"
                      value={tempValues[item.ingredient_name] || ''}
                      onChange={(e) => setTempValues({
                        ...tempValues,
                        [item.ingredient_name]: e.target.value
                      })}
                      onKeyDown={(e) => handleKeyPress(e, item.ingredient_name)}
                      className="w-24 px-2 py-1 border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                      step="0.01"
                      autoFocus
                    />
                  ) : (
                    <span className={`font-mono text-sm ${item.actual_amount !== null ? 'font-semibold' : 'text-gray-400'}`}>
                      {item.actual_amount !== null ? item.actual_amount.toFixed(2) : '-'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {toleranceStatus === true && (
                    <span className="inline-flex items-center px-2.5 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                      ✓ OK
                    </span>
                  )}
                  {toleranceStatus === false && (
                    <span className="inline-flex items-center px-2.5 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">
                      ✗ OUT
                    </span>
                  )}
                  {toleranceStatus === null && (
                    <span className="text-gray-400 text-sm">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {isEditing ? (
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => handleSave(item.ingredient_name)}
                        className="p-1 text-green-600 hover:bg-green-100 rounded"
                        title="Save"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={handleCancel}
                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                        title="Cancel"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEdit(item.ingredient_name, item.actual_amount)}
                      className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                      title="Edit"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}