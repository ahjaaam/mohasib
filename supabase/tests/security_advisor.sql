-- Run in the Supabase SQL Editor or with:
-- psql "$DATABASE_URL" -f supabase/tests/security_advisor.sql

-- Public tables exposed through PostgREST without RLS.
select
  'rls_disabled' as finding,
  schemaname,
  tablename
from pg_tables
where schemaname in ('public', 'graphql_public')
  and rowsecurity = false
order by schemaname, tablename;

-- RLS-enabled tables without any policy.
select
  'rls_without_policy' as finding,
  table_schema,
  table_name
from information_schema.tables table_info
where table_schema = 'public'
  and table_type = 'BASE TABLE'
  and exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = table_info.table_schema
      and relation.relname = table_info.table_name
      and relation.relrowsecurity = true
  )
  and not exists (
    select 1
    from pg_policies policy
    where policy.schemaname = table_info.table_schema
      and policy.tablename = table_info.table_name
  )
order by table_schema, table_name;

-- Foreign-key columns that do not begin any valid index.
with foreign_keys as (
  select
    constraint_row.conrelid,
    constraint_row.conname,
    constraint_row.conkey,
    namespace.nspname as schema_name,
    relation.relname as table_name
  from pg_constraint constraint_row
  join pg_class relation on relation.oid = constraint_row.conrelid
  join pg_namespace namespace on namespace.oid = relation.relnamespace
  where constraint_row.contype = 'f'
    and namespace.nspname = 'public'
)
select
  'unindexed_foreign_key' as finding,
  schema_name,
  table_name,
  conname
from foreign_keys foreign_key
where not exists (
  select 1
  from pg_index index_row
  where index_row.indrelid = foreign_key.conrelid
    and index_row.indisvalid
    and index_row.indisready
    and (index_row.indkey::smallint[])[0:cardinality(foreign_key.conkey) - 1] = foreign_key.conkey
)
order by schema_name, table_name, conname;

-- Duplicate indexes with identical definitions.
select
  'duplicate_index' as finding,
  schemaname,
  tablename,
  array_agg(indexname order by indexname) as indexes
from pg_indexes
where schemaname = 'public'
group by schemaname, tablename, indexdef
having count(*) > 1
order by schemaname, tablename;

-- Security-definer functions without a fixed search_path.
select
  'mutable_search_path' as finding,
  namespace.nspname as schema_name,
  procedure.proname as function_name
from pg_proc procedure
join pg_namespace namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public'
  and procedure.prosecdef
  and not exists (
    select 1
    from unnest(coalesce(procedure.proconfig, array[]::text[])) setting
    where setting like 'search_path=%'
  )
order by schema_name, function_name;
