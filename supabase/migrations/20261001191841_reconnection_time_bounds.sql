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
      paused_answer_remaining_ms=case when v_game.status='answering' then greatest(0,least(10000,floor(extract(epoch from (v_round.answer_deadline_at-v_pause_at))*1000)))::bigint end,
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
