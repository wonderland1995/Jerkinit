import type { RecipeLineItem } from '../types/database';

interface PrintableRecipeProps {
  batchId: string;
  productName: string;
  beefWeight: number;
  ingredients: RecipeLineItem[];
  operatorName?: string;
  createdAt: string;
}

export function PrintableRecipe({
  batchId,
  productName,
  beefWeight,
  ingredients,
  operatorName,
  createdAt
}: PrintableRecipeProps) {
  const hasCureIngredients = ingredients.some(ing => ing.is_cure);
  const allInTolerance = ingredients.every(ing => 
    ing.actual_amount === null || ing.in_tolerance === true
  );
  
  return (
    <div className="print-content">
      <div className="header">
        <h1>Recipe Card - Batch {batchId}</h1>
        <div className="info-grid">
          <div className="info-item">
            <strong>Product:</strong> {productName}
          </div>
          <div className="info-item">
            <strong>Date:</strong> {new Date(createdAt).toLocaleDateString()}
          </div>
          <div className="info-item">
            <strong>Beef Weight:</strong> {beefWeight} kg
          </div>
          <div className="info-item">
            <strong>Operator:</strong> {operatorName || 'Not specified'}
          </div>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Ingredient</th>
            <th>Target Amount</th>
            <th>Unit</th>
            <th>Tolerance Range</th>
            <th>Actual Amount</th>
            <th>Status</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {ingredients.map((item) => {
            const min = item.target_amount * (1 - item.tolerance_percentage / 100);
            const max = item.target_amount * (1 + item.tolerance_percentage / 100);
            
            return (
              <tr key={item.ingredient_name}>
                <td>
                  {item.ingredient_name}
                  {item.is_cure && ' (CURE)'}
                </td>
                <td>{item.target_amount.toFixed(2)}</td>
                <td>{item.unit}</td>
                <td>{min.toFixed(2)} - {max.toFixed(2)}</td>
                <td>
                  {item.actual_amount !== null 
                    ? item.actual_amount.toFixed(2) 
                    : '________'}
                </td>
                <td>
                  {item.actual_amount !== null
                    ? (item.in_tolerance ? '✓ OK' : '✗ OUT')
                    : '________'}
                </td>
                <td>________________</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      
      {hasCureIngredients && (
        <div className="cure-warning">
          ⚠️ CURE INGREDIENTS PRESENT - Handle with care and follow safety protocols
        </div>
      )}
      
      <div style={{ marginTop: '30px' }}>
        <p><strong>Quality Check:</strong></p>
        <p style={{ marginTop: '10px' }}>
          {allInTolerance 
            ? '✓ All ingredients within tolerance' 
            : '✗ Some ingredients out of tolerance - Review required'}
        </p>
        <div style={{ marginTop: '20px' }}>
          <p>Approved by: ________________________</p>
          <p style={{ marginTop: '10px' }}>Date: ________________________</p>
        </div>
      </div>
    </div>
  );
}