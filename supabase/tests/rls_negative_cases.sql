-- Run in a disposable Supabase project after the migration.
-- These checks intentionally prove that browser roles cannot use the game
-- tables directly. The server uses service_role and is tested separately.

begin;

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

do $$
begin
  if has_schema_privilege('anon', 'game', 'USAGE') then
    raise exception 'anon unexpectedly has USAGE on game schema';
  end if;
  if has_table_privilege('anon', 'game.matches', 'SELECT') then
    raise exception 'anon unexpectedly has SELECT on game.matches';
  end if;
  if has_table_privilege('anon', 'game.answers', 'SELECT') then
    raise exception 'anon unexpectedly has SELECT on game.answers';
  end if;
end;
$$;

-- Direct REST/PostgREST-equivalent table access must fail closed.
do $$
begin
  begin
    perform * from game.answers limit 1;
    raise exception 'anon read unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

rollback;

-- Repeat the same assertions for authenticated. No login is used by MVP 0.1,
-- so an authenticated browser role must not become a bypass path accidentally.
begin;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001"}';

do $$
begin
  if has_schema_privilege('authenticated', 'game', 'USAGE') then
    raise exception 'authenticated unexpectedly has USAGE on game schema';
  end if;
  if has_table_privilege('authenticated', 'game.answers', 'SELECT') then
    raise exception 'authenticated unexpectedly has SELECT on game.answers';
  end if;
end;
$$;

rollback;
