-- Disable legacy drying checkpoints that should no longer drive progress

update public.qa_checkpoints
set active = false, required = false
where code in ('DRY-CCP-004', 'DRY-FSP-VALIDATION');
