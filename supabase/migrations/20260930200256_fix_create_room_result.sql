create or replace function public.create_room_with_host(
  p_code text,
  p_host_name text,
  p_token_hash text
)
returns table (game_id uuid, player_id uuid, room_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_id uuid;
  v_player_id uuid;
  v_room_code text;
begin
  select created.game_id, created.player_id
  into strict v_game_id, v_player_id
  from public.create_game_with_host(p_code, p_host_name, p_token_hash) as created;

  -- A separate command can see a room just inserted by create_game_with_host.
  select g.code into strict v_room_code
  from public.games as g
  where g.id = v_game_id;

  return query values (v_game_id, v_player_id, v_room_code);
end;
$$;
