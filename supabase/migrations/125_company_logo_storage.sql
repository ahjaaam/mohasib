-- Public company/dossier branding logos, with authenticated tenant-scoped writes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos',
  'logos',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/svg+xml']
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "logos_public_read" on storage.objects;
create policy "logos_public_read"
on storage.objects for select
using (bucket_id = 'logos');

drop policy if exists "logos_tenant_insert" on storage.objects;
create policy "logos_tenant_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'logos'
  and (
    public.can_access_storage_owner((storage.foldername(name))[1])
    or exists (
      select 1
      from public.dossiers dossier
      where (storage.foldername(name))[1] = 'dossier-' || dossier.id::text
        and (
          auth.uid() = dossier.fiduciaire_user_id
          or public.member_has_permission('accounting', 'create', dossier.fiduciaire_user_id, dossier.id)
        )
    )
  )
);

drop policy if exists "logos_tenant_update" on storage.objects;
create policy "logos_tenant_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'logos'
  and (
    public.can_access_storage_owner((storage.foldername(name))[1])
    or exists (
      select 1
      from public.dossiers dossier
      where (storage.foldername(name))[1] = 'dossier-' || dossier.id::text
        and (
          auth.uid() = dossier.fiduciaire_user_id
          or public.member_has_permission('accounting', 'create', dossier.fiduciaire_user_id, dossier.id)
        )
    )
  )
)
with check (
  bucket_id = 'logos'
  and (
    public.can_access_storage_owner((storage.foldername(name))[1])
    or exists (
      select 1
      from public.dossiers dossier
      where (storage.foldername(name))[1] = 'dossier-' || dossier.id::text
        and (
          auth.uid() = dossier.fiduciaire_user_id
          or public.member_has_permission('accounting', 'create', dossier.fiduciaire_user_id, dossier.id)
        )
    )
  )
);

drop policy if exists "logos_tenant_delete" on storage.objects;
create policy "logos_tenant_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'logos'
  and (
    public.can_access_storage_owner((storage.foldername(name))[1])
    or exists (
      select 1
      from public.dossiers dossier
      where (storage.foldername(name))[1] = 'dossier-' || dossier.id::text
        and (
          auth.uid() = dossier.fiduciaire_user_id
          or public.member_has_permission('accounting', 'create', dossier.fiduciaire_user_id, dossier.id)
        )
    )
  )
);

insert into public.app_schema_version(singleton, version, applied_at)
values (true, 125, now())
on conflict (singleton) do update set
  version = excluded.version,
  applied_at = excluded.applied_at;

notify pgrst, 'reload schema';
