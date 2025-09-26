// src/app/api/products/route.ts

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { Product, ProductListResponse, ApiError } from '../../../types/database';

// Initialize Supabase client with service key (server-side only)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(): Promise<NextResponse<ProductListResponse | ApiError>> {
  try {
    // Fetch active products from database
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch products', details: error.message },
        { status: 500 }
      );
    }

    if (!products) {
      return NextResponse.json(
        { error: 'No products found' },
        { status: 404 }
      );
    }

    // Type assertion since Supabase doesn't know our exact types
    const typedProducts = products as Product[];

    return NextResponse.json(
      { products: typedProducts },
      { 
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=60', // Cache for 1 minute
        }
      }
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