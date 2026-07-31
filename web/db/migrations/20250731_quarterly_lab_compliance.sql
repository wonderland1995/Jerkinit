-- Quarterly external lab verification for jerky batches (Aw / micro certificate)

insert into public.compliance_tasks (
  code,
  name,
  category,
  description,
  frequency_type,
  frequency_value,
  proof_required,
  metadata
) values
  (
    'LAB-QUARTERLY',
    'External lab verification (quarterly)',
    'Microbiological',
    'Send a representative finished jerky batch to an accredited lab at least once every 3 months. Upload the certificate when results return.',
    'monthly',
    3,
    true,
    jsonb_build_object(
      'scope_label', 'Batch / sample sent',
      'result_label', 'Lab outcome / Aw',
      'notes_hint', 'Lab name, sample ID, analytes covered (Aw, Listeria, E. coli, Salmonella)'
    )
  )
on conflict (code) do update
set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  frequency_type = excluded.frequency_type,
  frequency_value = excluded.frequency_value,
  proof_required = excluded.proof_required,
  metadata = excluded.metadata,
  active = true;
