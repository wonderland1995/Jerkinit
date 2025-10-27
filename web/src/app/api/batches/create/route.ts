import { createClient } from '@/lib/db';
import { NextResponse } from 'next/server';
import {
  DEFAULT_CURE_SETTINGS,
  calculateRequiredCureGrams,
  parseCureNote,
  type CurePpmSettings,
  type CureType,
} from '@/lib/cure';

type Unit = 'g' | 'kg' | 'ml' | 'L' | 'units';

const convert = (value: number, from: Unit, to: Unit): number => {
  if (!Number.isFinite(value)) return 0;
  if (from === to) return value;
  if (from === 'kg' && to === 'g') return value * 1000;
  if (from === 'g' && to === 'kg') return value / 1000;
  if (from === 'L' && to === 'ml') return value * 1000;
  if (from === 'ml' && to === 'L') return value / 1000;
  return value;
};

const resolveProductionDate = (value: unknown): string => {
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  return new Date().toISOString();
};

export async function POST(request: Request) {
  const supabase = createClient();
  const body = await request.json();

  const {
    product_id,
    recipe_id,
    beef_weight_kg,
    batch_number, // Optional, if you want to override auto-generation
    created_by,
    notes,
    production_date,
  } = body;

  const cureSettings: CurePpmSettings = { ...DEFAULT_CURE_SETTINGS };
  try {
    const { data: settingsData, error: settingsError } = await supabase
      .from('project_settings')
      .select('key,value')
      .in('key', ['cure_ppm_min', 'cure_ppm_target', 'cure_ppm_max']);

    if (!settingsError && Array.isArray(settingsData)) {
      for (const row of settingsData) {
        const key = row?.key;
        const val = row?.value;
        if (typeof key === 'string' && typeof val === 'string') {
          const parsed = Number.parseFloat(val);
          if (Number.isFinite(parsed)) {
            if (key === 'cure_ppm_min') cureSettings.cure_ppm_min = parsed;
            if (key === 'cure_ppm_target') cureSettings.cure_ppm_target = parsed;
            if (key === 'cure_ppm_max') cureSettings.cure_ppm_max = parsed;
          }
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load cure settings for batch creation; using defaults', err);
  }

  try {
    // 1. Get or generate batch_id
    let finalBatchId = batch_number;
    
    if (!finalBatchId) {
      // Use your existing batch counter logic
      const today = new Date().toISOString().split('T')[0];
      
      const { data: counter } = await supabase
        .from('batch_day_counters')
        .select('counter')
        .eq('date', today)
        .single();
      
      let nextCounter = 1;
      
      if (counter) {
        nextCounter = counter.counter + 1;
        await supabase
          .from('batch_day_counters')
          .update({ counter: nextCounter })
          .eq('date', today);
      } else {
        await supabase
          .from('batch_day_counters')
          .insert({ date: today, counter: 1 });
      }
      
      const dateDigits = today.replace(/-/g, '');
      const parsedDateNumber = Number.parseInt(dateDigits, 10);
      const base36Code = Number.isFinite(parsedDateNumber)
        ? parsedDateNumber.toString(36).toUpperCase()
        : dateDigits.toUpperCase();
      const dailySequence = String(nextCounter).padStart(3, '0');
      finalBatchId = `JI-${base36Code}-${dailySequence}`;
    }

    // 2. Get recipe with ingredients if recipe_id provided
    let scaling_factor = null;
    let recipeIngredients = [];
    
    if (recipe_id) {
      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .select(`
          *,
          ingredients:recipe_ingredients(
            *,
            material:materials(*)
          )
        `)
        .eq('id', recipe_id)
        .single();

      if (recipeError || !recipe) {
        return NextResponse.json(
          { error: 'Recipe not found' },
          { status: 404 }
        );
      }

      scaling_factor = beef_weight_kg / recipe.base_beef_weight;
      recipeIngredients = recipe.ingredients;
    }

    // 3. Create batch
    const productionDateIso = resolveProductionDate(production_date);

    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .insert({
        batch_id: finalBatchId,
        product_id,
        recipe_id,
        beef_weight_kg,
        scaling_factor,
        status: 'in_progress',
        created_by,
        notes,
        production_date: productionDateIso,
      })
      .select()
      .single();

    if (batchError) {
      return NextResponse.json({ error: batchError.message }, { status: 400 });
    }

    // 4. Create batch_ingredients records (for your existing system)
    if (recipeIngredients.length > 0) {
      interface RecipeIngredientForBatch {
        material_id: string;
        quantity: number;
        unit: string;
        tolerance_percentage: number | null;
        is_cure: boolean | null;
        notes?: string | null;
        cure_type?: string | null;
        material: { name: string };
      }
      const batchBeefGrams = Number(beef_weight_kg ?? 0) * 1000;
      const scaleMultiplier =
        typeof scaling_factor === 'number' && Number.isFinite(scaling_factor)
          ? scaling_factor
          : 1;

      const ingredientRecords = recipeIngredients.map((ing: RecipeIngredientForBatch) => {
        const unit = (ing.unit || 'g') as Unit;
        let targetAmount = Number(ing.quantity) * scaleMultiplier;

        if (ing.is_cure) {
          const cureType = (ing.cure_type as CureType | null) ?? parseCureNote(ing.notes ?? null);
          if (cureType && batchBeefGrams > 0) {
            const requiredGrams = calculateRequiredCureGrams(
              batchBeefGrams,
              cureType,
              cureSettings.cure_ppm_target
            );
            targetAmount = convert(requiredGrams, 'g', unit);
          }
        }

        return {
          batch_id: batch.id,
          material_id: ing.material_id,
          ingredient_name: ing.material.name,
          target_amount: targetAmount,
          unit,
          tolerance_percentage: ing.tolerance_percentage,
          is_cure: ing.is_cure,
        };
      });

      const { error: ingredientsError } = await supabase
        .from('batch_ingredients')
        .insert(ingredientRecords);

      if (ingredientsError) {
        console.error('Failed to create batch ingredients:', ingredientsError);
      }
    }

    // 5. Auto-allocate lots (optional - you might want to do this manually)
    const allocationResults = [];
    
    if (recipeIngredients.length > 0) {
      //interface RecipeIngredientForBatch { material_id: string; quantity: number; unit: string; tolerance_percentage: number | null; is_cure: boolean | null; material: { name: string }; }
      for (const ingredient of recipeIngredients) {
const scaled_quantity = ingredient.quantity * (scaling_factor || 1);

        try {
          const allocResponse = await fetch(
            `${request.url.split('/api')[0]}/api/lots/allocate`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                batch_id: batch.id,
                material_id: ingredient.material_id,
                quantity_needed: scaled_quantity,
              }),
            }
          );

          if (allocResponse.ok) {
            const allocData = await allocResponse.json();
            allocationResults.push({
              material: ingredient.material.name,
              allocations: allocData.allocations,
            });
          } else {
            // Log but don't fail - manual allocation can happen later
            const error = await allocResponse.json();
            console.warn(`Could not auto-allocate ${ingredient.material.name}:`, error.error);
          }
        } catch (error) {
          console.warn(`Allocation failed for ${ingredient.material.name}:`, error);
        }
      }
    }

    return NextResponse.json({
      batch,
      allocations: allocationResults,
    }, { status: 201 });

  } catch (error) {
    console.error('Batch creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
