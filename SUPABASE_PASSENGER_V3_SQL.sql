-- VUELO PASSENGER V3 - SQL + SEGURIDAD

-- WhatsApp en perfiles
alter table profiles
add column if not exists phone text;

-- Trigger de registro seguro para guardar nombre, correo, whatsapp y rol passenger
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    id,
    full_name,
    email,
    phone,
    role,
    city,
    is_active
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'Usuario Vuelo'),
    new.email,
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce((new.raw_user_meta_data->>'role')::text, 'passenger'),
    'Ometepe',
    true
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    phone = excluded.phone,
    role = excluded.role,
    city = excluded.city,
    is_active = excluded.is_active;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- Espacio para vender publicidad de negocios desde Supabase
create table if not exists platform_ads (
  id uuid primary key default gen_random_uuid(),
  placement text default 'passenger_home',
  sponsor_name text,
  title text not null,
  description text,
  image_url text,
  cta_text text default 'Ver más',
  cta_url text,
  price numeric(10,2),
  currency text default 'NIO',
  paid boolean default false,
  starts_at date,
  ends_at date,
  is_active boolean default false,
  created_at timestamptz default now()
);

alter table platform_ads enable row level security;

drop policy if exists "Anyone can read active ads" on platform_ads;
create policy "Anyone can read active ads"
on platform_ads
for select
using (
  is_active = true
  and placement = 'passenger_home'
  and (starts_at is null or starts_at <= current_date)
  and (ends_at is null or ends_at >= current_date)
);

-- Solo admins pueden gestionar anuncios desde panel/futuro superadmin
drop policy if exists "Admins can manage platform ads" on platform_ads;
create policy "Admins can manage platform ads"
on platform_ads
for all
to authenticated
using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid()
    and profiles.role in ('super_admin','admin','operations')
  )
)
with check (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid()
    and profiles.role in ('super_admin','admin','operations')
  )
);

-- Tiempo aproximado de llegada en ofertas
alter table ride_offers
add column if not exists estimated_arrival_minutes int;

-- Configuración comunitaria y comisión 0%
create table if not exists platform_settings (
    id integer primary key default 1,
    commission_rate numeric(5,2) default 0,
    launch_mode boolean default true,
    donations_enabled boolean default false,
    donation_url text,
    donation_message text,
    community_message text,
    driver_message text,
    passenger_message text,
    updated_at timestamptz default now()
);

alter table platform_settings enable row level security;

drop policy if exists "Anyone can read platform settings" on platform_settings;
create policy "Anyone can read platform settings"
on platform_settings
for select
using (true);

drop policy if exists "Admins can manage platform settings" on platform_settings;
create policy "Admins can manage platform settings"
on platform_settings
for all
to authenticated
using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid()
    and profiles.role in ('super_admin','admin','operations')
  )
)
with check (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid()
    and profiles.role in ('super_admin','admin','operations')
  )
);

insert into platform_settings (
    id,
    commission_rate,
    launch_mode,
    donations_enabled,
    donation_message,
    community_message,
    driver_message,
    passenger_message
)
values (
    1,
    0,
    true,
    false,
    'Próximamente podrás apoyar voluntariamente el crecimiento de Vuelo mediante donaciones. Ninguna donación será obligatoria para utilizar la plataforma.',
    'Vuelo nace en Ometepe con el objetivo de apoyar a nuestra comunidad y ofrecer una alternativa de movilidad accesible para todos. Durante esta etapa inicial mantenemos una comisión del 0% para que utilizar la plataforma siga siendo económico para pasajeros, mientras aprendemos, mejoramos el servicio y crecemos junto a ustedes.',
on conflict (id) do update set
    commission_rate = excluded.commission_rate,
    launch_mode = excluded.launch_mode,
    donations_enabled = excluded.donations_enabled,
    donation_message = excluded.donation_message,
    community_message = excluded.community_message,
    driver_message = excluded.driver_message,
    passenger_message = excluded.passenger_message,
    updated_at = now();

-- RLS recomendado para rides si no lo tienes
alter table rides enable row level security;

drop policy if exists "Passengers can create own rides" on rides;
create policy "Passengers can create own rides"
on rides
for insert
to authenticated
with check (
  passenger_id = auth.uid()
);

drop policy if exists "Passengers can read own rides" on rides;
create policy "Passengers can read own rides"
on rides
for select
to authenticated
using (
  passenger_id = auth.uid()
  or exists (
    select 1 from profiles
    where profiles.id = auth.uid()
    and profiles.role in ('super_admin','admin','operations','support')
  )
);

drop policy if exists "Passengers can update own ride confirmation" on rides;
create policy "Passengers can update own ride confirmation"
on rides
for update
to authenticated
using (
  passenger_id = auth.uid()
  or exists (
    select 1 from profiles
    where profiles.id = auth.uid()
    and profiles.role in ('super_admin','admin','operations','support')
  )
)
with check (
  passenger_id = auth.uid()
  or exists (
    select 1 from profiles
    where profiles.id = auth.uid()
    and profiles.role in ('super_admin','admin','operations','support')
  )
);

-- RLS recomendado para ofertas
alter table ride_offers enable row level security;

drop policy if exists "Passengers can read offers for own rides" on ride_offers;
create policy "Passengers can read offers for own rides"
on ride_offers
for select
to authenticated
using (
  exists (
    select 1 from rides
    where rides.id = ride_offers.ride_id
    and rides.passenger_id = auth.uid()
  )
  or exists (
    select 1 from profiles
    where profiles.id = auth.uid()
    and profiles.role in ('super_admin','admin','operations','support')
  )
);

drop policy if exists "Passengers can update offers for own rides" on ride_offers;
create policy "Passengers can update offers for own rides"
on ride_offers
for update
to authenticated
using (
  exists (
    select 1 from rides
    where rides.id = ride_offers.ride_id
    and rides.passenger_id = auth.uid()
  )
  or exists (
    select 1 from profiles
    where profiles.id = auth.uid()
    and profiles.role in ('super_admin','admin','operations','support')
  )
)
with check (
  exists (
    select 1 from rides
    where rides.id = ride_offers.ride_id
    and rides.passenger_id = auth.uid()
  )
  or exists (
    select 1 from profiles
    where profiles.id = auth.uid()
    and profiles.role in ('super_admin','admin','operations','support')
  )
);
