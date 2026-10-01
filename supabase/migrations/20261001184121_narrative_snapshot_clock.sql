create or replace function public.get_room_snapshot(p_code text, p_token_hash text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_snapshot jsonb; v_game public.games%rowtype;
begin
  v_snapshot := public.get_room_snapshot_base(p_code,p_token_hash);
  select * into v_game from public.games where code = upper(btrim(p_code));
  return jsonb_set(v_snapshot, '{state,control}', jsonb_build_object(
    'revision', v_game.revision, 'workError', v_game.work_error,
    'canRetry', v_game.work_error and v_game.status <> 'paused' and (v_game.work_until is null or v_game.work_until <= now()),
    'epilogue', v_game.epilogue, 'suggestedSituation', v_game.generation_hint));
end;
$$;
