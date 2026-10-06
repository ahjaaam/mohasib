-- Preserve editor-managed source text so administrators can reopen and revise
-- CMS content without reconstructing it from overlapping search chunks.
alter table public.knowledge_sources
  add column if not exists source_text text;

insert into public.app_schema_version(singleton, version, applied_at)
values (true, 123, now())
on conflict (singleton) do update set version = excluded.version, applied_at = excluded.applied_at;

notify pgrst, 'reload schema';
