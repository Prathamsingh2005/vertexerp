-- VertexERP Roles & Permissions Foundation - FIXED VERSION
-- Fixes: UNNEST aliases, trigger DELETE safety, email validation
-- Phase 1: membership, built-in roles, permission matrix, invitation RPCs
-- Safe scope: this script does NOT replace RLS policies on existing business tables.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Master tables
-- ---------------------------------------------------------------------------

create table if not exists public.roles (
  code text primary key,
  name text not null,
  description text not null default '',
  is_system boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roles_code_format_check
    check (code ~ '^[a-z][a-z0-9_]*$')
);

create table if not exists public.permissions (
  code text primary key,
  module text not null,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  constraint permissions_code_format_check
    check (code ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$')
);

create table if not exists public.role_permissions (
  role_code text not null references public.roles(code) on delete cascade,
  permission_code text not null references public.permissions(code) on delete cascade,
  allowed boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (role_code, permission_code)
);

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role_code text not null references public.roles(code),
  status text not null default 'active',
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_members_status_check
    check (status in ('active', 'inactive')),
  constraint company_members_company_user_unique
    unique (company_id, user_id)
);

create table if not exists public.company_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  role_code text not null references public.roles(code),
  token uuid not null default gen_random_uuid(),
  status text not null default 'pending',
  invited_by uuid not null references auth.users(id) on delete cascade,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_invitations_status_check
    check (status in ('pending', 'accepted', 'expired', 'cancelled')),
  constraint company_invitations_token_unique
    unique (token)
);

create index if not exists company_members_company_status_idx
  on public.company_members(company_id, status);

create index if not exists company_members_user_status_idx
  on public.company_members(user_id, status);

create index if not exists company_invitations_company_status_idx
  on public.company_invitations(company_id, status);

create unique index if not exists company_invitations_pending_email_unique
  on public.company_invitations(company_id, lower(email))
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- 2. Updated-at trigger
-- ---------------------------------------------------------------------------

create or replace function public.vertexerp_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists roles_touch_updated_at on public.roles;
create trigger roles_touch_updated_at
before update on public.roles
for each row execute function public.vertexerp_touch_updated_at();

drop trigger if exists company_members_touch_updated_at on public.company_members;
create trigger company_members_touch_updated_at
before update on public.company_members
for each row execute function public.vertexerp_touch_updated_at();

drop trigger if exists company_invitations_touch_updated_at on public.company_invitations;
create trigger company_invitations_touch_updated_at
before update on public.company_invitations
for each row execute function public.vertexerp_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Built-in roles
-- ---------------------------------------------------------------------------

insert into public.roles (code, name, description, is_system, sort_order)
values
  ('owner', 'Owner', 'Company owner with complete and protected access.', true, 10),
  ('admin', 'Admin', 'Operational administrator with broad company access.', true, 20),
  ('accountant', 'Accountant', 'Accounting, GST, payment, expense and report access.', true, 30),
  ('sales_executive', 'Sales Executive', 'Sales, customer, receipt and credit-note access.', true, 40),
  ('purchase_manager', 'Purchase Manager', 'Purchase, supplier, payment and debit-note access.', true, 50),
  ('inventory_manager', 'Inventory Manager', 'Product, stock and inventory operations access.', true, 60),
  ('viewer', 'Viewer', 'Read-only access to dashboards and reports.', true, 70)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  is_system = excluded.is_system,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 4. Permission catalogue
-- ---------------------------------------------------------------------------

insert into public.permissions (code, module, name, description)
values
  ('dashboard.view', 'Dashboard', 'View dashboard', 'View company dashboard and summary cards.'),

  ('company.view', 'Company', 'View company', 'View active company details.'),
  ('company.edit', 'Company', 'Edit company', 'Edit company profile and GST setup.'),
  ('company.delete', 'Company', 'Delete company', 'Delete a company and its related data.'),

  ('team.view', 'Team', 'View team', 'View company members and pending invitations.'),
  ('team.manage', 'Team', 'Manage team', 'Invite, deactivate and change member roles.'),
  ('roles.view', 'Roles', 'View roles', 'View role and permission matrix.'),
  ('roles.manage', 'Roles', 'Manage roles', 'Create or modify custom roles and permissions.'),

  ('ledgers.view', 'Ledgers', 'View ledgers', 'View customer and supplier ledgers.'),
  ('ledgers.create', 'Ledgers', 'Create ledgers', 'Create customer and supplier ledgers.'),
  ('ledgers.edit', 'Ledgers', 'Edit ledgers', 'Edit ledger master data.'),
  ('ledgers.delete', 'Ledgers', 'Delete ledgers', 'Delete eligible ledger records.'),

  ('inventory.view', 'Inventory', 'View inventory', 'View products, stock and valuation.'),
  ('inventory.create', 'Inventory', 'Create inventory', 'Create product and stock masters.'),
  ('inventory.edit', 'Inventory', 'Edit inventory', 'Edit product and stock information.'),
  ('inventory.delete', 'Inventory', 'Delete inventory', 'Delete eligible inventory records.'),

  ('sales.view', 'Sales', 'View sales', 'View sales invoices.'),
  ('sales.create', 'Sales', 'Create sales', 'Create sales invoices.'),
  ('sales.edit', 'Sales', 'Edit sales', 'Edit eligible sales invoices.'),
  ('sales.delete', 'Sales', 'Delete sales', 'Delete eligible sales invoices.'),

  ('credit_notes.view', 'Credit Notes', 'View credit notes', 'View customer credit notes.'),
  ('credit_notes.create', 'Credit Notes', 'Create credit notes', 'Create customer credit notes.'),
  ('credit_notes.void', 'Credit Notes', 'Void credit notes', 'Void posted customer credit notes.'),

  ('purchase.view', 'Purchase', 'View purchases', 'View purchase bills.'),
  ('purchase.create', 'Purchase', 'Create purchases', 'Create purchase bills.'),
  ('purchase.edit', 'Purchase', 'Edit purchases', 'Edit eligible purchase bills.'),
  ('purchase.delete', 'Purchase', 'Delete purchases', 'Delete eligible purchase bills.'),

  ('debit_notes.view', 'Debit Notes', 'View debit notes', 'View supplier debit notes.'),
  ('debit_notes.create', 'Debit Notes', 'Create debit notes', 'Create supplier debit notes.'),
  ('debit_notes.void', 'Debit Notes', 'Void debit notes', 'Void posted supplier debit notes.'),

  ('expenses.view', 'Expenses', 'View expenses', 'View business expenses.'),
  ('expenses.create', 'Expenses', 'Create expenses', 'Create business expenses.'),
  ('expenses.edit', 'Expenses', 'Edit expenses', 'Edit business expenses.'),
  ('expenses.delete', 'Expenses', 'Delete expenses', 'Delete eligible expenses.'),

  ('payments.view', 'Payments', 'View payments', 'View customer receipts and supplier payments.'),
  ('payments.create', 'Payments', 'Create payments', 'Record receipts and supplier payments.'),
  ('payments.edit', 'Payments', 'Edit payments', 'Edit eligible payment entries.'),
  ('payments.delete', 'Payments', 'Delete payments', 'Delete eligible payment entries.'),

  ('outstanding.view', 'Outstanding', 'View outstanding', 'View receivable and payable balances.'),

  ('accounting.view', 'Accounting', 'View accounting', 'View accounts, vouchers and ledgers.'),
  ('accounting.manage', 'Accounting', 'Manage accounting', 'Create and update accounting vouchers.'),
  ('accounting.lock', 'Accounting', 'Manage period locks', 'Create and deactivate accounting period locks.'),

  ('reports.view', 'Reports', 'View reports', 'View business and party reports.'),
  ('gst_reports.view', 'GST Reports', 'View GST reports', 'View GST summaries, registers and reconciliation.'),

  ('audit.view', 'Audit', 'View audit history', 'View audit trail and change history.'),
  ('backup.export', 'Backup', 'Export backup', 'Download company backup and CSV exports.')
on conflict (code) do update
set
  module = excluded.module,
  name = excluded.name,
  description = excluded.description;

-- Rebuild only the built-in role matrix. Custom roles remain untouched.
delete from public.role_permissions
where role_code in (
  'owner',
  'admin',
  'accountant',
  'sales_executive',
  'purchase_manager',
  'inventory_manager',
  'viewer'
);

-- Owner: every permission.
insert into public.role_permissions (role_code, permission_code, allowed)
select 'owner', code, true
from public.permissions;

-- Admin: broad access, but no company deletion or role-definition changes.
insert into public.role_permissions (role_code, permission_code, allowed)
select 'admin', code, true
from public.permissions
where code not in ('company.delete', 'roles.manage');

-- Accountant.
insert into public.role_permissions (role_code, permission_code, allowed)
select 'accountant', permission_code, true
from unnest(array[
  'dashboard.view',
  'company.view',
  'team.view',
  'roles.view',
  'ledgers.view',
  'ledgers.create',
  'ledgers.edit',
  'inventory.view',
  'sales.view',
  'credit_notes.view',
  'credit_notes.create',
  'purchase.view',
  'debit_notes.view',
  'debit_notes.create',
  'expenses.view',
  'expenses.create',
  'expenses.edit',
  'payments.view',
  'payments.create',
  'payments.edit',
  'outstanding.view',
  'accounting.view',
  'accounting.manage',
  'accounting.lock',
  'reports.view',
  'gst_reports.view',
  'audit.view',
  'backup.export'
]::text[]) as permission_list(permission_code);

-- Sales Executive.
insert into public.role_permissions (role_code, permission_code, allowed)
select 'sales_executive', permission_code, true
from unnest(array[
  'dashboard.view',
  'company.view',
  'ledgers.view',
  'ledgers.create',
  'ledgers.edit',
  'inventory.view',
  'sales.view',
  'sales.create',
  'sales.edit',
  'credit_notes.view',
  'credit_notes.create',
  'payments.view',
  'payments.create',
  'outstanding.view',
  'reports.view'
]::text[]) as permission_list(permission_code);

-- Purchase Manager.
insert into public.role_permissions (role_code, permission_code, allowed)
select 'purchase_manager', permission_code, true
from unnest(array[
  'dashboard.view',
  'company.view',
  'ledgers.view',
  'ledgers.create',
  'ledgers.edit',
  'inventory.view',
  'inventory.create',
  'inventory.edit',
  'purchase.view',
  'purchase.create',
  'purchase.edit',
  'debit_notes.view',
  'debit_notes.create',
  'payments.view',
  'payments.create',
  'outstanding.view',
  'reports.view'
]::text[]) as permission_list(permission_code);

-- Inventory Manager.
insert into public.role_permissions (role_code, permission_code, allowed)
select 'inventory_manager', permission_code, true
from unnest(array[
  'dashboard.view',
  'company.view',
  'ledgers.view',
  'inventory.view',
  'inventory.create',
  'inventory.edit',
  'inventory.delete',
  'sales.view',
  'purchase.view',
  'credit_notes.view',
  'debit_notes.view',
  'reports.view'
]::text[]) as permission_list(permission_code);

-- Viewer: read-only.
insert into public.role_permissions (role_code, permission_code, allowed)
select 'viewer', permission_code, true
from unnest(array[
  'dashboard.view',
  'company.view',
  'team.view',
  'roles.view',
  'ledgers.view',
  'inventory.view',
  'sales.view',
  'credit_notes.view',
  'purchase.view',
  'debit_notes.view',
  'expenses.view',
  'payments.view',
  'outstanding.view',
  'accounting.view',
  'reports.view',
  'gst_reports.view',
  'audit.view'
]::text[]) as permission_list(permission_code);

-- ---------------------------------------------------------------------------
-- 5. Access helper functions
-- SECURITY DEFINER avoids recursive RLS checks on company_members.
-- ---------------------------------------------------------------------------

create or replace function public.current_company_role(
  p_company_id uuid,
  p_user_id uuid default auth.uid()
)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select
    case
      when c.owner_id = p_user_id then 'owner'
      else (
        select cm.role_code
        from public.company_members cm
        where cm.company_id = c.id
          and cm.user_id = p_user_id
          and cm.status = 'active'
        limit 1
      )
    end
  from public.companies c
  where c.id = p_company_id;
$$;

create or replace function public.is_company_member(
  p_company_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select public.current_company_role(p_company_id, p_user_id) is not null;
$$;

create or replace function public.has_company_permission(
  p_company_id uuid,
  p_permission_code text,
  p_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_role_code text;
begin
  v_role_code := public.current_company_role(p_company_id, p_user_id);

  if v_role_code is null then
    return false;
  end if;

  if v_role_code = 'owner' then
    return exists (
      select 1
      from public.permissions p
      where p.code = p_permission_code
    );
  end if;

  return exists (
    select 1
    from public.role_permissions rp
    where rp.role_code = v_role_code
      and rp.permission_code = p_permission_code
      and rp.allowed = true
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Protect and automatically synchronize the company owner membership
-- ---------------------------------------------------------------------------

create or replace function public.protect_company_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_owner_id uuid;
  v_company_id uuid;
begin
  v_company_id := case
    when tg_op = 'DELETE' then old.company_id
    else new.company_id
  end;

  select c.owner_id
  into v_owner_id
  from public.companies c
  where c.id = v_company_id;

  if tg_op = 'DELETE' then
    if old.user_id = v_owner_id or old.role_code = 'owner' then
      raise exception 'The protected company owner membership cannot be deleted.';
    end if;

    return old;
  end if;

  if new.role_code = 'owner' and new.user_id <> v_owner_id then
    raise exception 'Only the companies.owner_id user can have the Owner role.';
  end if;

  if tg_op = 'UPDATE'
     and old.user_id = v_owner_id
     and (
       new.role_code <> 'owner'
       or new.status <> 'active'
       or new.user_id <> old.user_id
       or new.company_id <> old.company_id
     ) then
    raise exception 'The protected company owner membership cannot be changed or deactivated.';
  end if;

  if new.user_id = v_owner_id then
    new.role_code := 'owner';
    new.status := 'active';
    new.joined_at := coalesce(new.joined_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists protect_company_owner_membership_trigger
  on public.company_members;

create trigger protect_company_owner_membership_trigger
before insert or update or delete on public.company_members
for each row execute function public.protect_company_owner_membership();

create or replace function public.sync_company_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_owner_email text;
begin
  if new.owner_id is null then
    return new;
  end if;

  select lower(u.email)
  into v_owner_email
  from auth.users u
  where u.id = new.owner_id;

  if tg_op = 'UPDATE'
     and old.owner_id is distinct from new.owner_id
     and old.owner_id is not null then
    update public.company_members
    set
      role_code = 'admin',
      status = 'active',
      updated_at = now()
    where company_id = new.id
      and user_id = old.owner_id;
  end if;

  insert into public.company_members (
    company_id,
    user_id,
    email,
    role_code,
    status,
    joined_at
  )
  values (
    new.id,
    new.owner_id,
    v_owner_email,
    'owner',
    'active',
    now()
  )
  on conflict (company_id, user_id) do update
  set
    email = coalesce(excluded.email, public.company_members.email),
    role_code = 'owner',
    status = 'active',
    joined_at = coalesce(public.company_members.joined_at, now()),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists sync_company_owner_membership_trigger
  on public.companies;

create trigger sync_company_owner_membership_trigger
after insert or update of owner_id on public.companies
for each row execute function public.sync_company_owner_membership();

-- Backfill all existing company owners.
insert into public.company_members (
  company_id,
  user_id,
  email,
  role_code,
  status,
  joined_at
)
select
  c.id,
  c.owner_id,
  lower(u.email),
  'owner',
  'active',
  coalesce(c.created_at, now())
from public.companies c
left join auth.users u on u.id = c.owner_id
where c.owner_id is not null
on conflict (company_id, user_id) do update
set
  email = coalesce(excluded.email, public.company_members.email),
  role_code = 'owner',
  status = 'active',
  joined_at = coalesce(public.company_members.joined_at, excluded.joined_at),
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 7. Invitation and member-management RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_company_invitation(
  p_company_id uuid,
  p_email text,
  p_role_code text,
  p_expires_in_days integer default 7
)
returns table (
  invitation_id uuid,
  invitation_token uuid,
  invitation_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_email text;
  v_invitation public.company_invitations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.has_company_permission(
    p_company_id,
    'team.manage',
    auth.uid()
  ) then
    raise exception 'You do not have permission to manage this company team.';
  end if;

  v_email := lower(trim(coalesce(p_email, '')));

  if v_email = ''
     or v_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then
    raise exception 'Enter a valid email address.';
  end if;

  if p_role_code = 'owner' then
    raise exception 'Owner access cannot be assigned through an invitation.';
  end if;

  if not exists (
    select 1
    from public.roles r
    where r.code = p_role_code
  ) then
    raise exception 'The selected role does not exist.';
  end if;

  if coalesce(p_expires_in_days, 0) < 1
     or p_expires_in_days > 30 then
    raise exception 'Invitation expiry must be between 1 and 30 days.';
  end if;

  if exists (
    select 1
    from public.company_members cm
    where cm.company_id = p_company_id
      and lower(coalesce(cm.email, '')) = v_email
      and cm.status = 'active'
  ) then
    raise exception 'This user is already an active company member.';
  end if;

  update public.company_invitations
  set
    status = 'cancelled',
    cancelled_at = now(),
    updated_at = now()
  where company_id = p_company_id
    and lower(email) = v_email
    and status = 'pending';

  insert into public.company_invitations (
    company_id,
    email,
    role_code,
    invited_by,
    expires_at
  )
  values (
    p_company_id,
    v_email,
    p_role_code,
    auth.uid(),
    now() + make_interval(days => p_expires_in_days)
  )
  returning *
  into v_invitation;

  return query
  select
    v_invitation.id,
    v_invitation.token,
    v_invitation.expires_at;
end;
$$;

create or replace function public.accept_company_invitation(
  p_token uuid
)
returns table (
  company_id uuid,
  role_code text
)
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_invitation public.company_invitations%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select lower(u.email)
  into v_user_email
  from auth.users u
  where u.id = v_user_id;

  if v_user_email is null then
    raise exception 'The signed-in account does not have an email address.';
  end if;

  select *
  into v_invitation
  from public.company_invitations ci
  where ci.token = p_token
  for update;

  if not found then
    raise exception 'Invitation not found.';
  end if;

  if v_invitation.status <> 'pending' then
    raise exception 'This invitation is no longer pending.';
  end if;

  if v_invitation.expires_at <= now() then
    update public.company_invitations
    set
      status = 'expired',
      updated_at = now()
    where id = v_invitation.id;

    raise exception 'This invitation has expired.';
  end if;

  if lower(v_invitation.email) <> v_user_email then
    raise exception 'Sign in using the email address that received this invitation.';
  end if;

  insert into public.company_members (
    company_id,
    user_id,
    email,
    role_code,
    status,
    invited_by,
    joined_at
  )
  values (
    v_invitation.company_id,
    v_user_id,
    v_user_email,
    v_invitation.role_code,
    'active',
    v_invitation.invited_by,
    now()
  )
  on conflict (company_id, user_id) do update
  set
    email = excluded.email,
    role_code = excluded.role_code,
    status = 'active',
    invited_by = excluded.invited_by,
    joined_at = coalesce(public.company_members.joined_at, now()),
    updated_at = now();

  update public.company_invitations
  set
    status = 'accepted',
    accepted_by = v_user_id,
    accepted_at = now(),
    updated_at = now()
  where id = v_invitation.id;

  update public.profiles
  set active_company_id = coalesce(active_company_id, v_invitation.company_id)
  where id = v_user_id;

  return query
  select v_invitation.company_id, v_invitation.role_code;
end;
$$;

create or replace function public.update_company_member_role(
  p_company_id uuid,
  p_member_id uuid,
  p_role_code text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
begin
  if not public.has_company_permission(
    p_company_id,
    'team.manage',
    auth.uid()
  ) then
    raise exception 'You do not have permission to manage this company team.';
  end if;

  if p_role_code = 'owner' then
    raise exception 'Owner access cannot be assigned from team management.';
  end if;

  if not exists (
    select 1
    from public.roles r
    where r.code = p_role_code
  ) then
    raise exception 'The selected role does not exist.';
  end if;

  update public.company_members
  set
    role_code = p_role_code,
    updated_at = now()
  where id = p_member_id
    and company_id = p_company_id
    and role_code <> 'owner';

  if not found then
    raise exception 'Member not found or protected owner membership selected.';
  end if;
end;
$$;

create or replace function public.update_company_member_status(
  p_company_id uuid,
  p_member_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
begin
  if not public.has_company_permission(
    p_company_id,
    'team.manage',
    auth.uid()
  ) then
    raise exception 'You do not have permission to manage this company team.';
  end if;

  if p_status not in ('active', 'inactive') then
    raise exception 'Member status must be active or inactive.';
  end if;

  update public.company_members
  set
    status = p_status,
    updated_at = now()
  where id = p_member_id
    and company_id = p_company_id
    and role_code <> 'owner';

  if not found then
    raise exception 'Member not found or protected owner membership selected.';
  end if;
end;
$$;

create or replace function public.cancel_company_invitation(
  p_company_id uuid,
  p_invitation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
begin
  if not public.has_company_permission(
    p_company_id,
    'team.manage',
    auth.uid()
  ) then
    raise exception 'You do not have permission to manage this company team.';
  end if;

  update public.company_invitations
  set
    status = 'cancelled',
    cancelled_at = now(),
    updated_at = now()
  where id = p_invitation_id
    and company_id = p_company_id
    and status = 'pending';

  if not found then
    raise exception 'Pending invitation not found.';
  end if;
end;
$$;

create or replace function public.get_my_company_access(
  p_company_id uuid default null
)
returns table (
  company_id uuid,
  company_name text,
  role_code text,
  role_name text,
  member_status text,
  permission_codes text[]
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_company_id uuid;
  v_role_code text;
begin
  if auth.uid() is null then
    return;
  end if;

  v_company_id := p_company_id;

  if v_company_id is null then
    select p.active_company_id
    into v_company_id
    from public.profiles p
    where p.id = auth.uid();
  end if;

  if v_company_id is null then
    return;
  end if;

  v_role_code := public.current_company_role(v_company_id, auth.uid());

  if v_role_code is null then
    return;
  end if;

  return query
  select
    c.id,
    c.name,
    v_role_code,
    r.name,
    'active'::text,
    case
      when v_role_code = 'owner' then (
        select coalesce(array_agg(p.code order by p.code), array[]::text[])
        from public.permissions p
      )
      else (
        select coalesce(
          array_agg(rp.permission_code order by rp.permission_code)
            filter (where rp.allowed = true),
          array[]::text[]
        )
        from public.role_permissions rp
        where rp.role_code = v_role_code
      )
    end
  from public.companies c
  join public.roles r on r.code = v_role_code
  where c.id = v_company_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. RLS for the new security tables only
-- ---------------------------------------------------------------------------

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.company_members enable row level security;
alter table public.company_invitations enable row level security;

drop policy if exists roles_authenticated_read on public.roles;
create policy roles_authenticated_read
on public.roles
for select
to authenticated
using (true);

drop policy if exists permissions_authenticated_read on public.permissions;
create policy permissions_authenticated_read
on public.permissions
for select
to authenticated
using (true);

drop policy if exists role_permissions_authenticated_read on public.role_permissions;
create policy role_permissions_authenticated_read
on public.role_permissions
for select
to authenticated
using (true);

drop policy if exists company_members_company_read on public.company_members;
create policy company_members_company_read
on public.company_members
for select
to authenticated
using (public.is_company_member(company_id, auth.uid()));

drop policy if exists company_invitations_manager_read on public.company_invitations;
create policy company_invitations_manager_read
on public.company_invitations
for select
to authenticated
using (
  public.has_company_permission(
    company_id,
    'team.manage',
    auth.uid()
  )
);

-- Direct writes remain blocked. Team changes use security-definer RPCs.
revoke all on public.roles from anon;
revoke all on public.permissions from anon;
revoke all on public.role_permissions from anon;
revoke all on public.company_members from anon;
revoke all on public.company_invitations from anon;

grant select on public.roles to authenticated;
grant select on public.permissions to authenticated;
grant select on public.role_permissions to authenticated;
grant select on public.company_members to authenticated;
grant select on public.company_invitations to authenticated;

revoke all on function public.current_company_role(uuid, uuid) from public;
revoke all on function public.is_company_member(uuid, uuid) from public;
revoke all on function public.has_company_permission(uuid, text, uuid) from public;
revoke all on function public.create_company_invitation(uuid, text, text, integer) from public;
revoke all on function public.accept_company_invitation(uuid) from public;
revoke all on function public.update_company_member_role(uuid, uuid, text) from public;
revoke all on function public.update_company_member_status(uuid, uuid, text) from public;
revoke all on function public.cancel_company_invitation(uuid, uuid) from public;
revoke all on function public.get_my_company_access(uuid) from public;

grant execute on function public.current_company_role(uuid, uuid) to authenticated;
grant execute on function public.is_company_member(uuid, uuid) to authenticated;
grant execute on function public.has_company_permission(uuid, text, uuid) to authenticated;
grant execute on function public.create_company_invitation(uuid, text, text, integer) to authenticated;
grant execute on function public.accept_company_invitation(uuid) to authenticated;
grant execute on function public.update_company_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.update_company_member_status(uuid, uuid, text) to authenticated;
grant execute on function public.cancel_company_invitation(uuid, uuid) to authenticated;
grant execute on function public.get_my_company_access(uuid) to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- Verification result shown after successful execution
-- ---------------------------------------------------------------------------

select
  (select count(*) from public.roles) as role_count,
  (select count(*) from public.permissions) as permission_count,
  (select count(*) from public.role_permissions) as role_permission_count,
  (select count(*) from public.company_members where role_code = 'owner') as migrated_owner_count;