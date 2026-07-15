-- VertexERP Safe RLS & RPC Security Audit
-- READ-ONLY: this file does not alter database objects or business data.
-- Run the complete file in Supabase SQL Editor.

-- 1. Public tables and RLS status
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls,
  coalesce(s.n_live_tup, 0) as estimated_rows
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_stat_user_tables s on s.relid = c.oid
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relrowsecurity, c.relname;

-- 2. Tables with RLS disabled
select
  c.relname as table_name,
  case
    when exists (
      select 1
      from information_schema.columns cols
      where cols.table_schema = 'public'
        and cols.table_name = c.relname
        and cols.column_name = 'company_id'
    ) then 'HIGH: company-scoped table'
    else 'REVIEW'
  end as risk
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity = false
order by risk, c.relname;

-- 3. Existing RLS policies
select
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

-- 4. Grants to Supabase API roles
select
  table_name,
  grantee,
  string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role')
group by table_name, grantee
order by table_name, grantee;

-- 5. Security-definer functions without fixed search_path
select
  p.proname as routine_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_userbyid(p.proowner) as owner_name,
  p.proconfig as function_settings,
  case
    when p.proconfig is null then 'HIGH: no function-level settings'
    when not exists (
      select 1
      from unnest(p.proconfig) setting
      where setting like 'search_path=%'
    ) then 'HIGH: search_path not fixed'
    else 'OK'
  end as audit_result
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind in ('f', 'p')
  and p.prosecdef = true
  and (
    p.proconfig is null
    or not exists (
      select 1
      from unnest(p.proconfig) setting
      where setting like 'search_path=%'
    )
  )
order by p.proname, arguments;

-- 6. Write RPCs and visible authorization checks
with routines as (
  select
    p.oid,
    p.proname as routine_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    p.prosecdef as security_definer,
    pg_get_functiondef(p.oid) as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind in ('f', 'p')
)
select
  routine_name,
  arguments,
  security_definer,
  case
    when definition ilike '%has_company_permission(%'
      then 'PERMISSION CHECK'
    when definition ilike '%is_company_member(%'
      then 'MEMBERSHIP CHECK'
    when definition ilike '%auth.uid()%'
      then 'AUTH CHECK ONLY'
    else 'NO OBVIOUS CHECK'
  end as authorization_check,
  case
    when definition ilike '%set row_security = off%'
      then 'row_security OFF'
    else 'default row_security'
  end as row_security_setting
from routines
where definition ~* '\m(insert|update|delete|truncate)\M'
order by authorization_check, routine_name, arguments;

-- 7. Functions touching core business tables
with routines as (
  select
    p.oid,
    p.proname as routine_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    p.prosecdef as security_definer,
    pg_get_functiondef(p.oid) as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind in ('f', 'p')
)
select
  routine_name,
  arguments,
  security_definer,
  case
    when definition ilike '%has_company_permission(%'
      then 'PERMISSION CHECK'
    when definition ilike '%is_company_member(%'
      then 'MEMBERSHIP CHECK'
    when definition ilike '%auth.uid()%'
      then 'AUTH CHECK ONLY'
    else 'NO OBVIOUS CHECK'
  end as authorization_level
from routines
where definition ~* '\m(companies|ledgers|products|sales|sale_items|purchases|purchase_items|payments|expenses|credit_notes|debit_notes|accounting_vouchers|accounting_entries|audit_logs)\M'
order by routine_name, arguments;

-- 8. Trigger inventory
select
  event_object_table as table_name,
  trigger_name,
  action_timing,
  string_agg(event_manipulation, ', ' order by event_manipulation) as events,
  action_statement
from information_schema.triggers
where trigger_schema = 'public'
group by event_object_table, trigger_name, action_timing, action_statement
order by event_object_table, trigger_name;

-- 9. Roles & permissions foundation verification
select
  (select count(*) from public.roles) as role_count,
  (select count(*) from public.permissions) as permission_count,
  (select count(*) from public.role_permissions) as role_permission_count,
  (select count(*) from public.company_members) as company_member_count,
  (select count(*) from public.company_members where role_code = 'owner' and status = 'active')
    as active_owner_membership_count,
  (select count(*) from public.company_invitations where status = 'pending')
    as pending_invitation_count;

-- 10. Owner membership consistency
select
  c.id as company_id,
  c.name as company_name,
  c.owner_id,
  cm.id as owner_membership_id,
  cm.role_code,
  cm.status,
  case
    when c.owner_id is null then 'ERROR: owner_id is null'
    when cm.id is null then 'ERROR: owner membership missing'
    when cm.role_code <> 'owner' then 'ERROR: role mismatch'
    when cm.status <> 'active' then 'ERROR: owner inactive'
    else 'OK'
  end as audit_result
from public.companies c
left join public.company_members cm
  on cm.company_id = c.id
 and cm.user_id = c.owner_id
order by audit_result, c.name;

-- 11. Profile active-company access consistency
select
  p.id as user_id,
  p.active_company_id,
  c.name as active_company_name,
  public.current_company_role(p.active_company_id, p.id) as resolved_role,
  public.is_company_member(p.active_company_id, p.id) as is_active_member,
  case
    when p.active_company_id is null then 'NO ACTIVE COMPANY'
    when c.id is null then 'ERROR: company missing'
    when public.is_company_member(p.active_company_id, p.id) then 'OK'
    else 'ERROR: unauthorized active company'
  end as audit_result
from public.profiles p
left join public.companies c on c.id = p.active_company_id
order by audit_result, p.id;

-- 12. Core-table RLS coverage matrix
with core_tables(table_name, required_permission) as (
  values
    ('companies', 'company.view'),
    ('profiles', 'company.view'),
    ('company_members', 'team.view'),
    ('company_invitations', 'team.view'),
    ('ledgers', 'ledgers.view'),
    ('products', 'inventory.view'),
    ('sales', 'sales.view'),
    ('sale_items', 'sales.view'),
    ('purchases', 'purchase.view'),
    ('purchase_items', 'purchase.view'),
    ('payments', 'payments.view'),
    ('expenses', 'expenses.view'),
    ('credit_notes', 'credit_notes.view'),
    ('credit_note_items', 'credit_notes.view'),
    ('debit_notes', 'debit_notes.view'),
    ('debit_note_items', 'debit_notes.view'),
    ('chart_of_accounts', 'accounting.view'),
    ('accounting_vouchers', 'accounting.view'),
    ('accounting_entries', 'accounting.view'),
    ('accounting_period_locks', 'accounting.view'),
    ('audit_logs', 'audit.view')
)
select
  ct.table_name,
  ct.required_permission,
  to_regclass(format('public.%I', ct.table_name)) is not null as table_exists,
  coalesce(c.relrowsecurity, false) as rls_enabled,
  count(pp.policyname) as policy_count,
  case
    when to_regclass(format('public.%I', ct.table_name)) is null
      then 'TABLE NOT FOUND'
    when coalesce(c.relrowsecurity, false) = false
      then 'HIGH: RLS DISABLED'
    when count(pp.policyname) = 0
      then 'HIGH: NO POLICIES'
    else 'REVIEW POLICIES'
  end as audit_result
from core_tables ct
left join pg_class c
  on c.oid = to_regclass(format('public.%I', ct.table_name))
left join pg_policies pp
  on pp.schemaname = 'public'
 and pp.tablename = ct.table_name
group by ct.table_name, ct.required_permission, c.relrowsecurity
order by audit_result, ct.table_name;

-- 13. Final summary
with public_tables as (
  select c.relrowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
missing_path as (
  select p.oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind in ('f', 'p')
    and p.prosecdef = true
    and (
      p.proconfig is null
      or not exists (
        select 1
        from unnest(p.proconfig) setting
        where setting like 'search_path=%'
      )
    )
),
owner_errors as (
  select c.id
  from public.companies c
  left join public.company_members cm
    on cm.company_id = c.id
   and cm.user_id = c.owner_id
  where c.owner_id is null
     or cm.id is null
     or cm.role_code <> 'owner'
     or cm.status <> 'active'
)
select *
from (
  select
    'Public tables with RLS disabled' as finding,
    count(*)::bigint as finding_count,
    case when count(*) = 0 then 'OK' else 'ACTION REQUIRED' end as status
  from public_tables
  where relrowsecurity = false

  union all

  select
    'Security-definer routines without fixed search_path',
    count(*)::bigint,
    case when count(*) = 0 then 'OK' else 'ACTION REQUIRED' end
  from missing_path

  union all

  select
    'Company owner membership inconsistencies',
    count(*)::bigint,
    case when count(*) = 0 then 'OK' else 'ACTION REQUIRED' end
  from owner_errors
) findings
order by status, finding;