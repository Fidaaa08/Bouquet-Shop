create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  category text not null check (category in ('satin', 'money', 'artificial')),
  description text not null default '' check (char_length(description) <= 1000),
  price integer not null check (price > 0),
  image_url text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null check (char_length(btrim(customer_name)) between 1 and 100),
  customer_phone text not null check (char_length(btrim(customer_phone)) between 6 and 30),
  customer_email text check (customer_email is null or char_length(customer_email) <= 254),
  delivery_address text not null check (char_length(btrim(delivery_address)) between 5 and 500),
  fulfillment_method text not null default 'delivery'
    check (fulfillment_method in ('delivery', 'pickup')),
  payment_method text
    check (payment_method is null or payment_method in ('qris', 'cash')),
  notes text not null default '' check (char_length(notes) <= 1000),
  total_amount bigint not null check (total_amount > 0),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name_snapshot text not null,
  unit_price integer not null check (unit_price > 0),
  quantity integer not null check (quantity between 1 and 10)
);

create index if not exists products_active_created_at_idx
  on public.products (active, created_at desc);
create index if not exists orders_created_at_idx
  on public.orders (created_at desc);
create index if not exists order_items_order_id_idx
  on public.order_items (order_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.products enable row level security;
alter table public.admin_users enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Anyone can view active products" on public.products;
create policy "Anyone can view active products"
  on public.products for select
  to anon, authenticated
  using (active = true);

drop policy if exists "Admins can manage products" on public.products;
create policy "Admins can manage products"
  on public.products for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can view their own admin record" on public.admin_users;
create policy "Admins can view their own admin record"
  on public.admin_users for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Admins can view orders" on public.orders;
create policy "Admins can view orders"
  on public.orders for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can update order status" on public.orders;
create policy "Admins can update order status"
  on public.orders for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can view order items" on public.order_items;
create policy "Admins can view order items"
  on public.order_items for select
  to authenticated
  using (public.is_admin());

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant select on public.admin_users to authenticated;
grant select on public.orders to authenticated;
grant update (status) on public.orders to authenticated;
grant select on public.order_items to authenticated;

drop function if exists public.place_order(text, text, text, text, jsonb);

create or replace function public.place_order(
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_delivery_address text,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  item jsonb;
  product_id_value uuid;
  product_name text;
  product_price integer;
  item_quantity integer;
  calculated_total bigint := 0;
  new_order_id uuid;
  item_count integer;
begin
  if p_customer_name is null or char_length(btrim(p_customer_name)) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Nama harus diisi (maksimal 100 karakter).';
  end if;

  if p_customer_phone is null or char_length(btrim(p_customer_phone)) not between 6 and 30 then
    raise exception using errcode = '22023', message = 'Nomor WhatsApp tidak valid.';
  end if;

  if p_customer_email is not null and char_length(p_customer_email) > 254 then
    raise exception using errcode = '22023', message = 'Email terlalu panjang.';
  end if;
  if nullif(btrim(coalesce(p_customer_email, '')), '') is not null
    and btrim(p_customer_email) !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception using errcode = '22023', message = 'Format email tidak valid.';
  end if;

  if p_delivery_address is null
    or char_length(btrim(p_delivery_address)) not between 5 and 500 then
    raise exception using errcode = '22023', message = 'Alamat pengiriman harus diisi (maksimal 500 karakter).';
  end if;

  if p_notes is not null and char_length(p_notes) > 1000 then
    raise exception using errcode = '22023', message = 'Catatan terlalu panjang.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception using errcode = '22023', message = 'Daftar produk tidak valid.';
  end if;

  item_count := jsonb_array_length(p_items);
  if item_count < 1 or item_count > 20 then
    raise exception using errcode = '22023', message = 'Pesanan harus berisi 1 sampai 20 jenis produk.';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(item) <> 'object'
      or coalesce(item->>'product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(item->>'quantity', '') !~ '^[0-9]+$' then
      raise exception using errcode = '22023', message = 'Detail produk tidak valid.';
    end if;

    product_id_value := (item->>'product_id')::uuid;
    item_quantity := (item->>'quantity')::integer;
    if item_quantity < 1 or item_quantity > 10 then
      raise exception using errcode = '22023', message = 'Jumlah tiap produk harus 1 sampai 10.';
    end if;

    select name, price into product_name, product_price
      from public.products
      where id = product_id_value and active = true
      for share;
    if not found then
      raise exception using errcode = '22023', message = 'Salah satu produk sudah tidak tersedia.';
    end if;

    calculated_total := calculated_total + (product_price::bigint * item_quantity);
  end loop;

  insert into public.orders (
    customer_name, customer_phone, customer_email, delivery_address, notes, total_amount
  )
  values (
    btrim(p_customer_name),
    btrim(p_customer_phone),
    nullif(btrim(coalesce(p_customer_email, '')), ''),
    btrim(p_delivery_address),
    coalesce(p_notes, ''),
    calculated_total
  )
  returning id into new_order_id;

  for item in select value from jsonb_array_elements(p_items)
  loop
    product_id_value := (item->>'product_id')::uuid;
    item_quantity := (item->>'quantity')::integer;

    select name, price into product_name, product_price
      from public.products
      where id = product_id_value and active = true;

    insert into public.order_items (
      order_id, product_id, name_snapshot, unit_price, quantity
    )
    values (
      new_order_id, product_id_value, product_name, product_price, item_quantity
    );
  end loop;

  return new_order_id;
end;
$$;

revoke all on function public.place_order(text, text, text, text, text, jsonb) from public;
grant execute on function public.place_order(text, text, text, text, text, jsonb) to anon, authenticated;

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Anyone can view product images" on storage.objects;
create policy "Anyone can view product images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Admins can update product images" on storage.objects;
create policy "Admins can update product images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Admins can delete product images" on storage.objects;
create policy "Admins can delete product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
