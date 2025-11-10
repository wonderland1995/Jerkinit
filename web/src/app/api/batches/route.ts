import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type {
  CreateBatchRequest,
  CreateBatchResponse,
  ScaledIngredient,
  ApiError,
} from '../../../types/database';
import { authOptions } from '@/lib/auth/options';
import { recordAuditEvent } from '@/lib/audit';

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables for batch routes', {
    url: !!supabaseUrl,
    serviceKey: !!supabaseServiceKey,
  });
  throw new Error('Missing Supabase environment variables for batch routes');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
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
  beef_weight_kg?: number;
}

const getClientIp = (request: NextRequest) =>
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.ip ?? null;

export async function POST(
  request: NextRequest
): Promise<NextResponse<CreateBatchResponse | ApiError>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: userId, email: userEmail } = session.user;
    const clientIp = getClientIp(request);
    const body = (await request.json()) as CreateBatchRequest;

    if (!body.product_id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    if (!body.beef_weight_kg || body.beef_weight_kg <= 0) {
      return NextResponse.json(
        { error: 'Beef weight must be greater than 0' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc('create_batch_and_get_recipe', {
      p_product_id: body.product_id,
      p_beef_weight_kg: body.beef_weight_kg,
      p_created_by: userId,
    });

    if (error) {
      console.error('RPC error:', error);
      return NextResponse.json(
        { error: 'Failed to create batch', details: error.message },
        { status: 500 }
      );
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: 'No recipe data returned' }, { status: 500 });
    }

    const rpcData = data as SupabaseRPCResponse[];
    const firstRow = rpcData[0];
    const batchId = firstRow.batch_id;
    const batchUuid = firstRow.batch_uuid;
    const productName = firstRow.product_name;

    const ingredients: ScaledIngredient[] = rpcData.map((row) => ({
      ingredient_name: row.ingredient_name,
      target_amount: parseFloat(row.target_amount.toString()),
      unit: row.unit as ScaledIngredient['unit'],
      tolerance_percentage: parseFloat(row.tolerance_percentage.toString()),
      is_cure: row.is_cure,
      display_order: row.display_order,
    }));

    const response: CreateBatchResponse = {
      batch_id: batchId,
      batch_uuid: batchUuid,
      product_name: productName,
      ingredients,
      beef_weight_kg: firstRow.beef_weight_kg ?? body.beef_weight_kg,
    };

    await recordAuditEvent({
      userId,
      actorEmail: userEmail,
      action: 'batch.create',
      resource: 'batch',
      resourceId: batchId,
      metadata: {
        product_id: body.product_id,
        batch_uuid: batchUuid,
        beef_weight_kg: body.beef_weight_kg,
      },
      ipAddress: clientIp,
    });

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest
): Promise<NextResponse<{ in_tolerance: boolean } | ApiError>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: userId, email: userEmail } = session.user;
    const clientIp = getClientIp(request);
    const body = await request.json();

    if (!body.batch_id || !body.ingredient_name || body.actual_amount === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: batch_id, ingredient_name, or actual_amount' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc('update_batch_ingredient_actual', {
      p_batch_id: body.batch_id,
      p_ingredient_name: body.ingredient_name,
      p_actual_amount: body.actual_amount,
      p_measured_by: userId,
    });

    if (error) {
      console.error('RPC error:', error);
      return NextResponse.json(
        { error: 'Failed to update ingredient', details: error.message },
        { status: 500 }
      );
    }

    await recordAuditEvent({
      userId,
      actorEmail: userEmail,
      action: 'batch.ingredient.actual.update',
      resource: 'batch',
      resourceId: body.batch_id,
      metadata: {
        ingredient_name: body.ingredient_name,
        actual_amount: body.actual_amount,
      },
      ipAddress: clientIp,
    });

    return NextResponse.json({ in_tolerance: data as boolean }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
