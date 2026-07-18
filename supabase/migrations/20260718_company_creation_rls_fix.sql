-- VertexERP Company Creation RLS Repair
-- Fixes PostgreSQL/Supabase error 42501:
-- "new row violates row-level security policy for table companies"
--
-- Safe scope:
-- - only public.companies RLS policies are replaced;
-- - business data is not modified;
-- - authenticated users may insert only rows owned by themselves;
-- - existing permission-based team access remains supported.

begin;

do $precheck$
begin
  if to_regclass('public.companies') is null then
    raise exception 'public.companies table was not found.';
  end if;

  if to_regprocedure(
    'public.has_company_permission(uuid,text,uuid)'
  ) is null then
    raise exception
      'has_company_permission(uuid,text,uuid) is missing. Run the Roles & Permissions foundation migration first.';
  end if;
end;
$precheck$;

alter table public.companies enable row level security;

-- Remove stale, duplicate, or restrictive policies currently attached
-- to the companies table.
do $drop_company_policies$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'companies'
  loop
    execute format(
      'drop policy if exists %I on public.companies',
      v_policy.policyname
    );
  end loop;
end;
$drop_company_policies$;

-- Owners can immediately read the row they are creating.
-- Team users continue to rely on permission-based access.
create policy companies_select_access
on public.companies
for select
to authenticated
using (
  owner_id = auth.uid()
  or public.has_company_permission(
    id,
    'company.view',
    auth.uid()
  )
);

-- A signed-in user can create only a company owned by that same user.
create policy companies_owner_insert
on public.companies
for insert
to authenticated
with check (
  auth.uid() is not null
  and owner_id = auth.uid()
);

-- Owner fallback prevents an owner from being locked out if membership
-- synchronization has not run yet. Team members still need company.edit.
create policy companies_update_access
on public.companies
for update
to authenticated
using (
  owner_id = auth.uid()
  or public.has_company_permission(
    id,
    'company.edit',
    auth.uid()
  )
)
with check (
  owner_id = auth.uid()
  or public.has_company_permission(
    id,
    'company.edit',
    auth.uid()
  )
);

create policy companies_delete_access
on public.companies
for delete
to authenticated
using (
  owner_id = auth.uid()
  or public.has_company_permission(
    id,
    'company.delete',
    auth.uid()
  )
);

grant usage on schema public to authenticated;
grant select, insert, update, delete
on table public.companies
to authenticated;

-- Reattach the existing owner-membership synchronization trigger when
-- its foundation function is available.
do $restore_owner_trigger$
begin
  if to_regprocedure(
    'public.sync_company_owner_membership()'
  ) is not null then
    execute
      'drop trigger if exists sync_company_owner_membership_trigger on public.companies';

    execute
      'create trigger sync_company_owner_membership_trigger
       after insert or update of owner_id on public.companies
       for each row
       execute function public.sync_company_owner_membership()';
  end if;
end;
$restore_owner_trigger$;

commit;

notify pgrst, 'reload schema';

-- Verification: four PERMISSIVE policies should be returned.
select
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'companies'
order by cmd, policyname;