-- Phase 3.3B: Manual character detail editing guard.
--
-- Game fields on RTNW-synced characters are authoritative from the official
-- roster export. Only manual-origin characters may be edited through this RPC.

create or replace function public.update_roster_character(
  p_character_id uuid,
  p_ign text,
  p_level integer,
  p_class_name text,
  p_title text,
  p_gender text,
  p_guild_position text,
  p_gear_score bigint,
  p_weekly_activity bigint,
  p_weekly_contribution bigint,
  p_total_contribution bigint,
  p_online_status text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_source_origin text;
begin
  perform private.require_roster_character(p_character_id);

  select c.source_origin
  into v_source_origin
  from public.characters c
  where c.id = p_character_id;

  if v_source_origin <> 'manual' then
    raise exception 'RTNW-synced character game fields are managed by roster sync'
      using errcode = '55000';
  end if;

  if p_ign is null
     or char_length(btrim(p_ign)) = 0
     or p_ign is distinct from btrim(p_ign) then
    raise exception 'IGN must be non-empty and cannot have surrounding whitespace'
      using errcode = '22023';
  end if;

  update public.characters
  set
    ign = p_ign,
    level = p_level,
    class_name = nullif(p_class_name, ''),
    title = nullif(p_title, ''),
    gender = nullif(p_gender, ''),
    guild_position = nullif(p_guild_position, ''),
    gear_score = p_gear_score,
    weekly_activity = p_weekly_activity,
    weekly_contribution = p_weekly_contribution,
    total_contribution = p_total_contribution,
    online_status = nullif(p_online_status, '')
  where id = p_character_id;
end;
$$;

revoke all on function public.update_roster_character(
  uuid, text, integer, text, text, text, text,
  bigint, bigint, bigint, bigint, text
) from public, anon, authenticated;

grant execute on function public.update_roster_character(
  uuid, text, integer, text, text, text, text,
  bigint, bigint, bigint, bigint, text
) to authenticated;

comment on function public.update_roster_character(
  uuid, text, integer, text, text, text, text,
  bigint, bigint, bigint, bigint, text
) is
  'Updates game/current fields only for manual-origin characters. RTNW-synced character game fields remain authoritative from confirmed roster syncs.';
