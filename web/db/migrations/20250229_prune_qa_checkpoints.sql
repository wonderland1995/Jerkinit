-- Prune QA checkpoints to the minimal FSP set (no beef receiving here; that lives in the lots flow)
-- Keep only the checkpoints we actively use on the QA page.

update public.qa_checkpoints
set active = true,
    required = true
where code in (
  'MAR-FSP-SALT',
  'MAR-FSP-TIME',
  'DRY-FSP-OVEN',
  'DRY-FSP-CORE',
  'DRY-FSP-AW-LAB',
  'DRY-FSP-VALIDATION',
  'FIN-RELEASE'
);

update public.qa_checkpoints
set active = false
where code not in (
  'MAR-FSP-SALT',
  'MAR-FSP-TIME',
  'DRY-FSP-OVEN',
  'DRY-FSP-CORE',
  'DRY-FSP-AW-LAB',
  'DRY-FSP-VALIDATION',
  'FIN-RELEASE'
);

-- Ensure beef receiving QA never shows here; it is captured in the receiving module.
update public.qa_checkpoints
set active = false
where code in ('PREP-BEEF-RECEIVE', 'PREP-CCP-001');
