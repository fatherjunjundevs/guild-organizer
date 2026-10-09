-- Phase 6.3A.4 contract repair only. Keep the legacy state RPC unchanged.
-- This read distinguishes never-issued links from permanently revoked links
-- without exposing historical identities or any credential/recovery material.
create function public.get_event_share_link_management_state(
  p_guild_id uuid,
  p_event_id uuid
)
returns table (state text, link_id uuid, created_at timestamptz, available boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_publish_manage(p_guild_id);

  -- One statement snapshot: active identity takes precedence over all history.
  -- EXISTS uses the existing Guild/Event history index; no history is returned.
  return query
  select
    case
      when active_link.id is not null then 'active'
      when exists (
        select 1 from private.event_share_links historical_link
        where historical_link.guild_id = e.guild_id
          and historical_link.event_id = e.id
          and historical_link.revoked_at is not null
      ) then 'revoked'
      else 'absent'
    end,
    active_link.id,
    active_link.created_at,
    coalesce(active_link.id is not null and e.status = 'active'
      and p.status = 'published' and v.sealed_at is not null, false)
  from public.events e
  left join private.event_share_links active_link
    on active_link.guild_id = e.guild_id and active_link.event_id = e.id
    and active_link.revoked_at is null
  left join public.event_publications p
    on p.guild_id = e.guild_id and p.event_id = e.id
  left join public.event_publication_versions v
    on v.guild_id = p.guild_id and v.event_id = p.event_id
    and v.publication_id = p.id and v.id = p.current_version_id
  where e.guild_id = p_guild_id and e.id = p_event_id;

  if not found then
    raise exception 'Event unavailable for this Guild' using errcode = 'P0002';
  end if;
end;
$$;

alter function public.get_event_share_link_management_state(uuid, uuid)
  owner to postgres;
revoke all on function public.get_event_share_link_management_state(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_event_share_link_management_state(uuid, uuid)
  to authenticated;

comment on function public.get_event_share_link_management_state(uuid, uuid) is
  'Authenticated publish.manage-only Guild/Event state: absent, active, or revoked; active identity/creation time only; available means the active link resolves to a current sealed publication. Archived Events remain readable but unavailable. No historical records, actors, tokens, digests, recovery material, or proofs.';
