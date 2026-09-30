begin;

do $$
begin
  if to_regprocedure('extensions.plan(integer)') is null then
    execute 'create extension if not exists pgtap with schema extensions';
  end if;
end;
$$;
set local search_path = public, extensions;

select plan(22);

select has_function(
  'public',
  'create_room_with_host',
  array['text', 'text', 'text'],
  'room creation operation exists'
);

select like(
  pg_get_functiondef('public.join_game(text,text,text)'::regprocedure),
  '%FOR UPDATE%',
  'join serializes competitors before choosing the remaining slot'
);

select like(
  pg_get_functiondef(
    'public.create_game_with_host(text,text,text)'::regprocedure
  ),
  '%pg_advisory_xact_lock%',
  'repeated room creation is serialized by tab identity'
);
select has_function(
  'public',
  'start_game',
  array['text', 'text'],
  'atomic start operation exists'
);
select has_function(
  'public',
  'update_player_presence',
  array['text', 'text', 'boolean'],
  'presence operation exists'
);
select has_function(
  'public',
  'get_room_snapshot',
  array['text', 'text'],
  'authenticated snapshot operation exists'
);

set local role service_role;
select lives_ok(
  $$select * from public.create_room_with_host('LOBBY001', 'Host', 'host-hash')$$,
  'host creates the room'
);
select lives_ok(
  $$select * from public.create_room_with_host('IGNORED1', 'Host', 'host-hash')$$,
  'repeating creation with the same identity is idempotent'
);
reset role;
set local search_path = public, extensions;

select results_eq(
  $$select count(*) from public.games where code in ('LOBBY001', 'IGNORED1')$$,
  array[1::bigint],
  'idempotent creation keeps one room'
);

set local role service_role;
select lives_ok(
  $$select * from public.join_game('LOBBY001', 'Guest', 'guest-hash')$$,
  'guest occupies the second slot'
);
select lives_ok(
  $$select * from public.join_game('LOBBY001', 'Guest', 'guest-hash')$$,
  'repeating join with the same identity is idempotent'
);
reset role;
set local search_path = public, extensions;

select results_eq(
  $$select count(*) from public.players where game_id = (select id from public.games where code = 'LOBBY001')$$,
  array[2::bigint],
  'idempotent join keeps exactly two players'
);

set local role service_role;
select throws_ok(
  $$select * from public.join_game('LOBBY001', 'Third', 'third-hash')$$,
  '23514',
  null,
  'a third identity cannot enter'
);
select throws_ok(
  $$select * from public.start_game('LOBBY001', 'guest-hash')$$,
  '42501',
  null,
  'only the host can start'
);
select lives_ok(
  $$select * from public.start_game('LOBBY001', 'host-hash')$$,
  'host starts with two connected players'
);
select lives_ok(
  $$select * from public.start_game('LOBBY001', 'host-hash')$$,
  'repeating start is idempotent'
);
reset role;
set local search_path = public, extensions;

select results_eq(
  $$select status::text || ':' || current_round::text from public.games where code = 'LOBBY001'$$,
  array['generating:1'::text],
  'start performs one authoritative transition'
);

set local role service_role;
select lives_ok(
  $$select public.update_player_presence('LOBBY001', 'guest-hash', false)$$,
  'presence can be updated by room identity'
);
select ok(
  (public.get_room_snapshot('LOBBY001', 'host-hash') #>> '{state,players,1,isConnected}')::boolean = false,
  'snapshot exposes current presence without token hashes'
);
select throws_ok(
  $$select public.get_room_snapshot('LOBBY001', 'invalid-hash')$$,
  '42501',
  null,
  'snapshot rejects an invalid room identity'
);
reset role;
set local search_path = public, extensions;

select ok(
  not has_function_privilege('anon', 'public.get_room_snapshot(text,text)', 'execute')
    and not has_function_privilege('authenticated', 'public.get_room_snapshot(text,text)', 'execute')
    and has_function_privilege('service_role', 'public.get_room_snapshot(text,text)', 'execute'),
  'snapshot is available only to the server role'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.players'::regclass),
  'player identities remain protected by RLS'
);

select * from finish();
rollback;
