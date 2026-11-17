create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin','kitchen')),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('Pizzas','Hamburguesas','Empanadas','Bebidas','Combos')),
  description text not null default '',
  price integer not null check (price >= 0),
  image_url text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  fee integer not null default 0 check (fee >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id integer primary key default 1 check (id = 1),
  brand_name text not null default 'GUSTO URBANO',
  tagline text not null default 'El sabor que mueve la ciudad.',
  prex_holder text not null default '',
  prex_alias text not null default '',
  prex_account text not null default '',
  prex_instructions text not null default 'Realizá la transferencia y adjuntá el comprobante.',
  whatsapp text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity,
  customer_name text not null,
  customer_phone text not null,
  address text not null,
  neighborhood text not null,
  notes text not null default '',
  items jsonb not null,
  subtotal integer not null check (subtotal >= 0),
  delivery_fee integer not null check (delivery_fee >= 0),
  total integer not null check (total >= 0),
  payment_method text not null default 'prex_transfer',
  payment_status text not null default 'payment_pending' check (payment_status in ('payment_pending','paid','rejected')),
  payment_proof text not null default '',
  status text not null default 'pending' check (status in ('pending','confirmed','preparing','ready','on_delivery','delivered','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.settings (id) values (1) on conflict (id) do nothing;

insert into public.delivery_zones (name, fee) values
('Centro', 100), ('Cordón', 110), ('Pocitos', 140), ('Unión', 150),
('Prado', 150), ('Carrasco', 220), ('Otras zonas', 200)
on conflict (name) do nothing;

insert into public.products (name,category,description,price) values
('Pizza muzzarella','Pizzas','Muzzarella, salsa de tomate y orégano.',420),
('Pizza con pepperoni','Pizzas','Muzzarella y pepperoni.',520),
('Hamburguesa clásica','Hamburguesas','Carne, cheddar, lechuga, tomate y salsa.',390),
('Doble cheeseburger','Hamburguesas','Doble carne, doble cheddar y salsa especial.',520),
('Empanada de carne','Empanadas','Empanada al horno rellena de carne.',95),
('Empanada de jamón y queso','Empanadas','Jamón y queso.',95)
on conflict do nothing;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','kitchen'));
$$;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.settings enable row level security;
alter table public.orders enable row level security;

drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read" on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff());

drop policy if exists "products public read active" on public.products;
create policy "products public read active" on public.products for select to anon, authenticated using (active = true or public.is_staff());
drop policy if exists "products staff manage" on public.products;
create policy "products staff manage" on public.products for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "zones public read active" on public.delivery_zones;
create policy "zones public read active" on public.delivery_zones for select to anon, authenticated using (active = true or public.is_staff());
drop policy if exists "zones staff manage" on public.delivery_zones;
create policy "zones staff manage" on public.delivery_zones for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "settings public read" on public.settings;
create policy "settings public read" on public.settings for select to anon, authenticated using (true);
drop policy if exists "settings staff update" on public.settings;
create policy "settings staff update" on public.settings for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "orders public create" on public.orders;
create policy "orders public create" on public.orders for insert to anon, authenticated with check (
  customer_name <> '' and customer_phone <> '' and address <> '' and neighborhood <> ''
  and subtotal >= 0 and delivery_fee >= 0 and total = subtotal + delivery_fee
  and payment_method = 'prex_transfer' and payment_status = 'payment_pending'
  and status = 'pending'
);
drop policy if exists "orders staff read" on public.orders;
create policy "orders staff read" on public.orders for select to authenticated using (public.is_staff());
drop policy if exists "orders staff update" on public.orders;
create policy "orders staff update" on public.orders for update to authenticated using (public.is_staff()) with check (public.is_staff());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs','payment-proofs',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

drop policy if exists "proof upload public" on storage.objects;
create policy "proof upload public" on storage.objects for insert to anon, authenticated
with check (bucket_id = 'payment-proofs');
drop policy if exists "proof staff read" on storage.objects;
create policy "proof staff read" on storage.objects for select to authenticated
using (bucket_id = 'payment-proofs' and public.is_staff());
