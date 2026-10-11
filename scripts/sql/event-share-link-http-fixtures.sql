-- New synthetic records only; the host verifies the empty owned database first.
begin;
insert into auth.users(id,email) values
('6f000000-0000-4000-8000-000000000001','http-owner@test.local'),
('6f000000-0000-4000-8000-000000000002','http-member@test.local');
insert into public.guilds(id,name,created_by) values
('6f100000-0000-4000-8000-000000000001','HTTP synthetic Guild','6f000000-0000-4000-8000-000000000001');
insert into public.guild_memberships(id,guild_id,user_id,role) values
('6f110000-0000-4000-8000-000000000001','6f100000-0000-4000-8000-000000000001','6f000000-0000-4000-8000-000000000001','owner'),
('6f110000-0000-4000-8000-000000000002','6f100000-0000-4000-8000-000000000001','6f000000-0000-4000-8000-000000000002','member');
insert into public.event_types(id,guild_id,name,status) values
('6f300000-0000-4000-8000-000000000001','6f100000-0000-4000-8000-000000000001','HTTP League','active');
insert into public.event_templates(id,guild_id,event_type_id,name,status) values
('6f400000-0000-4000-8000-000000000001','6f100000-0000-4000-8000-000000000001','6f300000-0000-4000-8000-000000000001','HTTP template','active');
insert into public.events(id,guild_id,event_type_id,source_template_id,name,description) values
('6f500000-0000-4000-8000-000000000001','6f100000-0000-4000-8000-000000000001','6f300000-0000-4000-8000-000000000001','6f400000-0000-4000-8000-000000000001','HTTP published event','PRIVATE_HTTP_DRAFT_CANARY');
insert into public.event_sections(id,guild_id,event_id,name,sort_order) values
('6f510000-0000-4000-8000-000000000001','6f100000-0000-4000-8000-000000000001','6f500000-0000-4000-8000-000000000001','HTTP Team',0);
insert into public.event_parties(id,guild_id,event_id,section_id,name,sort_order) values
('6f520000-0000-4000-8000-000000000001','6f100000-0000-4000-8000-000000000001','6f500000-0000-4000-8000-000000000001','6f510000-0000-4000-8000-000000000001','HTTP Party',0);
insert into public.event_slots(id,guild_id,event_id,party_id,name,sort_order) values
('6f530000-0000-4000-8000-000000000001','6f100000-0000-4000-8000-000000000001','6f500000-0000-4000-8000-000000000001','6f520000-0000-4000-8000-000000000001','HTTP Seat',0);
insert into public.characters(id,guild_id,ign,class_name,status,source_origin,created_by) values
('6f600000-0000-4000-8000-000000000001','6f100000-0000-4000-8000-000000000001','PRIVATE_HTTP_ROSTER_CANARY','Knight','active','manual','6f000000-0000-4000-8000-000000000001');
set local role authenticated;
set local request.jwt.claim.sub='6f000000-0000-4000-8000-000000000001';
select public.publish_event('6f500000-0000-4000-8000-000000000001');
commit;
