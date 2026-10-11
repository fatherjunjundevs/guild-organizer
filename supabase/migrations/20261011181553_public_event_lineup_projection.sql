-- Public display projection only. This schema must never be exposed by PostgREST.
-- No login, membership, table privilege or existing resolver definition is changed.
do $authority$
begin
  if not exists(select 1 from pg_catalog.pg_roles where rolname='go_event_share_resolver'
    and not rolcanlogin and not rolinherit and not rolsuper and not rolbypassrls
    and not rolcreatedb and not rolcreaterole and not rolreplication)
    or exists(select 1 from pg_catalog.pg_auth_members where member='go_event_share_resolver'::pg_catalog.regrole)
    or pg_catalog.pg_has_role('authenticator','go_event_share_resolver','MEMBER')
    or pg_catalog.pg_has_role('anon','go_event_share_resolver','MEMBER')
    or pg_catalog.pg_has_role('authenticated','go_event_share_resolver','MEMBER')
    or pg_catalog.pg_has_role('service_role','go_event_share_resolver','MEMBER') then
    raise exception 'Restricted resolver authority required' using errcode='42501';
  end if;
end;
$authority$;
create schema go_event_share_private authorization postgres;
revoke all on schema go_event_share_private from public, anon, authenticated, service_role;
grant usage on schema go_event_share_private to go_event_share_resolver;

-- Fixed boolean inspection of the actual dedicated backend, not role defaults.
-- This grants no arbitrary settings access. Missing owner authority returns false.
create function go_event_share_private.connection_private()
returns boolean language plpgsql stable security definer set search_path = '' as $privacy$
begin
  if session_user <> 'go_event_share_reader'
    or pg_catalog.current_setting('role', true) is distinct from 'go_event_share_resolver' then return false; end if;
  return coalesce(
    pg_catalog.current_setting('shared_preload_libraries') in ('',
      'pg_stat_statements,plpgsql,plpgsql_check,pg_cron,pg_net,pgsodium,pg_tle,plan_filter,supabase_vault')
    and pg_catalog.current_setting('session_preload_libraries') = ''
    and pg_catalog.current_setting('local_preload_libraries') = ''
    and not exists(select 1 from pg_catalog.pg_settings where name like 'pgaudit.%' or name like 'auto_explain.%')
    and pg_catalog.current_setting('log_statement') = 'none'
    and pg_catalog.current_setting('log_min_error_statement') = 'panic'
    and pg_catalog.current_setting('log_min_messages') = 'fatal'
    and pg_catalog.current_setting('log_duration') = 'off'
    and pg_catalog.current_setting('log_min_duration_statement') = '-1'
    and pg_catalog.current_setting('log_min_duration_sample') = '-1'
    and pg_catalog.current_setting('log_statement_sample_rate') = '0'
    and pg_catalog.current_setting('log_transaction_sample_rate') = '0'
    and pg_catalog.current_setting('log_parameter_max_length') = '0'
    and pg_catalog.current_setting('log_parameter_max_length_on_error') = '0'
    and pg_catalog.current_setting('pg_stat_statements.track', true) = 'none'
    and pg_catalog.current_setting('logging_collector') = 'off'
    and pg_catalog.current_setting('log_destination') = 'stderr'
    and pg_catalog.current_setting('log_connections') = 'off'
    and pg_catalog.current_setting('log_disconnections') = 'off'
    and pg_catalog.pg_current_logfile() is null, false);
exception when others then return false;
end;
$privacy$;
alter function go_event_share_private.connection_private() owner to postgres;
revoke all on function go_event_share_private.connection_private() from public, anon, authenticated, service_role;
grant execute on function go_event_share_private.connection_private() to go_event_share_resolver;

create function go_event_share_private.resolve_lineup(
  p_token text, p_version integer, p_page integer, p_search text
) returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare result jsonb;
begin
  if p_token is null or pg_catalog.octet_length(p_token) <> 46
     or p_token collate pg_catalog."C" !~ '^v1\.[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'
     or p_page is null or p_page < 0 or p_page > 416
     or (p_version is not null and p_version < 1)
     or p_search is null or pg_catalog.char_length(p_search) > 80
     or p_search ~ '[[:cntrl:]]' then
    return null;
  end if;

  -- One MVCC statement: a supplied version is a consistency guard, never a
  -- selector for historical snapshots. All display values come from sealed rows.
  with target as materialized (
    select v.*, p.published_at
    from private.event_share_links l
    join public.guilds g on g.id = l.guild_id and g.status = 'active'
    join public.events e on e.id = l.event_id and e.guild_id = l.guild_id and e.status = 'active'
    join public.event_publications p on p.event_id = l.event_id and p.guild_id = l.guild_id and p.status = 'published'
    join public.event_publication_versions v on v.id = p.current_version_id
      and v.publication_id = p.id and v.guild_id = p.guild_id and v.event_id = p.event_id
      and v.sealed_at is not null
    where l.token_digest = pg_catalog.encode(extensions.digest(p_token, 'sha256'), 'hex')
      and l.revoked_at is null
  ), structure as (
    select a.name area, s.name team, q.name party, q.id party_id,
      a.sort_order area_order, s.sort_order team_order, q.sort_order party_order,
      a.id area_id, s.id team_id, t.id version_id
    from target t
    join public.event_publication_sections s on s.publication_version_id = t.id
      and s.guild_id = t.guild_id and s.event_id = t.event_id
    left join public.event_publication_areas a on a.id = s.area_id and a.publication_version_id = t.id
    left join public.event_publication_parties q on q.section_id = s.id and q.publication_version_id = t.id
    union all
    select a.name, null, null, null, a.sort_order, null, null, a.id, null, t.id
    from target t join public.event_publication_areas a on a.publication_version_id = t.id
    where not exists (select 1 from public.event_publication_sections s where s.area_id = a.id)
  ), cards as materialized (
    select pg_catalog.row_number() over (
      order by area_order nulls first, area_id nulls first, team_order nulls first,
        team_id nulls first, party_order nulls first, party_id nulls first) ordinal,
      area, team, party, party_id, version_id
    from structure
  ), matched as materialized (
    select c.* from cards c where p_search = '' or exists (
      select 1 from public.event_publication_slots s
      join public.event_publication_assignments x on x.slot_id = s.id and x.publication_version_id = c.version_id
      where s.party_id = c.party_id and s.publication_version_id = c.version_id
        and pg_catalog.strpos(pg_catalog.lower(x.character_ign_snapshot), pg_catalog.lower(p_search)) > 0)
  ), page as (
    select * from matched order by ordinal limit 12 offset (p_page * 12)
  ), display as (
    select pg_catalog.jsonb_build_object('ordinal', c.ordinal, 'area', c.area, 'team', c.team, 'party', c.party,
      'slots', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'name', s.name, 'roleLabel', s.role_label, 'ign', x.character_ign_snapshot,
        'className', x.character_class_snapshot, 'characterRole', x.character_role_snapshot)
        order by s.sort_order, s.id)
        from public.event_publication_slots s
        left join public.event_publication_assignments x on x.slot_id = s.id and x.publication_version_id = c.version_id
        where s.party_id = c.party_id and s.publication_version_id = c.version_id), '[]'::jsonb)) card, c.ordinal
    from page c
  ) select case
    when (select count(*) from cards) > 5000 or exists (
      select 1 from public.event_publication_slots s join target t on t.id = s.publication_version_id
      group by s.party_id having count(*) > 8) then null
    when p_version is not null and p_version <> t.version_number then
      pg_catalog.jsonb_build_object('status', 'updated', 'version', t.version_number)
    else pg_catalog.jsonb_build_object('status', 'ready', 'eventName', t.event_name_snapshot,
      'eventType', t.event_type_name_snapshot, 'version', t.version_number,
      'publishedAt', t.published_at, 'page', p_page, 'pageSize', 12,
      'totalCards', (select count(*) from cards), 'matchedCards', (select count(*) from matched),
      'cards', coalesce((select pg_catalog.jsonb_agg(card order by ordinal) from display), '[]'::jsonb))
    end into result from target t;
  return result;
end;
$function$;
alter function go_event_share_private.resolve_lineup(text, integer, integer, text) owner to postgres;
revoke all on function go_event_share_private.resolve_lineup(text, integer, integer, text)
  from public, anon, authenticated, service_role;
grant execute on function go_event_share_private.resolve_lineup(text, integer, integer, text) to go_event_share_resolver;
comment on function go_event_share_private.resolve_lineup(text, integer, integer, text) is
  'Token-scoped current sealed display values only; 12 cards/page, 8 slots/card, 5000 cards maximum. Private, not a PostgREST RPC.';
