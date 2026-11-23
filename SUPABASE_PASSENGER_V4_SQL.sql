-- VUELO PASSENGER V4 - RESET PASSWORD + SYNC

alter table profiles add column if not exists phone text;

insert into profiles (
  id,
  full_name,
  email,
  phone,
  role,
  city,
  is_active
)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  u.email,
  coalesce(u.raw_user_meta_data->>'phone', ''),
  coalesce(u.raw_user_meta_data->>'role', 'passenger')::user_role,
  'Ometepe',
  true
from auth.users u
where not exists (
  select 1 from profiles p
  where p.id = u.id
);

update profiles p
set
  full_name = coalesce(nullif(p.full_name, ''), u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  phone = coalesce(nullif(p.phone, ''), u.raw_user_meta_data->>'phone', p.phone)
from auth.users u
where p.id = u.id;

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
    coalesce(new.raw_user_meta_data->>'role', 'passenger')::user_role,
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
