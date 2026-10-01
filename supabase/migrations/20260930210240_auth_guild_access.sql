-- Phase 3.3B: authentication profile synchronization.
-- Guild invitations and access links are added in a later Phase 3.3 migration.

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    nullif(
      btrim(
        coalesce(
          new.raw_user_meta_data ->> 'display_name',
          new.raw_user_meta_data ->> 'full_name',
          new.raw_user_meta_data ->> 'name',
          new.raw_user_meta_data ->> 'preferred_username',
          ''
        )
      ),
      ''
    ),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do update
  set
    display_name = coalesce(
      excluded.display_name,
      public.profiles.display_name
    ),
    avatar_url = coalesce(
      excluded.avatar_url,
      public.profiles.avatar_url
    );

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user()
from public, anon, authenticated;

drop trigger if exists guild_organizer_on_auth_user_profile_updated
on auth.users;

create trigger guild_organizer_on_auth_user_profile_updated
after update of raw_user_meta_data on auth.users
for each row
when (old.raw_user_meta_data is distinct from new.raw_user_meta_data)
execute function private.handle_new_auth_user();
