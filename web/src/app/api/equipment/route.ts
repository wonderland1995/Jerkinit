import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/db';
import type { EquipmentStatus } from '@/types/equipment';

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').transform((v) => v.trim()),
  type: z.string().min(1).transform((v) => v.trim().toLowerCase()),
  model: z.string().max(120).trim().optional().nullable(),
  serial_number: z.string().max(120).trim().optional().nullable(),
  location: z.string().max(160).trim().optional().nullable(),
  calibration_interval_days: z.coerce.number().int().positive().default(30),
  status: z.enum(['active', 'out_of_service', 'retired']).default('active'),
  label_code: z
    .string()
    .trim()
    .max(32)
    .regex(/^[A-Za-z0-9\-]+$/, { message: 'Use letters, numbers, and dashes only' })
    .optional(),
});

export async function GET() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('equipment_latest_calibration')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Failed to load equipment', error);
    return NextResponse.json({ error: 'Unable to load equipment' }, { status: 500 });
  }

  return NextResponse.json({ equipment: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = createClient();

  let body: z.infer<typeof createSchema>;
  try {
    const raw = await request.json();
    body = createSchema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 422 });
    }
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const payload = {
    name: body.name,
    type: body.type || 'thermometer',
    model: body.model ?? null,
    serial_number: body.serial_number ?? null,
    location: body.location ?? null,
    calibration_interval_days: body.calibration_interval_days || 30,
    status: (body.status as EquipmentStatus) ?? 'active',
    label_code: body.label_code ?? undefined,
  };

  const { data, error } = await supabase
    .from('equipment')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    const msg =
      error.code === '23505'
        ? 'That label code already exists. Use a different code.'
        : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ equipment: data }, { status: 201 });
}
