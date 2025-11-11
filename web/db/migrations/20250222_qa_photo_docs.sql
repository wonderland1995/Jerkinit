-- Storage bucket for QA attachments and default photo doc type

insert into storage.buckets (id, name, public)
values ('qa-documents', 'qa-documents', true)
on conflict (id) do update
set public = excluded.public;

insert into public.qa_document_types (
  code,
  name,
  description,
  required_for_batch,
  required_for_release,
  retention_days,
  active
)
values (
  'QA-PHOTO',
  'QA Photo / Attachment',
  'Operational photos or supporting evidence captured while completing QA checkpoints.',
  false,
  false,
  0,
  true
)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  required_for_batch = excluded.required_for_batch,
  required_for_release = excluded.required_for_release,
  active = excluded.active;
