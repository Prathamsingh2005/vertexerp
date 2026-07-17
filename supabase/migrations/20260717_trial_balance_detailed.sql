-- VertexERP Detailed Trial Balance
-- This migration creates opening, period and closing Trial Balance reporting.
-- The user has already run this migration in Supabase on 17 July 2026.

begin;

create or replace function public.get_trial_balance_detailed(
  p_company_id uuid,
  p_from_date date default null,
  p_to_date date default null
)
returns table (
  account_id uuid,
  account_code text,
  account_name text,
  account_type text,
  normal_balance text,
  opening_debit numeric,
  opening_credit numeric,
  period_debit numeric,
  period_credit numeric,
  closing_debit numeric,
  closing_credit numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if auth.uid() is null then
    raise exception 'Please sign in before viewing accounting reports.';
  end if;

  if not public.has_any_company_permission(
    p_company_id,
    '{accounting.view}'::text[],
    auth.uid()
  ) then
    raise exception 'You do not have access to this company.';
  end if;

  if p_from_date is not null
     and p_to_date is not null
     and p_from_date > p_to_date then
    raise exception 'Start date cannot be after end date.';
  end if;

  return query
  with account_totals as (
    select
      ae.account_id,
      coalesce(
        sum(
          case
            when p_from_date is not null
             and av.voucher_date < p_from_date
              then ae.debit
            else 0
          end
        ),
        0
      )::numeric as opening_debit_total,
      coalesce(
        sum(
          case
            when p_from_date is not null
             and av.voucher_date < p_from_date
              then ae.credit
            else 0
          end
        ),
        0
      )::numeric as opening_credit_total,
      coalesce(
        sum(
          case
            when (p_from_date is null or av.voucher_date >= p_from_date)
             and (p_to_date is null or av.voucher_date <= p_to_date)
              then ae.debit
            else 0
          end
        ),
        0
      )::numeric as period_debit_total,
      coalesce(
        sum(
          case
            when (p_from_date is null or av.voucher_date >= p_from_date)
             and (p_to_date is null or av.voucher_date <= p_to_date)
              then ae.credit
            else 0
          end
        ),
        0
      )::numeric as period_credit_total
    from public.accounting_vouchers av
    join public.accounting_entries ae
      on ae.voucher_id = av.id
    where av.company_id = p_company_id
      and av.status = 'POSTED'
      and (p_to_date is null or av.voucher_date <= p_to_date)
    group by ae.account_id
  ),
  balances as (
    select
      coa.id,
      coa.code,
      coa.name,
      coa.account_type,
      coa.normal_balance,
      coalesce(at.opening_debit_total, 0)::numeric as opening_debit_total,
      coalesce(at.opening_credit_total, 0)::numeric as opening_credit_total,
      coalesce(at.period_debit_total, 0)::numeric as period_debit_total,
      coalesce(at.period_credit_total, 0)::numeric as period_credit_total
    from public.chart_of_accounts coa
    left join account_totals at
      on at.account_id = coa.id
    where coa.company_id = p_company_id
      and coa.is_active = true
  )
  select
    b.id,
    b.code,
    b.name,
    b.account_type,
    b.normal_balance,
    round(greatest(b.opening_debit_total - b.opening_credit_total, 0), 2),
    round(greatest(b.opening_credit_total - b.opening_debit_total, 0), 2),
    round(b.period_debit_total, 2),
    round(b.period_credit_total, 2),
    round(
      greatest(
        (b.opening_debit_total + b.period_debit_total) -
        (b.opening_credit_total + b.period_credit_total),
        0
      ),
      2
    ),
    round(
      greatest(
        (b.opening_credit_total + b.period_credit_total) -
        (b.opening_debit_total + b.period_debit_total),
        0
      ),
      2
    )
  from balances b
  where b.opening_debit_total <> 0
     or b.opening_credit_total <> 0
     or b.period_debit_total <> 0
     or b.period_credit_total <> 0
  order by b.code;
end;
$function$;

create or replace function public.get_trial_balance(
  p_company_id uuid,
  p_from_date date default null,
  p_to_date date default null
)
returns table (
  account_id uuid,
  account_code text,
  account_name text,
  account_type text,
  normal_balance text,
  total_debit numeric,
  total_credit numeric,
  closing_debit numeric,
  closing_credit numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  return query
  select
    tb.account_id,
    tb.account_code,
    tb.account_name,
    tb.account_type,
    tb.normal_balance,
    round(tb.opening_debit + tb.period_debit, 2),
    round(tb.opening_credit + tb.period_credit, 2),
    tb.closing_debit,
    tb.closing_credit
  from public.get_trial_balance_detailed(
    p_company_id,
    p_from_date,
    p_to_date
  ) tb;
end;
$function$;

revoke all on function public.get_trial_balance_detailed(uuid, date, date)
from public;
grant execute on function public.get_trial_balance_detailed(uuid, date, date)
to authenticated;

revoke all on function public.get_trial_balance(uuid, date, date)
from public;
grant execute on function public.get_trial_balance(uuid, date, date)
to authenticated;

commit;