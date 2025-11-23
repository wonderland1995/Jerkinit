-- Align QA checkpoints with the beef jerky FSP (receiving, marination, drying, validation)
-- Adds targeted checkpoints and document types to capture drying time/temp, lab water activity, and validation evidence.

-- Primary checkpoints for the FSP flow
insert into public.qa_checkpoints (
  code,
  name,
  description,
  stage,
  required,
  display_order,
  active
)
values
  (
    'PREP-BEEF-RECEIVE',
    'Beef receiving QA',
    'Record raw beef receiving temp (<= 5 deg C) plus packaging/odour/visual checks from the receiving log.',
    'preparation',
    true,
    10,
    true
  ),
  (
    'MAR-FSP-SALT',
    'Nitrite and salt addition (FSP)',
    'Verify curing salt and nitrite additions match the FSP recipe before marination.',
    'marination',
    true,
    10,
    true
  ),
  (
    'MAR-FSP-TIME',
    'Marination temp and time',
    'Capture marinade temperature and the marination start/end times so time-in-marinade is calculated.',
    'marination',
    true,
    20,
    true
  ),
  (
    'DRY-FSP-OVEN',
    'Drying oven profile',
    'Record oven temperature and drying start/finish to evidence cabinet run time.',
    'drying',
    true,
    10,
    true
  ),
  (
    'DRY-FSP-CORE',
    'Product core temperatures',
    'Three product temperature readings to correlate oven settings to product temp.',
    'drying',
    true,
    20,
    true
  ),
  (
    'DRY-FSP-AW-LAB',
    'Water activity (lab)',
    'Log the lab sample sent and the aw result returned under the Jerkin It method.',
    'drying',
    true,
    30,
    true
  ),
  (
    'DRY-FSP-VALIDATION',
    'Drying validation report',
    'Attach validation showing oven temp, product temp, and aw relationship for this program.',
    'drying',
    true,
    40,
    true
  )
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  stage = excluded.stage,
  required = excluded.required,
  display_order = excluded.display_order,
  active = true;

-- Retire the older generic checkpoints so only the FSP set displays
update public.qa_checkpoints
set active = false
where code in (
  'PREP-CCP-001',
  'PREP-004',
  'MIX-CCP-001',
  'MIX-TEMP',
  'MIX-CORE',
  'MIX-005',
  'MIX-CCP-004',
  'MIX-TEMPERATURE',
  'DRY-CCP-003',
  'DRY-CORE',
  'DRY-CCP-004',
  'DRY-TEMP',
  'DRY-TEMPERATURE',
  'DRY-CCP-005',
  'DRY-AW',
  'FIN-006',
  'PKG-CCP-001',
  'PKG-CCP-002',
  'PKG-CCP-003',
  'PKG-CCP-004',
  'PKG-CCP-005',
  'FIN-CCP-001',
  'FIN-CCP-002'
);

-- Document types tied to the drying/validation workflow
insert into public.qa_document_types (
  code,
  name,
  description,
  required_for_batch,
  required_for_release,
  retention_days,
  active
)
values
  (
    'DRY-TIME-TEMP-FORM',
    'Drying time and temperature form',
    'Completed drying temperature/time worksheet for the batch (Drying temp and time form).',
    true,
    false,
    730,
    true
  ),
  (
    'DRY-VALIDATION-REPORT',
    'Drying validation report',
    'Validation showing oven temperature, product temperature, and aw correlation.',
    false,
    true,
    730,
    true
  ),
  (
    'LAB-AW-RESULT',
    'Water activity lab result',
    'Lab report or email confirming the aw result for the submitted sample.',
    false,
    false,
    730,
    true
  )
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  required_for_batch = excluded.required_for_batch,
  required_for_release = excluded.required_for_release,
  retention_days = excluded.retention_days,
  active = true;
