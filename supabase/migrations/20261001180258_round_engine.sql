-- All writes lock the game first; RPCs are restricted to the server role.
alter table public.rounds add column situation_ready_at timestamptz;

create function private.lock_room(p_code text, p_token_hash text)
returns public.games language plpgsql security definer set search_path = '' as $$
declare v_game public.games%rowtype;
begin
  select * into v_game from public.games where code = upper(btrim(p_code)) for update;
  if not found then raise exception 'room not found' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.players where game_id = v_game.id and reconnect_token_hash = p_token_hash) then
    raise exception 'invalid identity' using errcode = '42501';
  end if;
  return v_game;
end;
$$;

-- ECMAScript whitespace: String.trim and /\s+/u in the shared domain.
create function private.normalize_answer(p_text text)
returns text language sql immutable set search_path = '' as $$
  select btrim(translate(p_text,
    U&'\0009\000A\000B\000C\000D\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF',
    repeat(' ', 24)));
$$;
create function private.count_words(p_text text)
returns integer language sql immutable set search_path = '' as $$
  select case when private.normalize_answer(p_text) = '' then 0
    else cardinality(regexp_split_to_array(private.normalize_answer(p_text), ' +')) end;
$$;

create function public.open_round(p_code text, p_token_hash text, p_situation text, p_summary text, p_word_limit integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_game public.games%rowtype; v_round_id uuid;
begin
  v_game := private.lock_room(p_code, p_token_hash);
  select id into v_round_id from public.rounds where game_id = v_game.id and number = v_game.current_round;
  if v_round_id is not null then return v_round_id; end if;
  if v_game.status <> 'generating' or v_game.current_round not between 1 and 8
    or btrim(p_situation) = '' or p_situation is null or p_word_limit not between 1 and 15 or p_word_limit is null then
    raise exception 'invalid round opening' using errcode = '23514';
  end if;
  insert into public.rounds(game_id, number, status, situation, word_limit, situation_ready_at)
  values (v_game.id, v_game.current_round, 'situation', btrim(p_situation), p_word_limit, clock_timestamp() + interval '2 seconds')
  returning id into v_round_id;
  update public.games set status = 'situation', story_summary = p_summary where id = v_game.id;
  return v_round_id;
end;
$$;

create function public.tick_round(p_code text, p_token_hash text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_game public.games%rowtype; v_round public.rounds%rowtype;
  v_count integer; v_winner uuid; v_text text; v_reason text; v_continuation text;
begin
  v_game := private.lock_room(p_code, p_token_hash);
  select * into v_round from public.rounds where game_id = v_game.id and number = v_game.current_round for update;
  if not found then return; end if;
  if v_game.status = 'situation' and v_round.situation_ready_at <= clock_timestamp() then
    update public.rounds set status = 'answering', answer_deadline_at = clock_timestamp() + interval '10 seconds' where id = v_round.id;
    update public.games set status = 'answering' where id = v_game.id;
    return;
  end if;
  if v_game.status <> 'answering' then return; end if;
  select count(*) into v_count from public.answers where round_id = v_round.id;
  if v_count < 2 and clock_timestamp() < v_round.answer_deadline_at then return; end if;
  if v_count = 2 then
    update public.rounds set status = 'judging' where id = v_round.id;
    update public.games set status = 'judging' where id = v_game.id;
    return;
  end if;
  select player_id, text into v_winner, v_text from public.answers where round_id = v_round.id;
  v_reason := case when v_count = 1 then 'A única resposta válida vence por ausência do adversário.' else 'Ninguém respondeu dentro do prazo. Nenhum ponto foi concedido.' end;
  v_continuation := coalesce(v_text, 'A história segue sem uma nova ação dos jogadores.');
  update public.rounds set status = 'reveal', winner_player_id = v_winner, reason = v_reason,
    continuation = v_continuation, next_situation = v_round.situation where id = v_round.id;
  if v_winner is not null then update public.players set score = score + 1 where id = v_winner; end if;
  update public.games set status = 'reveal', story_summary = left(concat_ws(' ', nullif(story_summary, ''), v_continuation), 6000) where id = v_game.id;
end;
$$;

create function public.submit_round_answer(p_code text, p_token_hash text, p_round_id uuid, p_text text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_game public.games%rowtype; v_round public.rounds%rowtype; v_player_id uuid;
  v_existing public.answers%rowtype; v_answer_id uuid; v_text text;
begin
  v_game := private.lock_room(p_code, p_token_hash);
  select id into v_player_id from public.players where game_id = v_game.id and reconnect_token_hash = p_token_hash;
  select * into v_round from public.rounds where id = p_round_id and game_id = v_game.id for update;
  if not found then raise exception 'invalid round' using errcode = '23514'; end if;
  v_text := btrim(p_text, U&' \0009\000A\000B\000C\000D\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
  select * into v_existing from public.answers where round_id = p_round_id and player_id = v_player_id;
  if found then
    if v_existing.text = v_text then return v_existing.id; end if;
    raise exception 'answer already submitted' using errcode = '23514';
  end if;
  if v_game.current_round <> v_round.number or v_game.status <> 'answering' or v_round.status <> 'answering'
    or v_round.answer_deadline_at is null or clock_timestamp() >= v_round.answer_deadline_at
    or p_text is null or length(v_text) > 2000 or private.count_words(v_text) not between 1 and v_round.word_limit then
    raise exception 'answer rejected: phase, deadline or word limit' using errcode = '23514';
  end if;
  insert into public.answers(game_id, round_id, player_id, text, submitted_at)
  values(v_game.id, p_round_id, v_player_id, v_text, clock_timestamp()) returning id into v_answer_id;
  perform public.tick_round(p_code, p_token_hash);
  return v_answer_id;
end;
$$;

create trigger rounds_broadcast_room_state_changed after insert or update on public.rounds
for each row execute function private.broadcast_room_state_changed();
-- Broadcast contains only a room identifier, never the answer text.
create trigger answers_broadcast_room_state_changed after insert on public.answers
for each row execute function private.broadcast_room_state_changed();

revoke all on function private.lock_room(text,text), private.normalize_answer(text), private.count_words(text) from public, anon, authenticated;
revoke all on function public.open_round(text,text,text,text,integer), public.tick_round(text,text), public.submit_round_answer(text,text,uuid,text) from public, anon, authenticated;
grant execute on function public.open_round(text,text,text,text,integer), public.tick_round(text,text), public.submit_round_answer(text,text,uuid,text) to service_role;
