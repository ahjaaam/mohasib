alter table public.resource_leads
  add column if not exists phone text;

alter table public.resource_leads
  drop constraint if exists resource_leads_phone_length;

alter table public.resource_leads
  add constraint resource_leads_phone_length
  check (phone is null or length(phone) between 6 and 40);
