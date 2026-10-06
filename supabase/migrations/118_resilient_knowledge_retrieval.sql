-- Keep exact phrase retrieval as the first choice. If a natural-language
-- question has no exact match, retry with its meaningful terms so filler words
-- such as "what should I know about" do not hide relevant source passages.
create or replace function public.search_knowledge_sources(
  query_text text,
  as_of_date date default current_date,
  result_limit integer default 6
)
returns table (
  chunk_id uuid, source_id uuid, source_key text, source_title text,
  document_type text, publisher text, authority_level smallint, language text,
  canonical_url text, document_reference text, published_on date,
  effective_from date, effective_to date, locator text, content text, relevance real
)
language sql stable security definer set search_path = public
as $$
  with query_terms as (
    select websearch_to_tsquery('simple'::regconfig, left(coalesce(query_text, ''), 1200)) as exact_query,
      (
        select string_agg(token || ':*', ' | ' order by ordinality)::tsquery
        from regexp_split_to_table(
          regexp_replace(lower(left(coalesce(query_text, ''), 1200)), '[^[:alnum:]_]+', ' ', 'g'),
          '\s+'
        ) with ordinality as parts(token, ordinality)
        where length(token) >= 3
          and token not in (
            'the', 'and', 'for', 'with', 'what', 'when', 'where', 'which', 'about',
            'should', 'would', 'could', 'does', 'have', 'from', 'that', 'this',
            'est', 'une', 'des', 'les', 'dans', 'pour', 'avec', 'sur', 'que', 'qui',
            'quoi', 'comment', 'quels', 'quelles', 'comme', 'dois', 'savoir', 'propos',
            'mon', 'ma', 'mes', 'son', 'ses', 'aux', 'par', 'pas', 'tout', 'tous'
          )
      ) as fallback_query
  ), eligible as (
    select
      chunk.id as chunk_id, source.id as source_id, source.source_key,
      source.title as source_title, source.document_type, source.publisher,
      source.authority_level, source.language, source.canonical_url,
      source.document_reference, source.published_on, source.effective_from,
      source.effective_to, chunk.locator, chunk.content, chunk.search_vector,
      query_terms.exact_query, query_terms.fallback_query
    from public.knowledge_chunks chunk
    join public.knowledge_sources source on source.id = chunk.source_id
    cross join query_terms
    where source.ingestion_status = 'ready'
      and source.publication_status in ('active', 'superseded', 'repealed')
      and (source.effective_from is null or source.effective_from <= coalesce(as_of_date, current_date))
      and (source.effective_to is null or source.effective_to >= coalesce(as_of_date, current_date))
      and (source.publication_status = 'active' or source.effective_to is not null)
  ), ranked as (
    select eligible.*,
      case
        when exact_query <> ''::tsquery and search_vector @@ exact_query
          then ts_rank_cd(search_vector, exact_query) + 1.0
        when fallback_query is not null and search_vector @@ fallback_query
          then ts_rank_cd(search_vector, fallback_query)
        else 0::real
      end as score
    from eligible
  )
  select chunk_id, source_id, source_key, source_title, document_type, publisher,
    authority_level, language, canonical_url, document_reference, published_on,
    effective_from, effective_to, locator, content, score as relevance
  from ranked
  where score > 0
  order by score desc, authority_level desc, published_on desc nulls last
  limit greatest(1, least(coalesce(result_limit, 6), 10));
$$;

revoke all on function public.search_knowledge_sources(text, date, integer) from public, anon, authenticated;
grant execute on function public.search_knowledge_sources(text, date, integer) to service_role;

insert into public.app_schema_version(singleton, version, applied_at)
values (true, 118, now())
on conflict (singleton) do update set version = excluded.version, applied_at = excluded.applied_at;

notify pgrst, 'reload schema';
