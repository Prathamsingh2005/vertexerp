-- VertexERP Cash & Bank Book
-- Run once in Supabase SQL Editor.

begin;

create or replace function public.get_cash_bank_accounts(
  p_company_id uuid,
  p_as_on_date date default current_date
)
returns table (
  account_id uuid,
  account_code text,
  account_name text,
  system_key text,
  closing_debit numeric,
  closing_credit numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
begin
  if auth.uid() is null then
    raise exception 'Please sign in before viewing Cash & Bank Book.';
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
      coalesce(sum(ae.debit), 0)::numeric as total_debit,
      coalesce(sum(ae.credit), 0)::numeric as total_credit
    from public.accounting_vouchers av
    join public.accounting_entries ae
      on ae.voucher_id = av.id
    where av.company_id = p_company_id
      and av.status = 'POSTED'
      and av.voucher_date <= coalesce(p_as_on_date, current_date)
    group by ae.account_id
  )
  select
    coa.id,
    coa.code,
    coa.name,
    coa.system_key,
    greatest(
      coalesce(b.total_debit, 0) - coalesce(b.total_credit, 0),
      0
    )::numeric as closing_debit,
    greatest(
      coalesce(b.total_credit, 0) - coalesce(b.total_debit, 0),
      0
    )::numeric as closing_credit
  from public.chart_of_accounts coa
  left join balances b
    on b.account_id = coa.id
  where coa.company_id = p_company_id
    and coa.is_active = true
    and coa.system_key in ('cash', 'bank')
  order by
    case coa.system_key
      when 'cash' then 1
      when 'bank' then 2
      else 3
    end,
    coa.code,
    coa.name;
end;
$function$;

create or replace function public.get_cash_bank_book(
  p_company_id uuid,
  p_account_id uuid,
  p_from_date date,
  p_to_date date
)
returns table (
  row_type text,
  entry_id uuid,
  voucher_id uuid,
  voucher_date date,
  voucher_number text,
  voucher_type text,
  source_type text,
  narration text,
  line_description text,
  counterpart_accounts text,
  debit numeric,
  credit numeric,
  running_balance numeric,
  balance_side text,
  row_order bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_opening_balance numeric := 0;
begin
  if auth.uid() is null then
    raise exception 'Please sign in before viewing Cash & Bank Book.';
  end if;

  if not public.has_any_company_permission(
    p_company_id,
    '{accounting.view}'::text[],
    auth.uid()
  ) then
    raise exception 'You do not have access to this company accounting report.';
  end if;

  if p_account_id is null then
    raise exception 'Please select a Cash or Bank account.';
  end if;

  if p_from_date is null or p_to_date is null then
    raise exception 'From Date and To Date are required.';
  end if;

  if p_from_date > p_to_date then
    raise exception 'From Date cannot be later than To Date.';
  end if;

  if not exists (
    select 1
    from public.chart_of_accounts coa
    where coa.id = p_account_id
      and coa.company_id = p_company_id
      and coa.is_active = true
      and coa.system_key in ('cash', 'bank')
  ) then
    raise exception 'Selected account is not an active Cash or Bank account.';
  end if;

  select
    coalesce(sum(ae.debit - ae.credit), 0)::numeric
  into v_opening_balance
  from public.accounting_vouchers av
  join public.accounting_entries ae
    on ae.voucher_id = av.id
  where av.company_id = p_company_id
    and av.status = 'POSTED'
    and ae.account_id = p_account_id
    and av.voucher_date < p_from_date;

  return query
  with period_entries as (
    select
      ae.id as entry_id,
      av.id as voucher_id,
      av.voucher_date,
      av.voucher_number,
      av.voucher_type,
      av.source_type,
      av.narration,
      ae.description as line_description,
      coalesce(counterparts.counterpart_accounts, '—') as counterpart_accounts,
      coalesce(ae.debit, 0)::numeric as debit,
      coalesce(ae.credit, 0)::numeric as credit,
      row_number() over (
        order by
          av.voucher_date,
          av.created_at,
          av.id,
          ae.line_number,
          ae.id
      )::bigint as row_order
    from public.accounting_vouchers av
    join public.accounting_entries ae
      on ae.voucher_id = av.id
    left join lateral (
      select
        string_agg(
          distinct coa2.name,
          ', '
          order by coa2.name
        ) as counterpart_accounts
      from public.accounting_entries ae2
      join public.chart_of_accounts coa2
        on coa2.id = ae2.account_id
      where ae2.voucher_id = av.id
        and ae2.id <> ae.id
    ) counterparts on true
    where av.company_id = p_company_id
      and av.status = 'POSTED'
      and ae.account_id = p_account_id
      and av.voucher_date between p_from_date and p_to_date
  ),
  calculated as (
    select
      pe.*,
      (
        v_opening_balance
        + sum(pe.debit - pe.credit) over (
            order by pe.row_order
            rows between unbounded preceding and current row
          )
      )::numeric as signed_running_balance
    from period_entries pe
  )
  select
    'OPENING'::text as row_type,
    null::uuid as entry_id,
    null::uuid as voucher_id,
    p_from_date as voucher_date,
    'OPENING'::text as voucher_number,
    'OPENING'::text as voucher_type,
    'opening_balance'::text as source_type,
    'Opening Balance'::text as narration,
    'Balance brought forward'::text as line_description,
    '—'::text as counterpart_accounts,
    greatest(v_opening_balance, 0)::numeric as debit,
    greatest(-v_opening_balance, 0)::numeric as credit,
    abs(v_opening_balance)::numeric as running_balance,
    case
      when v_opening_balance < 0 then 'Cr'
      else 'Dr'
    end::text as balance_side,
    0::bigint as row_order

  union all

  select
    'ENTRY'::text as row_type,
    c.entry_id,
    c.voucher_id,
    c.voucher_date,
    c.voucher_number,
    c.voucher_type,
    c.source_type,
    c.narration,
    c.line_description,
    c.counterpart_accounts,
    c.debit,
    c.credit,
    abs(c.signed_running_balance)::numeric as running_balance,
    case
      when c.signed_running_balance < 0 then 'Cr'
      else 'Dr'
    end::text as balance_side,
    c.row_order
  from calculated c

  order by row_order;
end;
$function$;

revoke all on function public.get_cash_bank_accounts(uuid, date) from public;
revoke all on function public.get_cash_bank_book(uuid, uuid, date, date) from public;

grant execute on function public.get_cash_bank_accounts(uuid, date)
to authenticated;

grant execute on function public.get_cash_bank_book(uuid, uuid, date, date)
to authenticated;

commit;

notify pgrst, 'reload schema';

-- Verification
select
  to_regprocedure('public.get_cash_bank_accounts(uuid,date)')
    as accounts_function,
  to_regprocedure('public.get_cash_bank_book(uuid,uuid,date,date)')
    as book_function,
  has_function_privilege(
    'authenticated',
    'public.get_cash_bank_accounts(uuid,date)',
    'EXECUTE'
  ) as can_execute_accounts,
  has_function_privilege(
    'authenticated',
    'public.get_cash_bank_book(uuid,uuid,date,date)',
    'EXECUTE'
  ) as can_execute_book;