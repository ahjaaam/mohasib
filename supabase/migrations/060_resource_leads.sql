-- Dedicated lead capture table for public downloadable documents/templates.
create table if not exists public.resource_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  resource_id text,
  resource_title text not null,
  resource_slug text,
  resource_type text not null default 'document',
  source text,
  page_path text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  created_at timestamptz not null default now(),
  constraint resource_leads_email_length check (length(email) between 3 and 320),
  constraint resource_leads_email_shape check (position('@' in email) > 1),
  constraint resource_leads_title_length check (length(resource_title) between 1 and 500)
);

create index if not exists idx_resource_leads_created
  on public.resource_leads(created_at desc);

create index if not exists idx_resource_leads_email
  on public.resource_leads(lower(email));

create index if not exists idx_resource_leads_resource
  on public.resource_leads(resource_slug, created_at desc);

alter table public.resource_leads enable row level security;

drop policy if exists "Public can submit resource leads" on public.resource_leads;
create policy "Public can submit resource leads"
  on public.resource_leads
  for insert
  to anon, authenticated
  with check (
    email is not null
    and length(email) between 3 and 320
    and resource_title is not null
    and length(resource_title) between 1 and 500
    and coalesce(resource_type, 'document') in ('document', 'template', 'guide', 'tool')
  );
