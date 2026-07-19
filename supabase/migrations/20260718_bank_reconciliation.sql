-- VertexERP Bank Reconciliation
-- Persistent statement imports, automatic matching and manual matching.
-- Run once in Supabase SQL Editor.

begin;

create extension if not exists pgcrypto;

create table if not exists public.bank_statement_imports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  bank_account_id uuid not null references public.chart_of_accounts(id) on delete restrict,
  file_name text not null,
  statement_opening_balance numeric(18,2),
  statement_closing_balance numeric(18,2),
  imported_by uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.bank_statement_imports(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  bank_account_id uuid not null references public.chart_of_accounts(id) on delete restrict,
  line_number integer not null,
  transaction_date date not null,
  description text,
  reference_number text,
  deposit numeric(18,2) not null default 0,
  withdrawal numeric(18,2) not null default 0,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint bank_statement_lines_amount_check check (
    deposit >= 0
    and withdrawal >= 0
    and (
      (deposit > 0 and withdrawal = 0)
      or
      (withdrawal > 0 and deposit = 0)
    )
  ),
  constraint bank_statement_lines_import_line_unique
    unique (import_id, line_number)
);

create table if not exists public.bank_reconciliation_matches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  bank_account_id uuid not null references public.chart_of_accounts(id) on delete restrict,
  statement_line_id uuid not null references public.bank_statement_lines(id) on delete cascade,
  accounting_entry_id uuid not null references public.accounting_entries(id) on delete cascade,
  matched_amount numeric(18,2) not null check (matched_amount > 0),
  match_type text not null default 'MANUAL'
    check (match_type in ('AUTO', 'MANUAL')),
  matched_by uuid not null,
  matched_at timestamptz not null default now(),
  constraint bank_reconciliation_match_pair_unique
    unique (statement_line_id, accounting_entry_id)
);

create index if not exists bank_statement_imports_lookup_idx
  on public.bank_statement_imports (
    company_id,
    bank_account_id,
    created_at desc
  );

create index if not exists bank_statement_lines_lookup_idx
  on public.bank_statement_lines (
    company_id,
    bank_account_id,
    transaction_date
  );

create index if not exists bank_reconciliation_matches_statement_idx
  on public.bank_reconciliation_matches (statement_line_id);

create index if not exists bank_reconciliation_matches_entry_idx
  on public.bank_reconciliation_matches (accounting_entry_id);

alter table public.bank_statement_imports enable row level security;
alter table public.bank_statement_lines enable row level security;
alter table public.bank_reconciliation_matches enable row level security;

do $drop_old_policies$
declare
  v_policy record;
begin
  for v_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'bank_statement_imports',
        'bank_statement_lines',
        'bank_reconciliation_matches'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      v_policy.policyname,
      v_policy.schemaname,
      v_policy.tablename
    );
  end loop;
end;
$drop_old_policies$;

create policy bank_statement_imports_select
on public.bank_statement_imports
for select
to authenticated
using (
  public.has_any_company_permission(
    company_id,
    '{accounting.view}'::text[],
    auth.uid()
  )
);

create policy bank_statement_lines_select
on public.bank_statement_lines
for select
to authenticated
using (
  public.has_any_company_permission(
    company_id,
    '{accounting.view}'::text[],
    auth.uid()
  )
);

create policy bank_reconciliation_matches_select
on public.bank_reconciliation_matches
for select
to authenticated
using (
  public.has_any_company_permission(
    company_id,
    '{accounting.view}'::text[],
    auth.uid()
  )
);

grant select on public.bank_statement_imports to authenticated;
grant select on public.bank_statement_lines to authenticated;
grant select on public.bank_reconciliation_matches to authenticated;

create or replace function public.get_bank_reconciliation_accounts(
  p_company_id uuid,
  p_as_on_date date default current_date
)
returns table (
  account_id uuid,
  account_code text,
  account_name text,
  book_balance numeric,
  balance_side text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
begin
  if auth.uid() is null then
    raise exception 'Please sign in before viewing Bank Reconciliation.';
  end if;

  if not public.has_any_company_permission(
    p_company_id,
    '{accounting.view}'::text[],
    auth.uid()
  ) then
    raise exception 'You do not have access to this company accounting report.';
  end if;

  return query
  with balances as (
    select
      ae.account_id,
      coalesce(sum(ae.debit - ae.credit), 0)::numeric as signed_balance
    from public.accounting_vouchers av
    join public.accounting_entries ae
      on ae.voucher_id = av.id
    where av.company_id = p_company_id
      and lower(av.status) = 'posted'
      and av.voucher_date <= coalesce(p_as_on_date, current_date)
    group by ae.account_id
  )
  select
    coa.id,
    coa.code,
    coa.name,
    abs(coalesce(b.signed_balance, 0))::numeric,
    case
      when coalesce(b.signed_balance, 0) < 0 then 'Cr'
      else 'Dr'
    end::text
  from public.chart_of_accounts coa
  left join balances b
    on b.account_id = coa.id
  where coa.company_id = p_company_id
    and coa.is_active = true
    and coa.system_key = 'bank'
  order by coa.code, coa.name;
end;
$function$;

create or replace function public.import_bank_statement(
  p_company_id uuid,
  p_bank_account_id uuid,
  p_file_name text,
  p_statement_opening_balance numeric,
  p_statement_closing_balance numeric,
  p_rows jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_import_id uuid;
  v_row record;
  v_row_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Please sign in before importing a bank statement.';
  end if;

  if not public.has_any_company_permission(
    p_company_id,
    '{accounting.view}'::text[],
    auth.uid()
  ) then
    raise exception 'You do not have access to reconcile this company.';
  end if;

  if not exists (
    select 1
    from public.chart_of_accounts coa
    where coa.id = p_bank_account_id
      and coa.company_id = p_company_id
      and coa.is_active = true
      and coa.system_key = 'bank'
  ) then
    raise exception 'Selected Bank Account is not valid for the active company.';
  end if;

  if p_rows is null
     or jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) = 0 then
    raise exception 'The bank statement contains no valid transaction rows.';
  end if;

  insert into public.bank_statement_imports (
    company_id,
    bank_account_id,
    file_name,
    statement_opening_balance,
    statement_closing_balance,
    imported_by
  )
  values (
    p_company_id,
    p_bank_account_id,
    coalesce(nullif(trim(p_file_name), ''), 'Bank Statement.csv'),
    p_statement_opening_balance,
    p_statement_closing_balance,
    auth.uid()
  )
  returning id into v_import_id;

  for v_row in
    select *
    from jsonb_to_recordset(p_rows) as x (
      line_number integer,
      transaction_date date,
      description text,
      reference_number text,
      deposit numeric,
      withdrawal numeric,
      raw_data jsonb
    )
  loop
    if v_row.transaction_date is null then
      raise exception 'A statement row is missing its transaction date.';
    end if;

    if coalesce(v_row.deposit, 0) <= 0
       and coalesce(v_row.withdrawal, 0) <= 0 then
      raise exception
        'Statement line % has no positive deposit or withdrawal amount.',
        coalesce(v_row.line_number, v_row_count + 1);
    end if;

    if coalesce(v_row.deposit, 0) > 0
       and coalesce(v_row.withdrawal, 0) > 0 then
      raise exception
        'Statement line % cannot contain both deposit and withdrawal.',
        coalesce(v_row.line_number, v_row_count + 1);
    end if;

    insert into public.bank_statement_lines (
      import_id,
      company_id,
      bank_account_id,
      line_number,
      transaction_date,
      description,
      reference_number,
      deposit,
      withdrawal,
      raw_data
    )
    values (
      v_import_id,
      p_company_id,
      p_bank_account_id,
      coalesce(v_row.line_number, v_row_count + 1),
      v_row.transaction_date,
      nullif(trim(coalesce(v_row.description, '')), ''),
      nullif(trim(coalesce(v_row.reference_number, '')), ''),
      round(coalesce(v_row.deposit, 0), 2),
      round(coalesce(v_row.withdrawal, 0), 2),
      coalesce(v_row.raw_data, '{}'::jsonb)
    );

    v_row_count := v_row_count + 1;
  end loop;

  return v_import_id;
end;
$function$;

create or replace function public.get_bank_statement_imports(
  p_company_id uuid,
  p_bank_account_id uuid
)
returns table (
  import_id uuid,
  file_name text,
  statement_opening_balance numeric,
  statement_closing_balance numeric,
  transaction_count bigint,
  period_start date,
  period_end date,
  imported_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
begin
  if auth.uid() is null then
    raise exception 'Please sign in before viewing imported statements.';
  end if;

  if not public.has_any_company_permission(
    p_company_id,
    '{accounting.view}'::text[],
    auth.uid()
  ) then
    raise exception 'You do not have access to this company.';
  end if;

  return query
  select
    bsi.id,
    bsi.file_name,
    bsi.statement_opening_balance,
    bsi.statement_closing_balance,
    count(bsl.id)::bigint,
    min(bsl.transaction_date),
    max(bsl.transaction_date),
    bsi.created_at
  from public.bank_statement_imports bsi
  left join public.bank_statement_lines bsl
    on bsl.import_id = bsi.id
  where bsi.company_id = p_company_id
    and bsi.bank_account_id = p_bank_account_id
  group by bsi.id
  order by bsi.created_at desc;
end;
$function$;

create or replace function public.get_bank_statement_lines(
  p_company_id uuid,
  p_bank_account_id uuid,
  p_from_date date,
  p_to_date date,
  p_import_id uuid default null
)
returns table (
  statement_line_id uuid,
  import_id uuid,
  transaction_date date,
  description text,
  reference_number text,
  direction text,
  amount numeric,
  matched_amount numeric,
  remaining_amount numeric,
  reconciliation_status text,
  line_number integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
begin
  if auth.uid() is null then
    raise exception 'Please sign in before viewing bank statement lines.';
  end if;

  if not public.has_any_company_permission(
    p_company_id,
    '{accounting.view}'::text[],
    auth.uid()
  ) then
    raise exception 'You do not have access to this company.';
  end if;

  return query
  select
    bsl.id,
    bsl.import_id,
    bsl.transaction_date,
    coalesce(bsl.description, '—'),
    coalesce(bsl.reference_number, ''),
    case
      when bsl.deposit > 0 then 'INFLOW'
      else 'OUTFLOW'
    end::text,
    (bsl.deposit + bsl.withdrawal)::numeric as amount,
    round(coalesce(sum(brm.matched_amount), 0), 2)::numeric,
    round(
      greatest(
        0,
        (bsl.deposit + bsl.withdrawal)
        - coalesce(sum(brm.matched_amount), 0)
      ),
      2
    )::numeric,
    case
      when coalesce(sum(brm.matched_amount), 0) <= 0 then 'UNMATCHED'
      when coalesce(sum(brm.matched_amount), 0)
           + 0.005
           < (bsl.deposit + bsl.withdrawal) then 'PARTIAL'
      else 'MATCHED'
    end::text,
    bsl.line_number
  from public.bank_statement_lines bsl
  left join public.bank_reconciliation_matches brm
    on brm.statement_line_id = bsl.id
  where bsl.company_id = p_company_id
    and bsl.bank_account_id = p_bank_account_id
    and bsl.transaction_date between p_from_date and p_to_date
    and (p_import_id is null or bsl.import_id = p_import_id)
  group by bsl.id
  order by bsl.transaction_date, bsl.line_number, bsl.id;
end;
$function$;

create or replace function public.get_bank_book_reconciliation_entries(
  p_company_id uuid,
  p_bank_account_id uuid,
  p_from_date date,
  p_to_date date
)
returns table (
  accounting_entry_id uuid,
  voucher_id uuid,
  voucher_date date,
  voucher_number text,
  voucher_type text,
  source_type text,
  source_id uuid,
  narration text,
  description text,
  reference_number text,
  counterpart_accounts text,
  direction text,
  amount numeric,
  matched_amount numeric,
  remaining_amount numeric,
  reconciliation_status text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
begin
  if auth.uid() is null then
    raise exception 'Please sign in before viewing Bank Book entries.';
  end if;

  if not public.has_any_company_permission(
    p_company_id,
    '{accounting.view}'::text[],
    auth.uid()
  ) then
    raise exception 'You do not have access to this company.';
  end if;

  return query
  select
    ae.id,
    av.id,
    av.voucher_date,
    av.voucher_number,
    av.voucher_type,
    av.source_type,
    av.source_id,
    coalesce(av.narration, ''),
    coalesce(ae.description, ''),
    coalesce(
      nullif(trim(payment.reference_number), ''),
      av.voucher_number
    )::text,
    coalesce(counterparts.names, '—')::text,
    case
      when ae.debit > 0 then 'INFLOW'
      else 'OUTFLOW'
    end::text,
    greatest(ae.debit, ae.credit)::numeric,
    round(coalesce(sum(brm.matched_amount), 0), 2)::numeric,
    round(
      greatest(
        0,
        greatest(ae.debit, ae.credit)
        - coalesce(sum(brm.matched_amount), 0)
      ),
      2
    )::numeric,
    case
      when coalesce(sum(brm.matched_amount), 0) <= 0 then 'UNMATCHED'
      when coalesce(sum(brm.matched_amount), 0)
           + 0.005
           < greatest(ae.debit, ae.credit) then 'PARTIAL'
      else 'MATCHED'
    end::text
  from public.accounting_vouchers av
  join public.accounting_entries ae
    on ae.voucher_id = av.id
  left join public.payments payment
    on av.source_type = 'payment'
   and payment.id = av.source_id
  left join lateral (
    select string_agg(
      distinct coa2.name,
      ', '
      order by coa2.name
    ) as names
    from public.accounting_entries ae2
    join public.chart_of_accounts coa2
      on coa2.id = ae2.account_id
    where ae2.voucher_id = av.id
      and ae2.id <> ae.id
  ) counterparts on true
  left join public.bank_reconciliation_matches brm
    on brm.accounting_entry_id = ae.id
  where av.company_id = p_company_id
    and lower(av.status) = 'posted'
    and ae.account_id = p_bank_account_id
    and av.voucher_date between p_from_date and p_to_date
    and greatest(ae.debit, ae.credit) > 0
  group by
    ae.id,
    av.id,
    payment.reference_number,
    counterparts.names
  order by av.voucher_date, av.created_at, av.id, ae.line_number, ae.id;
end;
$function$;

create or replace function public.match_bank_reconciliation(
  p_company_id uuid,
  p_statement_line_id uuid,
  p_accounting_entry_id uuid,
  p_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_bank_account_id uuid;
  v_statement_direction text;
  v_book_direction text;
  v_statement_remaining numeric;
  v_book_remaining numeric;
  v_match_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Please sign in before matching transactions.';
  end if;

  if not public.has_any_company_permission(
    p_company_id,
    '{accounting.view}'::text[],
    auth.uid()
  ) then
    raise exception 'You do not have access to reconcile this company.';
  end if;

  select
    bsl.bank_account_id,
    case when bsl.deposit > 0 then 'INFLOW' else 'OUTFLOW' end,
    (bsl.deposit + bsl.withdrawal)
    - coalesce((
      select sum(brm.matched_amount)
      from public.bank_reconciliation_matches brm
      where brm.statement_line_id = bsl.id
    ), 0)
  into
    v_bank_account_id,
    v_statement_direction,
    v_statement_remaining
  from public.bank_statement_lines bsl
  where bsl.id = p_statement_line_id
    and bsl.company_id = p_company_id;

  if v_bank_account_id is null then
    raise exception 'Bank statement line was not found.';
  end if;

  select
    case when ae.debit > 0 then 'INFLOW' else 'OUTFLOW' end,
    greatest(ae.debit, ae.credit)
    - coalesce((
      select sum(brm.matched_amount)
      from public.bank_reconciliation_matches brm
      where brm.accounting_entry_id = ae.id
    ), 0)
  into
    v_book_direction,
    v_book_remaining
  from public.accounting_entries ae
  join public.accounting_vouchers av
    on av.id = ae.voucher_id
  where ae.id = p_accounting_entry_id
    and ae.account_id = v_bank_account_id
    and av.company_id = p_company_id
    and lower(av.status) = 'posted';

  if v_book_direction is null then
    raise exception 'Matching Bank Book entry was not found.';
  end if;

  if v_statement_direction <> v_book_direction then
    raise exception 'Inflow can only match inflow, and outflow can only match outflow.';
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Match amount must be greater than zero.';
  end if;

  if p_amount > v_statement_remaining + 0.005 then
    raise exception 'Match amount exceeds the remaining statement amount.';
  end if;

  if p_amount > v_book_remaining + 0.005 then
    raise exception 'Match amount exceeds the remaining Bank Book amount.';
  end if;

  insert into public.bank_reconciliation_matches (
    company_id,
    bank_account_id,
    statement_line_id,
    accounting_entry_id,
    matched_amount,
    match_type,
    matched_by
  )
  values (
    p_company_id,
    v_bank_account_id,
    p_statement_line_id,
    p_accounting_entry_id,
    round(p_amount, 2),
    'MANUAL',
    auth.uid()
  )
  on conflict (statement_line_id, accounting_entry_id)
  do update
  set
    matched_amount =
      public.bank_reconciliation_matches.matched_amount
      + excluded.matched_amount,
    match_type = 'MANUAL',
    matched_by = auth.uid(),
    matched_at = now()
  returning id into v_match_id;

  return v_match_id;
end;
$function$;

create or replace function public.auto_match_bank_reconciliation(
  p_company_id uuid,
  p_bank_account_id uuid,
  p_from_date date,
  p_to_date date,
  p_date_tolerance integer default 3
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_statement record;
  v_entry record;
  v_match_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Please sign in before automatically matching transactions.';
  end if;

  if not public.has_any_company_permission(
    p_company_id,
    '{accounting.view}'::text[],
    auth.uid()
  ) then
    raise exception 'You do not have access to reconcile this company.';
  end if;

  for v_statement in
    select
      bsl.id,
      bsl.transaction_date,
      bsl.reference_number,
      case when bsl.deposit > 0 then 'INFLOW' else 'OUTFLOW' end as direction,
      round(
        (bsl.deposit + bsl.withdrawal)
        - coalesce((
          select sum(brm.matched_amount)
          from public.bank_reconciliation_matches brm
          where brm.statement_line_id = bsl.id
        ), 0),
        2
      ) as remaining_amount
    from public.bank_statement_lines bsl
    where bsl.company_id = p_company_id
      and bsl.bank_account_id = p_bank_account_id
      and bsl.transaction_date between p_from_date and p_to_date
    order by bsl.transaction_date, bsl.line_number, bsl.id
  loop
    if v_statement.remaining_amount <= 0.005 then
      continue;
    end if;

    select
      ae.id as accounting_entry_id
    into v_entry
    from public.accounting_entries ae
    join public.accounting_vouchers av
      on av.id = ae.voucher_id
    left join public.payments payment
      on av.source_type = 'payment'
     and payment.id = av.source_id
    where av.company_id = p_company_id
      and lower(av.status) = 'posted'
      and ae.account_id = p_bank_account_id
      and av.voucher_date between p_from_date and p_to_date
      and (
        case when ae.debit > 0 then 'INFLOW' else 'OUTFLOW' end
      ) = v_statement.direction
      and abs(av.voucher_date - v_statement.transaction_date)
          <= greatest(coalesce(p_date_tolerance, 3), 0)
      and abs(
        (
          greatest(ae.debit, ae.credit)
          - coalesce((
            select sum(brm2.matched_amount)
            from public.bank_reconciliation_matches brm2
            where brm2.accounting_entry_id = ae.id
          ), 0)
        ) - v_statement.remaining_amount
      ) <= 0.005
    order by
      case
        when regexp_replace(
          lower(coalesce(v_statement.reference_number, '')),
          '[^a-z0-9]',
          '',
          'g'
        ) <> ''
         and regexp_replace(
          lower(coalesce(
            nullif(trim(payment.reference_number), ''),
            av.voucher_number
          )),
          '[^a-z0-9]',
          '',
          'g'
        ) = regexp_replace(
          lower(coalesce(v_statement.reference_number, '')),
          '[^a-z0-9]',
          '',
          'g'
        )
        then 0
        else 1
      end,
      abs(av.voucher_date - v_statement.transaction_date),
      av.created_at,
      ae.id
    limit 1;

    if v_entry.accounting_entry_id is not null then
      insert into public.bank_reconciliation_matches (
        company_id,
        bank_account_id,
        statement_line_id,
        accounting_entry_id,
        matched_amount,
        match_type,
        matched_by
      )
      values (
        p_company_id,
        p_bank_account_id,
        v_statement.id,
        v_entry.accounting_entry_id,
        v_statement.remaining_amount,
        'AUTO',
        auth.uid()
      )
      on conflict (statement_line_id, accounting_entry_id)
      do nothing;

      if found then
        v_match_count := v_match_count + 1;
      end if;
    end if;
  end loop;

  return v_match_count;
end;
$function$;

create or replace function public.get_bank_reconciliation_matches(
  p_company_id uuid,
  p_bank_account_id uuid,
  p_from_date date,
  p_to_date date
)
returns table (
  match_id uuid,
  match_type text,
  matched_amount numeric,
  matched_at timestamptz,
  statement_line_id uuid,
  statement_date date,
  statement_description text,
  statement_reference text,
  accounting_entry_id uuid,
  voucher_date date,
  voucher_number text,
  voucher_type text,
  book_reference text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
begin
  if auth.uid() is null then
    raise exception 'Please sign in before viewing reconciliation matches.';
  end if;

  if not public.has_any_company_permission(
    p_company_id,
    '{accounting.view}'::text[],
    auth.uid()
  ) then
    raise exception 'You do not have access to this company.';
  end if;

  return query
  select
    brm.id,
    brm.match_type,
    brm.matched_amount,
    brm.matched_at,
    bsl.id,
    bsl.transaction_date,
    coalesce(bsl.description, '—'),
    coalesce(bsl.reference_number, ''),
    ae.id,
    av.voucher_date,
    av.voucher_number,
    av.voucher_type,
    coalesce(
      nullif(trim(payment.reference_number), ''),
      av.voucher_number
    )
  from public.bank_reconciliation_matches brm
  join public.bank_statement_lines bsl
    on bsl.id = brm.statement_line_id
  join public.accounting_entries ae
    on ae.id = brm.accounting_entry_id
  join public.accounting_vouchers av
    on av.id = ae.voucher_id
  left join public.payments payment
    on av.source_type = 'payment'
   and payment.id = av.source_id
  where brm.company_id = p_company_id
    and brm.bank_account_id = p_bank_account_id
    and bsl.transaction_date between p_from_date and p_to_date
  order by bsl.transaction_date, brm.matched_at, brm.id;
end;
$function$;

create or replace function public.unmatch_bank_reconciliation(
  p_company_id uuid,
  p_match_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if auth.uid() is null then
    raise exception 'Please sign in before removing a reconciliation match.';
  end if;

  if not public.has_any_company_permission(
    p_company_id,
    '{accounting.view}'::text[],
    auth.uid()
  ) then
    raise exception 'You do not have access to reconcile this company.';
  end if;

  delete from public.bank_reconciliation_matches
  where id = p_match_id
    and company_id = p_company_id;

  if not found then
    raise exception 'Reconciliation match was not found.';
  end if;

  return true;
end;
$function$;

create or replace function public.delete_bank_statement_import(
  p_company_id uuid,
  p_import_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if auth.uid() is null then
    raise exception 'Please sign in before deleting an imported statement.';
  end if;

  if not public.has_any_company_permission(
    p_company_id,
    '{accounting.view}'::text[],
    auth.uid()
  ) then
    raise exception 'You do not have access to reconcile this company.';
  end if;

  delete from public.bank_statement_imports
  where id = p_import_id
    and company_id = p_company_id;

  if not found then
    raise exception 'Imported statement was not found.';
  end if;

  return true;
end;
$function$;

revoke all on function public.get_bank_reconciliation_accounts(uuid, date) from public;
revoke all on function public.import_bank_statement(uuid, uuid, text, numeric, numeric, jsonb) from public;
revoke all on function public.get_bank_statement_imports(uuid, uuid) from public;
revoke all on function public.get_bank_statement_lines(uuid, uuid, date, date, uuid) from public;
revoke all on function public.get_bank_book_reconciliation_entries(uuid, uuid, date, date) from public;
revoke all on function public.match_bank_reconciliation(uuid, uuid, uuid, numeric) from public;
revoke all on function public.auto_match_bank_reconciliation(uuid, uuid, date, date, integer) from public;
revoke all on function public.get_bank_reconciliation_matches(uuid, uuid, date, date) from public;
revoke all on function public.unmatch_bank_reconciliation(uuid, uuid) from public;
revoke all on function public.delete_bank_statement_import(uuid, uuid) from public;

grant execute on function public.get_bank_reconciliation_accounts(uuid, date) to authenticated;
grant execute on function public.import_bank_statement(uuid, uuid, text, numeric, numeric, jsonb) to authenticated;
grant execute on function public.get_bank_statement_imports(uuid, uuid) to authenticated;
grant execute on function public.get_bank_statement_lines(uuid, uuid, date, date, uuid) to authenticated;
grant execute on function public.get_bank_book_reconciliation_entries(uuid, uuid, date, date) to authenticated;
grant execute on function public.match_bank_reconciliation(uuid, uuid, uuid, numeric) to authenticated;
grant execute on function public.auto_match_bank_reconciliation(uuid, uuid, date, date, integer) to authenticated;
grant execute on function public.get_bank_reconciliation_matches(uuid, uuid, date, date) to authenticated;
grant execute on function public.unmatch_bank_reconciliation(uuid, uuid) to authenticated;
grant execute on function public.delete_bank_statement_import(uuid, uuid) to authenticated;

commit;

notify pgrst, 'reload schema';

select
  to_regprocedure(
    'public.import_bank_statement(uuid,uuid,text,numeric,numeric,jsonb)'
  ) as import_function,
  to_regprocedure(
    'public.auto_match_bank_reconciliation(uuid,uuid,date,date,integer)'
  ) as auto_match_function,
  to_regclass('public.bank_statement_lines') as statement_lines_table,
  to_regclass('public.bank_reconciliation_matches') as matches_table;