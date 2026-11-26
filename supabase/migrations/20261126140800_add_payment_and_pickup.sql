begin;

alter table public.products
  drop constraint if exists products_category_check;

alter table public.products
  add constraint products_category_check
  check (category in (
    'satin',
    'money',
    'artificial',
    'romantis',
    'selamat',
    'sederhana'
  ));

alter table public.orders
  add column if not exists fulfillment_method text not null default 'delivery'
  check (fulfillment_method in ('delivery', 'pickup'));

alter table public.orders
  add column if not exists payment_method text
  check (payment_method is null or payment_method in ('qris', 'cash'));

create or replace function public.place_order_with_options(
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_delivery_address text,
  p_notes text,
  p_items jsonb,
  p_fulfillment_method text,
  p_payment_method text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_order_id uuid;
begin
  if p_fulfillment_method is null
    or p_fulfillment_method not in ('delivery', 'pickup') then
    raise exception using errcode = '22023', message = 'Metode penerimaan pesanan tidak valid.';
  end if;

  if p_payment_method is null
    or p_payment_method not in ('qris', 'cash') then
    raise exception using errcode = '22023', message = 'Metode pembayaran tidak valid.';
  end if;

  if p_payment_method = 'cash' and p_fulfillment_method <> 'pickup' then
    raise exception using errcode = '22023', message = 'Pembayaran tunai hanya tersedia untuk ambil sendiri.';
  end if;

  select public.place_order(
    p_customer_name,
    p_customer_phone,
    p_customer_email,
    p_delivery_address,
    p_notes,
    p_items
  ) into new_order_id;

  update public.orders
  set fulfillment_method = p_fulfillment_method,
      payment_method = p_payment_method
  where id = new_order_id;

  return new_order_id;
end;
$$;

revoke all on function public.place_order_with_options(text, text, text, text, text, jsonb, text, text) from public;
grant execute on function public.place_order_with_options(text, text, text, text, text, jsonb, text, text) to anon, authenticated;

commit;
