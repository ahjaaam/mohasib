-- Runtime security hardening: atomic rate limits and reproducible private storage.

create table if not exists public.rate_limits (
  ip text not null,
  endpoint text not null,
  attempts integer not null default 0,
  first_attempt timestamptz not null default now(),
  blocked_until timestamptz,
  primary key (ip, endpoint)
);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

create or replace function public.consume_rate_limit(
  key_arg text,
  endpoint_arg text,
  max_attempts_arg integer,
  window_ms_arg bigint,
  block_ms_arg bigint
) returns table (
  allowed boolean,
  remaining integer,
  reset_time bigint,
  attempts integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_value timestamptz := clock_timestamp();
  row_value public.rate_limits%rowtype;
begin
  if key_arg is null or endpoint_arg is null
    or max_attempts_arg < 1 or window_ms_arg < 1 or block_ms_arg < 1 then
    raise exception 'Invalid rate-limit arguments';
  end if;

  insert into public.rate_limits as current_row (
    ip, endpoint, attempts, first_attempt, blocked_until
  ) values (
    left(key_arg, 500),
    left(endpoint_arg, 200),
    1,
    now_value,
    case when max_attempts_arg <= 1
      then now_value + block_ms_arg * interval '1 millisecond'
      else null
    end
  )
  on conflict (ip, endpoint) do update set
    attempts = case
      when current_row.blocked_until > now_value then current_row.attempts
      when current_row.blocked_until is not null and current_row.blocked_until <= now_value then 1
      when current_row.first_attempt < now_value - window_ms_arg * interval '1 millisecond' then 1
      else current_row.attempts + 1
    end,
    first_attempt = case
      when current_row.blocked_until is not null and current_row.blocked_until <= now_value then now_value
      when current_row.first_attempt < now_value - window_ms_arg * interval '1 millisecond' then now_value
      else current_row.first_attempt
    end,
    blocked_until = case
      when current_row.blocked_until > now_value then current_row.blocked_until
      when current_row.blocked_until is not null and current_row.blocked_until <= now_value
        then case when max_attempts_arg <= 1
          then now_value + block_ms_arg * interval '1 millisecond'
          else null
        end
      when current_row.first_attempt < now_value - window_ms_arg * interval '1 millisecond'
        then case when max_attempts_arg <= 1
          then now_value + block_ms_arg * interval '1 millisecond'
          else null
        end
      when current_row.attempts + 1 >= max_attempts_arg
        then now_value + block_ms_arg * interval '1 millisecond'
      else null
    end
  returning * into row_value;

  return query select
    not (row_value.blocked_until is not null and row_value.blocked_until > now_value),
    greatest(0, max_attempts_arg - row_value.attempts),
    floor(extract(epoch from coalesce(
      row_value.blocked_until,
      row_value.first_attempt + window_ms_arg * interval '1 millisecond'
    )))::bigint,
    row_value.attempts;
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, bigint, bigint) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, bigint, bigint) to service_role;

create or replace function public.increment_ocr_usage(company_id_arg uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.companies
  set ocr_used_this_month = coalesce(ocr_used_this_month, 0) + 1
  where id = company_id_arg;
$$;

revoke all on function public.increment_ocr_usage(uuid) from public, anon, authenticated;
grant execute on function public.increment_ocr_usage(uuid) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('receipts', 'receipts', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('company-documents', 'company-documents', false, 20971520, array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/csv',
    'application/csv', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]),
  ('invoices-pdf', 'invoices-pdf', false, 10485760, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_access_storage_owner(owner_user_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    owner_user_id = auth.uid()::text
    or exists (
      select 1
      from public.user_memberships membership
      left join public.companies company on company.id = membership.company_id
      left join public.dossiers dossier on dossier.id = membership.dossier_id
      where membership.user_id = auth.uid()
        and membership.status = 'active'
        and (
          company.user_id::text = owner_user_id
          or dossier.fiduciaire_user_id::text = owner_user_id
        )
    );
$$;

revoke all on function public.can_access_storage_owner(text) from public, anon;
grant execute on function public.can_access_storage_owner(text) to authenticated, service_role;

drop policy if exists "tenant_files_read" on storage.objects;
create policy "tenant_files_read"
on storage.objects for select to authenticated
using (
  bucket_id in ('receipts', 'company-documents', 'invoices-pdf')
  and public.can_access_storage_owner((storage.foldername(name))[1])
);

drop policy if exists "tenant_files_insert" on storage.objects;
create policy "tenant_files_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('receipts', 'company-documents', 'invoices-pdf')
  and public.can_access_storage_owner((storage.foldername(name))[1])
);

drop policy if exists "tenant_files_update" on storage.objects;
create policy "tenant_files_update"
on storage.objects for update to authenticated
using (
  bucket_id in ('receipts', 'company-documents', 'invoices-pdf')
  and public.can_access_storage_owner((storage.foldername(name))[1])
)
with check (
  bucket_id in ('receipts', 'company-documents', 'invoices-pdf')
  and public.can_access_storage_owner((storage.foldername(name))[1])
);

drop policy if exists "tenant_files_delete" on storage.objects;
create policy "tenant_files_delete"
on storage.objects for delete to authenticated
using (
  bucket_id in ('receipts', 'company-documents', 'invoices-pdf')
  and public.can_access_storage_owner((storage.foldername(name))[1])
);
