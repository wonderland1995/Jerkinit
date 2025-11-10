import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE;

if (!url || !serviceKey) {
  throw new Error('Missing SUPABASE_URL or service-role key environment variable.');
}

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});
