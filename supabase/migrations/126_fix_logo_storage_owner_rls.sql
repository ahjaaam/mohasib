-- Keep logo writes tied to the signed-in company owner or the dossier's
-- authorized accounting workspace. Avoid depending on the generic storage
-- owner helper for the common company-logo path.
create or replace function public.can_manage_logo_storage_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (storage.foldername(object_name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.dossiers dossier
      where (storage.foldername(object_name))[1] = 'dossier-' || dossier.id::text
        and (
          auth.uid() = dossier.fiduciaire_user_id
          or public.member_has_permission('accounting', 'create', dossier.fiduciaire_user_id, dossier.id)
        )
    );
$$;

revoke all on function public.can_manage_logo_storage_object(text) from public, anon;
grant execute on function public.can_manage_logo_storage_object(text) to authenticated, service_role;

drop policy if exists "logos_tenant_insert" on storage.objects;
create policy "logos_tenant_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'logos'
  and public.can_manage_logo_storage_object(name)
);

drop policy if exists "logos_tenant_update" on storage.objects;
create policy "logos_tenant_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'logos'
  and public.can_manage_logo_storage_object(name)
)
with check (
  bucket_id = 'logos'
  and public.can_manage_logo_storage_object(name)
);

drop policy if exists "logos_tenant_delete" on storage.objects;
create policy "logos_tenant_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'logos'
  and public.can_manage_logo_storage_object(name)
);

insert into public.app_schema_version(singleton, version, applied_at)
values (true, 126, now())
on conflict (singleton) do update set
  version = excluded.version,
  applied_at = excluded.applied_at;

notify pgrst, 'reload schema';
