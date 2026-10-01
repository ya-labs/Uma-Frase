alter table public.players add column last_seen_at timestamptz not null default now();
alter table public.games
  add column paused_answer_remaining_ms bigint,
  add column paused_situation_remaining_ms bigint;

-- Heartbeats are private bookkeeping, not public state changes.
create or replace function private.touch_room_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'players' and tg_op = 'UPDATE' then
    if new.is_connected = old.is_connected and new.score = old.score and new.name = old.name then return new; end if;
  end if;
  update public.games set updated_at = clock_timestamp() where id = new.game_id;
  return new;
end;
$$;
create or replace function private.broadcast_room_state_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_code text; v_game_id uuid;
begin
  if tg_table_name = 'players' and tg_op = 'UPDATE' then
    if new.is_connected = old.is_connected and new.score = old.score and new.name = old.name then return new; end if;
  end if;
  if tg_table_name = 'games' then
    v_code := case when tg_op = 'DELETE' then old.code else new.code end;
  else
    v_game_id := case when tg_op = 'DELETE' then old.game_id else new.game_id end;
    select code into v_code from public.games where id=v_game_id;
  end if;
  if v_code is not null and to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
    perform realtime.send(jsonb_build_object('type','room_state_changed','roomCode',v_code),'room_state_changed','room:'||v_code,false);
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

create function private.reconcile_presence(p_game_id uuid) returns void
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
      paused_answer_remaining_ms=case when v_game.status='answering' then greatest(0,floor(extract(epoch from (v_round.answer_deadline_at-v_pause_at))*1000))::bigint end,
      paused_situation_remaining_ms=case when v_game.status='situation' then greatest(0,floor(extract(epoch from (v_round.situation_ready_at-v_pause_at))*1000))::bigint end
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

create function public.heartbeat_room(p_code text,p_token_hash text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_game public.games%rowtype;
begin
  v_game := private.lock_room(p_code,p_token_hash);
  update public.players set is_connected=true,last_seen_at=clock_timestamp() where game_id=v_game.id and reconnect_token_hash=p_token_hash;
  perform private.reconcile_presence(v_game.id);
end;
$$;

create or replace function public.update_player_presence(p_code text,p_token_hash text,p_is_connected boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_game public.games%rowtype; v_player_id uuid;
begin
  v_game := private.lock_room(p_code,p_token_hash);
  update public.players set is_connected=p_is_connected,
    last_seen_at=case when p_is_connected then clock_timestamp() else clock_timestamp()-interval '6 seconds' end
    where game_id=v_game.id and reconnect_token_hash=p_token_hash returning id into v_player_id;
  perform private.reconcile_presence(v_game.id);
  return v_player_id;
end;
$$;

alter function public.tick_round(text,text) rename to tick_round_base;
create function public.tick_round(p_code text,p_token_hash text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.heartbeat_room(p_code,p_token_hash);
  perform public.tick_round_base(p_code,p_token_hash);
end;
$$;
alter function public.submit_round_answer(text,text,uuid,text) rename to submit_round_answer_base;
create function public.submit_round_answer(p_code text,p_token_hash text,p_round_id uuid,p_text text) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  perform public.heartbeat_room(p_code,p_token_hash);
  return public.submit_round_answer_base(p_code,p_token_hash,p_round_id,p_text);
end;
$$;

-- A response from an in-flight provider may arrive during a pause. Apply it
-- atomically and preserve the pause in the newly confirmed phase.
alter function public.finish_narrative_work(text,text,uuid,text,jsonb) rename to finish_narrative_work_base;
create function public.finish_narrative_work(p_code text,p_token_hash text,p_work_token uuid,p_kind text,p_result jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_game public.games%rowtype; v_status public.game_status; v_done boolean;
begin
  v_game := private.lock_room(p_code,p_token_hash);
  if v_game.status <> 'paused' then return public.finish_narrative_work_base(p_code,p_token_hash,p_work_token,p_kind,p_result); end if;
  update public.games set status=paused_from,paused_from=null where id=v_game.id;
  v_done := public.finish_narrative_work_base(p_code,p_token_hash,p_work_token,p_kind,p_result);
  select status into v_status from public.games where id=v_game.id;
  if v_status <> 'finished' then
    update public.games set status='paused',paused_from=v_status,
      paused_situation_remaining_ms=case when v_status='situation' then 2000 else paused_situation_remaining_ms end where id=v_game.id;
  end if;
  return v_done;
end;
$$;

create or replace function public.get_room_snapshot(p_code text,p_token_hash text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_snapshot jsonb; v_game public.games%rowtype;
begin
  v_snapshot := public.get_room_snapshot_base(p_code,p_token_hash);
  select * into v_game from public.games where code=upper(btrim(p_code));
  return jsonb_set(v_snapshot,'{state,control}',jsonb_build_object(
    'revision',v_game.revision,'workError',v_game.work_error,
    'canRetry',v_game.work_error and v_game.status<>'paused' and (v_game.work_until is null or v_game.work_until<=now()),
    'epilogue',v_game.epilogue,'suggestedSituation',v_game.generation_hint,
    'serverNow',now(),'remainingAnswerMs',v_game.paused_answer_remaining_ms));
end;
$$;

revoke all on function private.reconcile_presence(uuid) from public,anon,authenticated;

create or replace function public.fail_narrative_work(p_code text,p_token_hash text,p_work_token uuid,p_kind text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_game public.games%rowtype;
begin
  v_game := private.lock_room(p_code,p_token_hash);
  if v_game.work_token is distinct from p_work_token or p_work_token is null then return; end if;
  if p_kind='judge' and (v_game.status='judging' or (v_game.status='paused' and v_game.paused_from='judging')) then
    update public.rounds set status='judging_error' where game_id=v_game.id and number=v_game.current_round;
    update public.games set status=case when status='paused' then 'paused'::public.game_status else 'judging_error'::public.game_status end,
      paused_from=case when status='paused' then 'judging_error'::public.game_status else null end where id=v_game.id;
  end if;
  update public.games set work_error=true,work_token=null,work_until=clock_timestamp()+interval '5 seconds' where id=v_game.id;
end;
$$;
revoke all on function public.heartbeat_room(text,text), public.tick_round(text,text),public.submit_round_answer(text,text,uuid,text),public.finish_narrative_work(text,text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.heartbeat_room(text,text), public.tick_round(text,text),public.submit_round_answer(text,text,uuid,text),public.finish_narrative_work(text,text,uuid,text,jsonb) to service_role;
