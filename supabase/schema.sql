-- A lancer dans Supabase > SQL Editor.
-- Ce script crée le stockage applicatif et le système de validation des inscriptions.

create table if not exists public.app_data (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.app_data enable row level security;

drop policy if exists "Users can read their own app data" on public.app_data;
create policy "Users can read their own app data"
on public.app_data
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own app data" on public.app_data;
create policy "Users can insert their own app data"
on public.app_data
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own app data" on public.app_data;
create policy "Users can update their own app data"
on public.app_data
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own app data" on public.app_data;
create policy "Users can delete their own app data"
on public.app_data
for delete
to authenticated
using (auth.uid() = user_id);

create table if not exists public.user_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by text
);

alter table public.user_access enable row level security;

drop policy if exists "Users can read their own access status" on public.user_access;
create policy "Users can read their own access status"
on public.user_access
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can request their own access" on public.user_access;
create policy "Users can request their own access"
on public.user_access
for insert
to authenticated
with check (auth.uid() = user_id and status = 'pending');

create or replace function public.create_pending_user_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_access (user_id, email, name, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    'pending'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_access on auth.users;
create trigger on_auth_user_created_create_access
after insert on auth.users
for each row execute function public.create_pending_user_access();

-- Pour valider un utilisateur pendant la phase de test :
-- 1. Aller dans Table Editor > user_access.
-- 2. Passer status de 'pending' à 'approved'.
-- 3. Facultatif : renseigner approved_at = now() et approved_by = votre email.
--
-- Exemple SQL :
-- update public.user_access
-- set status = 'approved', approved_at = now(), approved_by = 'votre-email@example.com'
-- where email = 'enseignant@example.com';
