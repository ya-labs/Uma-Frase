begin;

do $$
begin
  if to_regprocedure('extensions.plan(integer)') is null then
    execute 'create extension if not exists pgtap with schema extensions';
  end if;
end;
$$;
set local search_path = public, extensions;

select plan(34);

select has_table('public', 'games', 'games table exists');
select has_table('public', 'players', 'players table exists');
select has_table('public', 'rounds', 'rounds table exists');
select has_table('public', 'answers', 'answers table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.games'::regclass),
  'games has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.players'::regclass),
  'players has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.rounds'::regclass),
  'rounds has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.answers'::regclass),
  'answers has RLS enabled'
);

select has_function(
  'public',
  'create_game_with_host',
  array['text', 'text', 'text'],
  'atomic game creation function exists'
);
select has_function(
  'public',
  'join_game',
  array['text', 'text', 'text'],
  'atomic player join function exists'
);

set local role service_role;
select lives_ok(
  $$select * from public.create_game_with_host('ROOM01', 'Host', 'host-token-hash')$$,
  'service role creates a game and host atomically'
);
reset role;
set local search_path = public, extensions;

select ok(
  exists (
    select 1
    from public.games as g
    join public.players as p
      on p.id = g.host_player_id and p.game_id = g.id
    where g.code = 'ROOM01' and p.slot = 1
  ),
  'host belongs to the created game'
);

set local role service_role;
select lives_ok(
  $$select * from public.join_game('ROOM01', 'Guest', 'guest-token-hash')$$,
  'service role fills the second slot atomically'
);
reset role;
set local search_path = public, extensions;

select results_eq(
  $$select count(*) from public.players where game_id = (select id from public.games where code = 'ROOM01')$$,
  array[2::bigint],
  'a game contains exactly two players after join'
);

set local role service_role;
select throws_ok(
  $$select * from public.join_game('ROOM01', 'Third', 'third-token-hash')$$,
  '23514',
  null,
  'a third player cannot join the game'
);
reset role;
set local search_path = public, extensions;

select throws_ok(
  $$insert into public.players (game_id, slot, name, reconnect_token_hash) values ((select id from public.games where code = 'ROOM01'), 2, 'Duplicate', 'duplicate-slot-token')$$,
  '23505',
  null,
  'a player slot cannot be duplicated in a game'
);

select lives_ok(
  $$insert into public.rounds (game_id, number, status, situation, word_limit) values ((select id from public.games where code = 'ROOM01'), 1, 'answering', 'Situation', 5)$$,
  'a valid round can be created'
);

select throws_ok(
  $$insert into public.rounds (game_id, number, status, situation, word_limit) values ((select id from public.games where code = 'ROOM01'), 9, 'answering', 'Invalid', 5)$$,
  '23514',
  null,
  'round number cannot exceed eight'
);

select lives_ok(
  $$insert into public.answers (game_id, round_id, player_id, text) select r.game_id, r.id, p.id, 'First answer' from public.rounds as r join public.players as p on p.game_id = r.game_id where r.number = 1 and p.slot = 1$$,
  'a valid private answer can be stored'
);

select throws_ok(
  $$insert into public.answers (game_id, round_id, player_id, text) select r.game_id, r.id, p.id, 'Duplicate answer' from public.rounds as r join public.players as p on p.game_id = r.game_id where r.number = 1 and p.slot = 1$$,
  '23505',
  null,
  'a player cannot answer the same round twice'
);

set local role service_role;
select lives_ok(
  $$select * from public.create_game_with_host('ROOM02', 'Other host', 'other-host-token-hash')$$,
  'a second game can be created'
);
reset role;
set local search_path = public, extensions;

select lives_ok(
  $$insert into public.rounds (game_id, number, status, situation, word_limit) values ((select id from public.games where code = 'ROOM02'), 1, 'answering', 'Other situation', 5)$$,
  'a round can be created in the second game'
);

select throws_ok(
  $$insert into public.answers (game_id, round_id, player_id, text) select r.game_id, r.id, p.id, 'Cross-game answer' from public.rounds as r cross join public.players as p where r.game_id = (select id from public.games where code = 'ROOM02') and p.game_id = (select id from public.games where code = 'ROOM01') limit 1$$,
  '23503',
  null,
  'an answer cannot mix players and rounds from different games'
);

set local role anon;
select throws_ok(
  $$select * from public.answers$$,
  '42501',
  null,
  'anonymous clients cannot read private answers'
);
select throws_ok(
  $$select * from public.create_game_with_host('ROOM03', 'Anon', 'anon-token-hash')$$,
  '42501',
  null,
  'anonymous clients cannot execute privileged functions'
);
reset role;
set local search_path = public, extensions;

set local role authenticated;
select throws_ok(
  $$select * from public.answers$$,
  '42501',
  null,
  'authenticated clients cannot read private answers directly'
);
reset role;
set local search_path = public, extensions;

set local role service_role;
select results_eq(
  $$select count(*) from public.answers$$,
  array[1::bigint],
  'service role can read the stored answer'
);
reset role;
set local search_path = public, extensions;

select ok(
  not exists (
    select 1
    from (
      values
        ('public.games'::regclass),
        ('public.players'::regclass),
        ('public.rounds'::regclass),
        ('public.answers'::regclass)
    ) as exposed_tables(table_oid)
    where has_table_privilege('anon', table_oid, 'select')
      or has_table_privilege('anon', table_oid, 'insert')
      or has_table_privilege('anon', table_oid, 'update')
      or has_table_privilege('anon', table_oid, 'delete')
  ),
  'anonymous role has no direct table privileges'
);

select ok(
  not exists (
    select 1
    from (
      values
        ('public.games'::regclass),
        ('public.players'::regclass),
        ('public.rounds'::regclass),
        ('public.answers'::regclass)
    ) as exposed_tables(table_oid)
    where has_table_privilege('authenticated', table_oid, 'select')
      or has_table_privilege('authenticated', table_oid, 'insert')
      or has_table_privilege('authenticated', table_oid, 'update')
      or has_table_privilege('authenticated', table_oid, 'delete')
  ),
  'authenticated role has no direct table privileges'
);

select ok(
  not exists (
    select 1
    from (
      values
        ('public.games'::regclass),
        ('public.players'::regclass),
        ('public.rounds'::regclass),
        ('public.answers'::regclass)
    ) as exposed_tables(table_oid)
    where not has_table_privilege('service_role', table_oid, 'select')
      or not has_table_privilege('service_role', table_oid, 'insert')
      or not has_table_privilege('service_role', table_oid, 'update')
      or not has_table_privilege('service_role', table_oid, 'delete')
  ),
  'service role has the required table privileges'
);

select ok(
  (
    select prosecdef and proconfig = array['search_path=""']
    from pg_proc
    where oid = 'public.create_game_with_host(text,text,text)'::regprocedure
  ),
  'game creation is security definer with an empty search path'
);

select ok(
  (
    select prosecdef and proconfig = array['search_path=""']
    from pg_proc
    where oid = 'public.join_game(text,text,text)'::regprocedure
  ),
  'game join is security definer with an empty search path'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.create_game_with_host(text,text,text)',
    'execute'
  )
    and not has_function_privilege(
      'anon',
      'public.join_game(text,text,text)',
      'execute'
    ),
  'anonymous role cannot execute privileged functions'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.create_game_with_host(text,text,text)',
    'execute'
  )
    and has_function_privilege(
      'service_role',
      'public.join_game(text,text,text)',
      'execute'
    ),
  'service role can execute privileged functions'
);

select * from finish();
rollback;
