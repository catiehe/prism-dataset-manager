-- Add per-user dataset ownership and atomic import persistence.
-- Apply this migration before deploying the Confirm Import frontend.

begin;

alter table public.datasets
  alter column created_by set default auth.uid();

alter table public.datasets
  add column if not exists visibility text;

-- All rows that predate ownership are the shared catalog snapshot.
update public.datasets
set visibility = 'public'
where visibility is null and created_by is null;

-- Preserve any already-owned rows if this migration is applied after a user write.
update public.datasets
set visibility = 'private'
where visibility is null and created_by is not null;

alter table public.datasets
  alter column visibility set default 'private',
  alter column visibility set not null;

alter table public.datasets
  drop constraint if exists datasets_visibility_check;
alter table public.datasets
  add constraint datasets_visibility_check
  check (visibility in ('public', 'private'));

alter table public.datasets
  drop constraint if exists datasets_private_owner_check;
alter table public.datasets
  add constraint datasets_private_owner_check
  check (visibility <> 'private' or created_by is not null);

create index if not exists datasets_created_by_type_idx
  on public.datasets (created_by, type);
create index if not exists datasets_visibility_type_idx
  on public.datasets (visibility, type);

create table if not exists public.import_batches (
  id uuid primary key,
  created_by uuid not null default auth.uid() references auth.users(id),
  source_format text not null,
  source_filename text,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.datasets
  add column if not exists import_batch_id uuid references public.import_batches(id);

create index if not exists datasets_import_batch_id_idx
  on public.datasets (import_batch_id)
  where import_batch_id is not null;
create index if not exists import_batches_created_by_created_at_idx
  on public.import_batches (created_by, created_at desc);

revoke all on table public.import_batches from anon;
grant select, insert on table public.import_batches to authenticated;

alter table public.datasets enable row level security;
alter table public.import_batches enable row level security;

drop policy if exists "public read" on public.datasets;
drop policy if exists "auth write" on public.datasets;
drop policy if exists "auth update" on public.datasets;
drop policy if exists "auth delete" on public.datasets;
drop policy if exists "read visible datasets" on public.datasets;
drop policy if exists "create owned datasets" on public.datasets;
drop policy if exists "update owned datasets" on public.datasets;
drop policy if exists "delete owned datasets" on public.datasets;

create policy "read visible datasets"
on public.datasets for select
to anon, authenticated
using (
  visibility = 'public'
  or created_by = (select auth.uid())
);

create policy "create owned datasets"
on public.datasets for insert
to authenticated
with check (
  visibility = 'private'
  and created_by = (select auth.uid())
);

create policy "update owned datasets"
on public.datasets for update
to authenticated
using (
  visibility = 'private'
  and created_by = (select auth.uid())
)
with check (
  visibility = 'private'
  and created_by = (select auth.uid())
);

create policy "delete owned datasets"
on public.datasets for delete
to authenticated
using (
  visibility = 'private'
  and created_by = (select auth.uid())
);

drop policy if exists "read owned import batches" on public.import_batches;
drop policy if exists "create owned import batches" on public.import_batches;

create policy "read owned import batches"
on public.import_batches for select
to authenticated
using (created_by = (select auth.uid()));

create policy "create owned import batches"
on public.import_batches for insert
to authenticated
with check (created_by = (select auth.uid()));

create or replace function public.import_datasets(
  p_batch_id uuid,
  p_source_format text,
  p_source_filename text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_row_count integer;
  v_distinct_id_count integer;
  v_reference jsonb;
  v_reference_id text;
  v_summary jsonb;
  v_report jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Sign in before importing datasets.';
  end if;

  if p_batch_id is null then
    raise exception using errcode = '22023', message = 'An import batch ID is required.';
  end if;

  -- A completed request can be retried safely after a lost network response.
  select summary
  into v_report
  from public.import_batches
  where id = p_batch_id and created_by = v_user_id;

  if found then
    return v_report || jsonb_build_object('idempotent', true);
  end if;

  if coalesce(btrim(p_source_format), '') = '' then
    raise exception using errcode = '22023', message = 'The source format is required.';
  end if;

  if p_source_filename is not null and length(p_source_filename) > 500 then
    raise exception using errcode = '22023', message = 'The source filename is too long.';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception using errcode = '22023', message = 'Import rows must be a JSON array.';
  end if;

  v_row_count := jsonb_array_length(p_rows);
  if v_row_count < 1 then
    raise exception using errcode = '22023', message = 'The import contains no datasets.';
  end if;
  if v_row_count > 1000 then
    raise exception using errcode = '54000', message = 'The import exceeds the 1000-dataset limit.';
  end if;
  if pg_column_size(p_rows) > 10485760 then
    raise exception using errcode = '54000', message = 'The normalized import exceeds the 10 MB limit.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rows) as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or coalesce(item.value ->> 'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or item.value ->> 'type' not in ('model', 'process', 'flow', 'flow_property', 'unit_group', 'source', 'contact')
      or coalesce(btrim(item.value ->> 'name'), '') = ''
      or length(item.value ->> 'name') > 1000
      or jsonb_typeof(item.value -> 'payload') <> 'object'
  ) then
    raise exception using errcode = '22023', message = 'One or more import rows are invalid.';
  end if;

  select count(distinct item.value ->> 'id')
  into v_distinct_id_count
  from jsonb_array_elements(p_rows) as item(value);

  if v_distinct_id_count <> v_row_count then
    raise exception using errcode = '22023', message = 'The import contains duplicate dataset IDs.';
  end if;

  -- Every PRISM dataset reference must resolve inside this batch or to a row
  -- visible to the caller under datasets RLS.
  for v_reference in
    select reference.value
    from jsonb_array_elements(p_rows) as item(value)
    cross join lateral jsonb_path_query(item.value -> 'payload', '$.**.refObjectId') as reference(value)
    where jsonb_typeof(reference.value) <> 'null'
  loop
    if jsonb_typeof(v_reference) <> 'string' then
      raise exception using errcode = '22023', message = 'A dataset reference is not a string or null.';
    end if;

    v_reference_id := v_reference #>> '{}';
    if v_reference_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception using errcode = '22023', message = format('Unresolved dataset reference: %s', v_reference_id);
    end if;

    if not exists (
      select 1
      from jsonb_array_elements(p_rows) as candidate(value)
      where candidate.value ->> 'id' = v_reference_id
    ) and not exists (
      select 1
      from public.datasets
      where id = v_reference_id::uuid
    ) then
      raise exception using errcode = '23503', message = format('Dataset reference is not accessible: %s', v_reference_id);
    end if;
  end loop;

  select coalesce(jsonb_object_agg(counts.type, counts.amount), '{}'::jsonb)
  into v_summary
  from (
    select item.value ->> 'type' as type, count(*) as amount
    from jsonb_array_elements(p_rows) as item(value)
    group by item.value ->> 'type'
  ) as counts;

  v_report := jsonb_build_object(
    'batch_id', p_batch_id,
    'created_count', v_row_count,
    'summary', v_summary,
    'datasets', (
      select jsonb_agg(
        jsonb_build_object(
          'id', item.value ->> 'id',
          'type', item.value ->> 'type',
          'name', item.value ->> 'name'
        ) order by item.ordinality
      )
      from jsonb_array_elements(p_rows) with ordinality as item(value, ordinality)
    )
  );

  insert into public.import_batches (
    id, created_by, source_format, source_filename, summary
  ) values (
    p_batch_id, v_user_id, btrim(p_source_format), nullif(btrim(p_source_filename), ''), v_report
  );

  insert into public.datasets (
    id, type, name, description, payload, created_by, visibility, import_batch_id
  )
  select
    (item.value ->> 'id')::uuid,
    item.value ->> 'type',
    btrim(item.value ->> 'name'),
    nullif(item.value ->> 'description', ''),
    item.value -> 'payload',
    v_user_id,
    'private',
    p_batch_id
  from jsonb_array_elements(p_rows) as item(value);

  return v_report;
end;
$$;

revoke all on function public.import_datasets(uuid, text, text, jsonb) from public;
revoke all on function public.import_datasets(uuid, text, text, jsonb) from anon;
grant execute on function public.import_datasets(uuid, text, text, jsonb) to authenticated;

commit;
