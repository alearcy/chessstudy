create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table public.user_security_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_security_state enable row level security;

create policy user_security_state_select_own
  on public.user_security_state for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.user_security_state
from public, anon, authenticated;

grant select on table public.user_security_state to authenticated;

insert into public.user_security_state (user_id, must_change_password)
select id, false
from auth.users;

create or replace function private.sync_user_security_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.user_security_state (user_id, must_change_password)
    values (new.id, true)
    on conflict (user_id) do update
      set must_change_password = true,
          updated_at = now();
  elsif new.encrypted_password is distinct from old.encrypted_password then
    insert into public.user_security_state (user_id, must_change_password)
    values (new.id, false)
    on conflict (user_id) do update
      set must_change_password = false,
          updated_at = now();
  end if;
  return new;
end;
$$;

revoke all on function private.sync_user_security_state()
from public, anon, authenticated;

create trigger sync_user_security_state_after_auth_change
  after insert or update of encrypted_password on auth.users
  for each row execute function private.sync_user_security_state();
