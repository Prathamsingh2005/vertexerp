-- VertexERP Outstanding Aging Report
-- Document-date aging with FIFO settlement of party-level payments.
-- Run once in Supabase SQL Editor.

begin;

create or replace function public.get_outstanding_aging(
  p_company_id uuid,
  p_party_type text,
  p_as_on_date date default current_date
)
returns table (
  row_id text,
  party_id uuid,
  party_name text,
  party_type text,
  document_id uuid,
  document_type text,
  document_number text,
  document_date date,
  original_amount numeric,
  return_adjustment numeric,
  net_document_amount numeric,
  fifo_settled_amount numeric,
  outstanding_amount numeric,
  age_days integer,
  aging_bucket text,
  sort_order bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_payment_type text;
begin
  if auth.uid() is null then
    raise exception 'Please sign in before viewing Outstanding Aging.';
  end if;

  if not public.has_any_company_permission(
    p_company_id,
    '{outstanding.view}'::text[],
    auth.uid()
  ) then
    raise exception 'You do not have access to this company outstanding report.';
  end if;

  if p_party_type not in ('Customer', 'Supplier') then
    raise exception 'Party Type must be Customer or Supplier.';
  end if;

  if p_as_on_date is null then
    raise exception 'As On Date is required.';
  end if;

  v_payment_type :=
    case
      when p_party_type = 'Customer' then 'Customer Receipt'
      else 'Supplier Payment'
    end;

  return query
  with party_master as (
    select
      l.id as party_id,
      l.name as party_name,
      l.ledger_type as party_type,
      round(coalesce(l.opening_balance, 0), 2)::numeric
        as opening_balance,
      coalesce(
        l.opening_balance_side,
        case
          when l.ledger_type = 'Supplier' then 'Credit'
          else 'Debit'
        end
      ) as opening_balance_side,
      coalesce(l.opening_balance_date, p_as_on_date) as opening_balance_date
    from public.ledgers l
    where l.company_id = p_company_id
      and l.ledger_type = p_party_type
  ),
  opening_documents as (
    select
      'opening:' || pm.party_id::text as row_id,
      pm.party_id,
      pm.party_name,
      pm.party_type,
      null::uuid as document_id,
      'Opening Balance'::text as document_type,
      'OPENING'::text as document_number,
      pm.opening_balance_date as document_date,
      pm.opening_balance as original_amount,
      0::numeric as return_adjustment,
      pm.opening_balance as net_document_amount,
      0::integer as document_priority
    from party_master pm
    where pm.opening_balance > 0
      and pm.opening_balance_date <= p_as_on_date
      and (
        (pm.party_type = 'Customer'
          and pm.opening_balance_side = 'Debit')
        or
        (pm.party_type = 'Supplier'
          and pm.opening_balance_side = 'Credit')
      )
  ),
  customer_documents as (
    select
      'sale:' || s.id::text as row_id,
      pm.party_id,
      pm.party_name,
      pm.party_type,
      s.id as document_id,
      'Sales Invoice'::text as document_type,
      coalesce(nullif(trim(s.invoice_number), ''), s.id::text)
        as document_number,
      s.invoice_date as document_date,
      round(coalesce(s.grand_total, 0), 2)::numeric
        as original_amount,
      least(
        round(coalesce(s.grand_total, 0), 2),
        round(coalesce(cn.total_credit_notes, 0), 2)
      )::numeric as return_adjustment,
      greatest(
        0,
        round(coalesce(s.grand_total, 0), 2)
        - round(coalesce(cn.total_credit_notes, 0), 2)
      )::numeric as net_document_amount,
      1::integer as document_priority
    from public.sales s
    join party_master pm
      on pm.party_id = s.customer_id
    left join lateral (
      select
        coalesce(sum(note.grand_total), 0)::numeric
          as total_credit_notes
      from public.credit_notes note
      where note.company_id = p_company_id
        and note.source_sale_id = s.id
        and note.status = 'POSTED'
        and note.credit_note_date <= p_as_on_date
    ) cn on true
    where p_party_type = 'Customer'
      and s.company_id = p_company_id
      and s.invoice_date <= p_as_on_date
      and lower(trim(coalesce(s.payment_mode, ''))) = 'credit'
  ),
  supplier_documents as (
    select
      'purchase:' || p.id::text as row_id,
      pm.party_id,
      pm.party_name,
      pm.party_type,
      p.id as document_id,
      'Purchase Bill'::text as document_type,
      coalesce(nullif(trim(p.bill_number), ''), p.id::text)
        as document_number,
      p.purchase_date as document_date,
      round(coalesce(p.grand_total, 0), 2)::numeric
        as original_amount,
      least(
        round(coalesce(p.grand_total, 0), 2),
        round(coalesce(dn.total_debit_notes, 0), 2)
      )::numeric as return_adjustment,
      greatest(
        0,
        round(coalesce(p.grand_total, 0), 2)
        - round(coalesce(dn.total_debit_notes, 0), 2)
      )::numeric as net_document_amount,
      1::integer as document_priority
    from public.purchases p
    join party_master pm
      on pm.party_id = p.supplier_id
    left join lateral (
      select
        coalesce(sum(note.grand_total), 0)::numeric
          as total_debit_notes
      from public.debit_notes note
      where note.company_id = p_company_id
        and note.source_purchase_id = p.id
        and note.status = 'POSTED'
        and note.debit_note_date <= p_as_on_date
    ) dn on true
    where p_party_type = 'Supplier'
      and p.company_id = p_company_id
      and p.purchase_date <= p_as_on_date
      and lower(trim(coalesce(p.payment_mode, ''))) = 'credit'
  ),
  all_documents as (
    select * from opening_documents
    union all
    select * from customer_documents
    union all
    select * from supplier_documents
  ),
  party_payments as (
    select
      pm.party_id,
      (
        coalesce(pay.total_payments, 0)
        +
        case
          when pm.opening_balance_date <= p_as_on_date
           and (
             (pm.party_type = 'Customer'
               and pm.opening_balance_side = 'Credit')
             or
             (pm.party_type = 'Supplier'
               and pm.opening_balance_side = 'Debit')
           )
          then pm.opening_balance
          else 0
        end
      )::numeric as settlement_available
    from party_master pm
    left join lateral (
      select
        coalesce(sum(payment.amount), 0)::numeric
          as total_payments
      from public.payments payment
      where payment.company_id = p_company_id
        and payment.party_id = pm.party_id
        and payment.payment_type = v_payment_type
        and payment.payment_date <= p_as_on_date
    ) pay on true
  ),
  ordered_documents as (
    select
      doc.*,
      coalesce(pp.settlement_available, 0)::numeric
        as settlement_available,
      coalesce(
        sum(doc.net_document_amount) over (
          partition by doc.party_id
          order by
            doc.document_date,
            doc.document_priority,
            doc.document_number,
            doc.row_id
          rows between unbounded preceding and 1 preceding
        ),
        0
      )::numeric as cumulative_due_before,
      row_number() over (
        order by
          doc.party_name,
          doc.document_date,
          doc.document_priority,
          doc.document_number,
          doc.row_id
      )::bigint as sort_order
    from all_documents doc
    left join party_payments pp
      on pp.party_id = doc.party_id
    where doc.net_document_amount > 0
  ),
  allocated_documents as (
    select
      ordered.*,
      least(
        ordered.net_document_amount,
        greatest(
          0,
          ordered.settlement_available
          - ordered.cumulative_due_before
        )
      )::numeric as fifo_settled_amount
    from ordered_documents ordered
  ),
  pending_documents as (
    select
      allocated.*,
      greatest(
        0,
        allocated.net_document_amount
        - allocated.fifo_settled_amount
      )::numeric as outstanding_amount
    from allocated_documents allocated
  )
  select
    pending.row_id,
    pending.party_id,
    pending.party_name,
    pending.party_type,
    pending.document_id,
    pending.document_type,
    pending.document_number,
    pending.document_date,
    round(pending.original_amount, 2),
    round(pending.return_adjustment, 2),
    round(pending.net_document_amount, 2),
    round(pending.fifo_settled_amount, 2),
    round(pending.outstanding_amount, 2),
    greatest(0, p_as_on_date - pending.document_date)::integer
      as age_days,
    case
      when greatest(0, p_as_on_date - pending.document_date) <= 30
        then '0-30 Days'
      when greatest(0, p_as_on_date - pending.document_date) <= 60
        then '31-60 Days'
      when greatest(0, p_as_on_date - pending.document_date) <= 90
        then '61-90 Days'
      else '90+ Days'
    end::text as aging_bucket,
    pending.sort_order
  from pending_documents pending
  where pending.outstanding_amount >= 0.005
  order by
    pending.party_name,
    pending.document_date,
    pending.sort_order;
end;
$function$;

revoke all on function public.get_outstanding_aging(uuid, text, date)
from public;

grant execute on function public.get_outstanding_aging(uuid, text, date)
to authenticated;

commit;

notify pgrst, 'reload schema';

-- Verification
select
  to_regprocedure(
    'public.get_outstanding_aging(uuid,text,date)'
  ) as aging_function,
  has_function_privilege(
    'authenticated',
    'public.get_outstanding_aging(uuid,text,date)',
    'EXECUTE'
  ) as authenticated_can_execute;