-- Keep the public heartbeat wrapper and existing deadlines unchanged.
-- Only newly opened answer windows receive the one-minute deadline.
create or replace function public.tick_round_base(p_code text, p_token_hash text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_game public.games%rowtype; v_round public.rounds%rowtype;
  v_count integer; v_winner uuid; v_text text; v_reason text; v_continuation text;
begin
  v_game := private.lock_room(p_code, p_token_hash);
  select * into v_round from public.rounds where game_id = v_game.id and number = v_game.current_round for update;
  if not found then return; end if;
  if v_game.status = 'situation' and v_round.situation_ready_at <= clock_timestamp() then
    update public.rounds set status = 'answering', answer_deadline_at = clock_timestamp() + interval '60 seconds' where id = v_round.id;
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

-- Pause retains the actual remaining time, capped at the new round duration.
create or replace function private.reconcile_presence(p_game_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_game public.games%rowtype; v_round public.rounds%rowtype; v_pause_at timestamptz;
begin
  select * into v_game from public.games where id=p_game_id for update;
  update public.players set is_connected=false where game_id=p_game_id and is_connected and last_seen_at < clock_timestamp()-interval '6 seconds';
  if v_game.status in ('waiting','finished') then return; end if;
  select * into v_round from public.rounds where game_id=p_game_id and number=v_game.current_round for update;
  if exists(select 1 from public.players where game_id=p_game_id and not is_connected) then
    if v_game.status='paused' then return; end if;
    select least(clock_timestamp(),min(last_seen_at+interval '6 seconds')) into v_pause_at from public.players where game_id=p_game_id and not is_connected;
    update public.games set status='paused',paused_from=v_game.status,
      paused_answer_remaining_ms=case when v_game.status='answering' then greatest(0,least(60000,floor(extract(epoch from (v_round.answer_deadline_at-v_pause_at))*1000)))::bigint end,
      paused_situation_remaining_ms=case when v_game.status='situation' then greatest(0,least(2000,floor(extract(epoch from (v_round.situation_ready_at-v_pause_at))*1000)))::bigint end
    where id=p_game_id;
  elsif v_game.status='paused' then
    if v_game.paused_from='answering' then
      update public.rounds set answer_deadline_at=clock_timestamp()+v_game.paused_answer_remaining_ms*interval '1 millisecond' where id=v_round.id;
    elsif v_game.paused_from='situation' then
      update public.rounds set situation_ready_at=clock_timestamp()+v_game.paused_situation_remaining_ms*interval '1 millisecond' where id=v_round.id;
    end if;
    update public.games set status=paused_from,paused_from=null,paused_answer_remaining_ms=null,paused_situation_remaining_ms=null where id=p_game_id;
  end if;
end;
$$;
