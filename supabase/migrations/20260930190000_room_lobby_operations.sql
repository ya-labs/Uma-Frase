create or replace function private.broadcast_room_state_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_game_id uuid;
begin
  if tg_table_name = 'games' then
    v_code := case when tg_op = 'DELETE' then old.code else new.code end;
  else
    v_game_id := case
      when tg_op = 'DELETE' then old.game_id
      else new.game_id
    end;

    select g.code into v_code
    from public.games as g
    where g.id = v_game_id;
  end if;

  if v_code is not null
    and to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null
  then
    perform realtime.send(
      jsonb_build_object(
        'type', 'room_state_changed',
        'roomCode', v_code
      ),
      'room_state_changed',
      'room:' || v_code,
      false
    );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke execute on function private.broadcast_room_state_changed()
from public, anon, authenticated;

create trigger games_broadcast_room_state_changed
after insert or update or delete on public.games
for each row execute function private.broadcast_room_state_changed();

create trigger players_broadcast_room_state_changed
after insert or update or delete on public.players
for each row execute function private.broadcast_room_state_changed();

create or replace function public.create_game_with_host(
  p_code text,
  p_host_name text,
  p_token_hash text
)
returns table (game_id uuid, player_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(btrim(p_code));
  v_host_name text := btrim(p_host_name);
  v_token_hash text := btrim(p_token_hash);
  v_game_id uuid := gen_random_uuid();
  v_player_id uuid := gen_random_uuid();
  v_existing_player public.players%rowtype;
begin
  if v_code = '' or v_host_name = '' or v_token_hash = '' then
    raise exception 'code, host name and token hash are required'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_token_hash, 0)
  );

  select p.* into v_existing_player
  from public.players as p
  where p.reconnect_token_hash = v_token_hash;

  if found then
    if exists (
      select 1
      from public.games as g
      where g.id = v_existing_player.game_id
        and g.host_player_id = v_existing_player.id
    ) then
      update public.players
      set is_connected = true
      where id = v_existing_player.id;

      return query values (
        v_existing_player.game_id,
        v_existing_player.id
      );
      return;
    end if;

    raise exception 'token belongs to another player'
      using errcode = '42501';
  end if;

  insert into public.games (id, code, host_player_id)
  values (v_game_id, v_code, v_player_id);

  insert into public.players (
    id,
    game_id,
    slot,
    name,
    reconnect_token_hash
  ) values (
    v_player_id,
    v_game_id,
    1,
    v_host_name,
    v_token_hash
  );

  return query values (v_game_id, v_player_id);
end;
$$;

create or replace function public.join_game(
  p_code text,
  p_player_name text,
  p_token_hash text
)
returns table (game_id uuid, player_id uuid, slot smallint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(btrim(p_code));
  v_player_name text := btrim(p_player_name);
  v_token_hash text := btrim(p_token_hash);
  v_game public.games%rowtype;
  v_existing_player public.players%rowtype;
  v_player_id uuid := gen_random_uuid();
  v_slot smallint;
begin
  if v_code = '' or v_player_name = '' or v_token_hash = '' then
    raise exception 'code, player name and token hash are required'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_token_hash, 0)
  );

  select g.* into v_game
  from public.games as g
  where g.code = v_code
  for update;

  if not found then
    raise exception 'game not found' using errcode = 'P0002';
  end if;

  select p.* into v_existing_player
  from public.players as p
  where p.reconnect_token_hash = v_token_hash;

  if found then
    if v_existing_player.game_id <> v_game.id then
      raise exception 'token belongs to another game'
        using errcode = '42501';
    end if;

    update public.players
    set is_connected = true
    where id = v_existing_player.id;

    return query values (
      v_game.id,
      v_existing_player.id,
      v_existing_player.slot
    );
    return;
  end if;

  if v_game.status <> 'waiting' then
    raise exception 'game is not accepting players' using errcode = '23514';
  end if;

  select candidate.slot into v_slot
  from (values (1::smallint), (2::smallint)) as candidate(slot)
  where not exists (
    select 1
    from public.players as p
    where p.game_id = v_game.id and p.slot = candidate.slot
  )
  order by candidate.slot
  limit 1;

  if v_slot is null then
    raise exception 'game already has two players' using errcode = '23514';
  end if;

  insert into public.players (
    id,
    game_id,
    slot,
    name,
    reconnect_token_hash
  ) values (
    v_player_id,
    v_game.id,
    v_slot,
    v_player_name,
    v_token_hash
  );

  return query values (v_game.id, v_player_id, v_slot);
end;
$$;

create function public.create_room_with_host(
  p_code text,
  p_host_name text,
  p_token_hash text
)
returns table (game_id uuid, player_id uuid, room_code text)
language sql
security definer
set search_path = ''
as $$
  select created.game_id, created.player_id, g.code
  from public.create_game_with_host(p_code, p_host_name, p_token_hash) as created
  join public.games as g on g.id = created.game_id;
$$;

create function public.start_game(
  p_code text,
  p_token_hash text
)
returns table (game_id uuid, changed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(btrim(p_code));
  v_token_hash text := btrim(p_token_hash);
  v_game public.games%rowtype;
  v_player public.players%rowtype;
  v_player_count integer;
begin
  select g.* into v_game
  from public.games as g
  where g.code = v_code
  for update;

  if not found then
    raise exception 'game not found' using errcode = 'P0002';
  end if;

  select p.* into v_player
  from public.players as p
  where p.game_id = v_game.id
    and p.reconnect_token_hash = v_token_hash;

  if not found or v_player.id <> v_game.host_player_id then
    raise exception 'only the host can start the game'
      using errcode = '42501';
  end if;

  if v_game.status = 'generating' and v_game.current_round = 1 then
    return query values (v_game.id, false);
    return;
  end if;

  if v_game.status <> 'waiting' then
    raise exception 'game is not waiting to start' using errcode = '23514';
  end if;

  select count(*) into v_player_count
  from public.players as p
  where p.game_id = v_game.id and p.is_connected;

  if v_player_count <> 2 then
    raise exception 'two connected players are required'
      using errcode = '23514';
  end if;

  update public.games
  set status = 'generating', current_round = 1
  where id = v_game.id;

  return query values (v_game.id, true);
end;
$$;

create function public.update_player_presence(
  p_code text,
  p_token_hash text,
  p_is_connected boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player_id uuid;
begin
  update public.players as p
  set is_connected = p_is_connected
  from public.games as g
  where g.id = p.game_id
    and g.code = upper(btrim(p_code))
    and p.reconnect_token_hash = btrim(p_token_hash)
  returning p.id into v_player_id;

  if v_player_id is null then
    raise exception 'invalid room identity' using errcode = '42501';
  end if;

  return v_player_id;
end;
$$;

create function public.get_room_snapshot(
  p_code text,
  p_token_hash text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_player public.players%rowtype;
  v_round public.rounds%rowtype;
  v_players jsonb;
  v_answers jsonb := '[]'::jsonb;
  v_current_round jsonb;
begin
  select g.* into v_game
  from public.games as g
  where g.code = upper(btrim(p_code));

  if not found then
    raise exception 'game not found' using errcode = 'P0002';
  end if;

  select p.* into v_player
  from public.players as p
  where p.game_id = v_game.id
    and p.reconnect_token_hash = btrim(p_token_hash);

  if not found then
    raise exception 'invalid room identity' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'gameId', p.game_id,
        'name', p.name,
        'score', p.score,
        'isConnected', p.is_connected
      ) order by p.slot
    ),
    '[]'::jsonb
  ) into v_players
  from public.players as p
  where p.game_id = v_game.id;

  if v_game.current_round > 0 then
    select r.* into v_round
    from public.rounds as r
    where r.game_id = v_game.id
      and r.number = v_game.current_round;
  end if;

  if v_round.id is not null then
    v_current_round := jsonb_build_object(
      'id', v_round.id,
      'gameId', v_round.game_id,
      'number', v_round.number,
      'status', v_round.status,
      'situation', v_round.situation,
      'wordLimit', v_round.word_limit,
      'answerDeadlineAt', v_round.answer_deadline_at,
      'winnerPlayerId', v_round.winner_player_id,
      'reason', v_round.reason,
      'continuation', v_round.continuation,
      'nextSituation', v_round.next_situation
    );

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'roundId', a.round_id,
          'playerId', a.player_id,
          'text', a.text,
          'submittedAt', a.submitted_at
        ) order by a.submitted_at, a.id
      ),
      '[]'::jsonb
    ) into v_answers
    from public.answers as a
    where a.round_id = v_round.id;
  end if;

  return jsonb_build_object(
    'playerId', v_player.id,
    'state', jsonb_build_object(
      'game', jsonb_build_object(
        'id', v_game.id,
        'code', v_game.code,
        'status', v_game.status,
        'hostPlayerId', v_game.host_player_id,
        'round', v_game.current_round,
        'maxRounds', v_game.max_rounds,
        'storySummary', v_game.story_summary,
        'pausedFrom', v_game.paused_from,
        'createdAt', v_game.created_at
      ),
      'players', v_players,
      'currentRound', v_current_round,
      'answers', v_answers
    )
  );
end;
$$;

revoke execute on function public.start_game(text, text)
from public, anon, authenticated;
revoke execute on function public.create_room_with_host(text, text, text)
from public, anon, authenticated;
revoke execute on function public.update_player_presence(text, text, boolean)
from public, anon, authenticated;
revoke execute on function public.get_room_snapshot(text, text)
from public, anon, authenticated;

grant execute on function public.start_game(text, text) to service_role;
grant execute on function public.create_room_with_host(text, text, text)
to service_role;
grant execute on function public.update_player_presence(text, text, boolean)
to service_role;
grant execute on function public.get_room_snapshot(text, text) to service_role;
