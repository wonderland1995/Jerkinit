import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/db';

const calibrateSchema = z.object({
  performed_by: z.string().max(120).trim().optional().nullable(),
  method: z.string().max(160).trim().optional().nullable(),
  reference_ice_c: z.coerce.number().optional().nullable().default(0),
  reference_boiling_c: z.coerce.number().optional().nullable().default(100),
  observed_ice_c: z.coerce.number().optional().nullable(),
  observed_boiling_c: z.coerce.number().optional().nullable(),
  adjustment: z.string().max(160).trim().optional().nullable(),
  result: z.string().max(160).trim().optional().nullable(),
  notes: z.string().max(600).trim().optional().nullable(),
  next_due_at: z.string().datetime().optional().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const equipmentId = params.id;
  const supabase = createClient();

  const { data: equipment, error: loadErr } = await supabase
    .from('equipment')
    .select('id, calibration_interval_days, name, label_code')
    .eq('id', equipmentId)
    .maybeSingle();

  if (loadErr) {
    console.error('Failed to load equipment for calibration', loadErr);
    return NextResponse.json({ error: 'Unable to load equipment' }, { status: 500 });
  }

  if (!equipment) {
    return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
  }

  let body: z.infer<typeof calibrateSchema>;
  try {
    const raw = await request.json();
    body = calibrateSchema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 422 });
    }
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const computedNextDue =
    body.next_due_at ??
    (equipment.calibration_interval_days
      ? new Date(
          Date.now() + equipment.calibration_interval_days * 24 * 60 * 60 * 1000
        ).toISOString()
      : null);

  const { data: calibration, error: insertErr } = await supabase
    .from('equipment_calibrations')
    .insert({
      equipment_id: equipment.id,
      performed_by: body.performed_by ?? null,
      method: body.method ?? 'Ice + boil two-point check',
      reference_ice_c: body.reference_ice_c ?? 0,
      reference_boiling_c: body.reference_boiling_c ?? 100,
      observed_ice_c: body.observed_ice_c ?? null,
      observed_boiling_c: body.observed_boiling_c ?? null,
      adjustment: body.adjustment ?? null,
      result: body.result ?? null,
      notes: body.notes ?? null,
      next_due_at: computedNextDue,
    })
    .select('*')
    .single();

  if (insertErr) {
    console.error('Failed to create calibration', insertErr);
    return NextResponse.json({ error: 'Unable to save calibration' }, { status: 500 });
  }

  const { data: latest } = await supabase
    .from('equipment_latest_calibration')
    .select('*')
    .eq('id', equipmentId)
    .maybeSingle();

  return NextResponse.json({
    calibration,
    equipment: latest ?? equipment,
  });
}
