alter table invoices
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_sent_count integer default 0;
