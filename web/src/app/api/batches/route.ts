// src/app/api/batches/route.ts

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import type { 
  CreateBatchRequest, 
  CreateBatchResponse, 
  ScaledIngredient,
  ApiError 
} from '../../../types/database';

// Initialize Supabase client with service key
// Using your environment variable names
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables:', {
    url: !!supabaseUrl,
    serviceKey: !!supabaseServiceKey
  });
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false
  }
});

interface SupabaseRPCResponse {
  batch_id: string;
  batch_uuid: string;
  product_name: string;
  ingredient_name: string;
  target_amount: number;
  unit: string;
  tolerance_percentage: number;
  is_cure: boolean;
  display_order: number;
  // optionally, if your RPC returns it:
  beef_weight_kg?: number;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<CreateBatchResponse | ApiError>> {
  try {
    // Parse request body
    const body = await request.json() as CreateBatchRequest;
    
    // Validate request
    if (!body.product_id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }
    
    if (!body.beef_weight_kg || body.beef_weight_kg <= 0) {
      return NextResponse.json(
        { error: 'Beef weight must be greater than 0' },
        { status: 400 }
      );
    }
    
    // Call Supabase RPC function
    const { data, error } = await supabase
      .rpc('create_batch_and_get_recipe', {
        p_product_id: body.product_id,
        p_beef_weight_kg: body.beef_weight_kg,
        p_created_by: body.created_by || null
      });
    
    if (error) {
      console.error('RPC error:', error);
      return NextResponse.json(
        { error: 'Failed to create batch', details: error.message },
        { status: 500 }
      );
    }
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: 'No recipe data returned' },
        { status: 500 }
      );
    }
    
    // Type the RPC response
    const rpcData = data as SupabaseRPCResponse[];
    
    // Extract batch info from first row
    const firstRow = rpcData[0];
    const batchId = firstRow.batch_id;
    const batchUuid = firstRow.batch_uuid;
    const productName = firstRow.product_name;
    
    // Map ingredients
    const ingredients: ScaledIngredient[] = rpcData.map(row => ({
      ingredient_name: row.ingredient_name,
      target_amount: parseFloat(row.target_amount.toString()),
      unit: row.unit as ScaledIngredient['unit'],
      tolerance_percentage: parseFloat(row.tolerance_percentage.toString()),
      is_cure: row.is_cure,
      display_order: row.display_order
    }));
    
// ...after you build `ingredients`
const response: CreateBatchResponse = {
  batch_id: batchId,
  batch_uuid: batchUuid,
  product_name: productName,
  ingredients,
  beef_weight_kg: firstRow.beef_weight_kg ?? body.beef_weight_kg, // 👈 add this line
};

return NextResponse.json(response, { status: 201 });
    
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { 
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest
): Promise<NextResponse<{ in_tolerance: boolean } | ApiError>> {
  try {
    // Parse request body
    const body = await request.json();
    
    // Validate request
    if (!body.batch_id || !body.ingredient_name || body.actual_amount === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: batch_id, ingredient_name, or actual_amount' },
        { status: 400 }
      );
    }
    
    // Call Supabase RPC function to update actual amount
    const { data, error } = await supabase
      .rpc('update_batch_ingredient_actual', {
        p_batch_id: body.batch_id,
        p_ingredient_name: body.ingredient_name,
        p_actual_amount: body.actual_amount,
        p_measured_by: body.measured_by || null
      });
    
    if (error) {
      console.error('RPC error:', error);
      return NextResponse.json(
        { error: 'Failed to update ingredient', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { in_tolerance: data as boolean },
      { status: 200 }
    );
    
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { 
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}