alter table public.games
  add column revision bigint not null default 0,
  add column work_token uuid,
  add column work_until timestamptz,
  add column work_error boolean not null default false,
  add column generation_hint text,
  add column epilogue text;

create function private.increment_game_revision() returns trigger
language plpgsql set search_path = '' as $$
begin new.revision := old.revision + 1; return new; end;
$$;
create trigger games_increment_revision before update on public.games
for each row execute function private.increment_game_revision();
create function private.touch_room_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.games set updated_at = clock_timestamp() where id = new.game_id;
  return new;
end;
$$;
create trigger players_touch_room_revision after insert or update on public.players for each row execute function private.touch_room_revision();
create trigger rounds_touch_room_revision after insert or update on public.rounds for each row execute function private.touch_room_revision();
create trigger answers_touch_room_revision after insert on public.answers for each row execute function private.touch_room_revision();

alter function public.get_room_snapshot(text,text) rename to get_room_snapshot_base;
create function public.get_room_snapshot(p_code text, p_token_hash text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_snapshot jsonb; v_game public.games%rowtype;
begin
  v_snapshot := public.get_room_snapshot_base(p_code,p_token_hash);
  select * into v_game from public.games where code = upper(btrim(p_code));
  return jsonb_set(v_snapshot, '{state,control}', jsonb_build_object(
    'revision', v_game.revision, 'workError', v_game.work_error,
    'canRetry', v_game.work_error and (v_game.work_until is null or v_game.work_until <= clock_timestamp()),
    'epilogue', v_game.epilogue, 'suggestedSituation', v_game.generation_hint));
end;
$$;

create function public.claim_narrative_work(p_code text,p_token_hash text,p_retry boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_game public.games%rowtype; v_kind text; v_token uuid := gen_random_uuid();
begin
  v_game := private.lock_room(p_code,p_token_hash);
  if v_game.work_until > clock_timestamp() or (v_game.work_error and not p_retry) then return null; end if;
  v_kind := case when v_game.status = 'generating' then 'generate'
    when v_game.status = 'judging' or (v_game.status = 'judging_error' and p_retry) then 'judge'
    when v_game.status = 'reveal' and v_game.current_round = 8 and v_game.epilogue is null then 'epilogue' end;
  if v_kind is null then return null; end if;
  if v_game.status = 'judging_error' then
    update public.rounds set status = 'judging' where game_id = v_game.id and number = v_game.current_round;
  end if;
  update public.games set work_token = v_token, work_until = clock_timestamp() + interval '55 seconds', work_error = false,
    status = case when status = 'judging_error' then 'judging'::public.game_status else status end where id = v_game.id;
  return jsonb_build_object('token',v_token,'kind',v_kind);
end;
$$;

create function public.finish_narrative_work(p_code text,p_token_hash text,p_work_token uuid,p_kind text,p_result jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_game public.games%rowtype; v_round public.rounds%rowtype; v_winner uuid; v_field text;
begin
  v_game := private.lock_room(p_code,p_token_hash);
  -- Lost-response retries and stale workers cannot overwrite a confirmed result.
  if v_game.work_token is distinct from p_work_token or p_work_token is null or v_game.work_until <= clock_timestamp() then return false; end if;
  if p_kind = 'generate' and v_game.status = 'generating' then
    if p_result->>'situation' is null or btrim(p_result->>'situation') = '' or length(p_result->>'situation') > 2000
      or p_result->>'updatedStorySummary' is null or btrim(p_result->>'updatedStorySummary') = '' or length(p_result->>'updatedStorySummary') > 6000 then
      raise exception 'invalid generation' using errcode = '23514';
    end if;
    perform public.open_round(p_code,p_token_hash,p_result->>'situation',p_result->>'updatedStorySummary',(p_result->>'wordLimit')::integer);
  elsif p_kind = 'judge' and v_game.status = 'judging' then
    select * into v_round from public.rounds where game_id=v_game.id and number=v_game.current_round for update;
    if v_round.status <> 'judging' or (select count(*) from public.answers where round_id=v_round.id) <> 2 then raise exception 'invalid judging phase' using errcode='23514'; end if;
    foreach v_field in array array['reason','continuation','nextSituation','updatedStorySummary'] loop
      if p_result->>v_field is null or btrim(p_result->>v_field) = '' or length(p_result->>v_field) > (case when v_field='updatedStorySummary' then 6000 else 2000 end) then raise exception 'invalid judgment' using errcode='23514'; end if;
    end loop;
    if not (p_result ? 'winnerPlayerId') then raise exception 'missing winner' using errcode='23514'; end if;
    v_winner := (p_result->>'winnerPlayerId')::uuid;
    if v_winner is not null and not exists(select 1 from public.answers where round_id=v_round.id and player_id=v_winner) then raise exception 'ineligible winner' using errcode='23514'; end if;
    update public.rounds set status='reveal', winner_player_id=v_winner, reason=p_result->>'reason', continuation=p_result->>'continuation', next_situation=p_result->>'nextSituation' where id=v_round.id;
    if v_winner is not null then update public.players set score=score+1 where id=v_winner; end if;
    update public.games set status='reveal', story_summary=p_result->>'updatedStorySummary' where id=v_game.id;
  elsif p_kind = 'epilogue' and v_game.status = 'reveal' and v_game.current_round = 8 then
    if p_result->>'epilogue' is null or btrim(p_result->>'epilogue') = '' or length(p_result->>'epilogue') > 4000 then raise exception 'invalid epilogue' using errcode='23514'; end if;
    update public.games set status='finished', epilogue=p_result->>'epilogue' where id=v_game.id;
    update public.rounds set status='finished' where game_id=v_game.id and number=8;
  else return false;
  end if;
  update public.games set work_token=null,work_until=null,work_error=false where id=v_game.id;
  return true;
end;
$$;

create function public.fail_narrative_work(p_code text,p_token_hash text,p_work_token uuid,p_kind text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_game public.games%rowtype;
begin
  v_game := private.lock_room(p_code,p_token_hash);
  if v_game.work_token is distinct from p_work_token or p_work_token is null then return; end if;
  if p_kind = 'judge' and v_game.status = 'judging' then
    update public.rounds set status='judging_error' where game_id=v_game.id and number=v_game.current_round;
    update public.games set status='judging_error' where id=v_game.id;
  end if;
  update public.games set work_error=true,work_token=null,work_until=clock_timestamp()+interval '5 seconds' where id=v_game.id;
end;
$$;

create function public.advance_round(p_code text,p_token_hash text,p_round_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_game public.games%rowtype; v_round public.rounds%rowtype;
begin
  v_game := private.lock_room(p_code,p_token_hash);
  if not exists(select 1 from public.players where id=v_game.host_player_id and reconnect_token_hash=p_token_hash) then raise exception 'only host advances' using errcode='42501'; end if;
  select * into v_round from public.rounds where id=p_round_id and game_id=v_game.id;
  if not found then raise exception 'invalid round' using errcode='23514'; end if;
  if v_game.current_round > v_round.number or v_game.status='finished' then return; end if;
  if v_game.status <> 'reveal' or v_round.number <> v_game.current_round or v_game.work_error then raise exception 'invalid advance' using errcode='23514'; end if;
  if v_game.current_round=8 then return; end if;
  update public.games set status='generating',current_round=current_round+1,generation_hint=v_round.next_situation,work_token=null,work_until=null,work_error=false where id=v_game.id;
end;
$$;

revoke all on function private.increment_game_revision(), private.touch_room_revision() from public,anon,authenticated;
revoke all on function public.get_room_snapshot(text,text), public.claim_narrative_work(text,text,boolean), public.finish_narrative_work(text,text,uuid,text,jsonb), public.fail_narrative_work(text,text,uuid,text), public.advance_round(text,text,uuid) from public,anon,authenticated;
grant execute on function public.get_room_snapshot(text,text), public.claim_narrative_work(text,text,boolean), public.finish_narrative_work(text,text,uuid,text,jsonb), public.fail_narrative_work(text,text,uuid,text), public.advance_round(text,text,uuid) to service_role;

-- Preserve game-first locking when presence touches the game revision.
create or replace function public.update_player_presence(p_code text,p_token_hash text,p_is_connected boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_game public.games%rowtype; v_player_id uuid;
begin
  v_game := private.lock_room(p_code,p_token_hash);
  select id into v_player_id from public.players where game_id=v_game.id and reconnect_token_hash=p_token_hash;
  update public.players set is_connected=p_is_connected where id=v_player_id and is_connected is distinct from p_is_connected;
  return v_player_id;
end;
$$;
