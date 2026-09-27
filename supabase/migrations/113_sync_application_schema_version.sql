-- Migrations 110 through 112 predate the schema-version update convention.
-- Advance the application health marker after those migrations are applied.

insert into public.app_schema_version(singleton, version, applied_at)
values (true, 113, now())
on conflict (singleton) do update
set version = excluded.version, applied_at = excluded.applied_at;

notify pgrst, 'reload schema';
