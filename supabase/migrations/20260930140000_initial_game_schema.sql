create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create type public.game_status as enum (
  'waiting',
  'generating',
  'situation',
  'answering',
  'judging',
  'judging_error',
  'reveal',
  'paused',
  'finished'
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status public.game_status not null default 'waiting',
  host_player_id uuid not null,
  current_round smallint not null default 0,
  max_rounds smallint not null default 8,
  story_summary text not null default '',
  paused_from public.game_status,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint games_code_not_blank check (length(btrim(code)) > 0),
  constraint games_code_normalized check (code = upper(btrim(code))),
  constraint games_current_round_range check (
    current_round between 0 and 8
  ),
  constraint games_max_rounds_fixed check (max_rounds = 8),
  constraint games_pause_state_consistent check (
    (status = 'paused' and paused_from is not null)
    or (status <> 'paused' and paused_from is null)
  )
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  slot smallint not null,
  name text not null,
  reconnect_token_hash text not null unique,
  score smallint not null default 0,
  is_connected boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint players_identity_in_game unique (id, game_id),
  constraint players_slot_in_game unique (game_id, slot),
  constraint players_slot_range check (slot between 1 and 2),
  constraint players_name_not_blank check (length(btrim(name)) > 0),
  constraint players_token_hash_not_blank check (
    length(btrim(reconnect_token_hash)) > 0
  ),
  constraint players_score_range check (score between 0 and 8)
);

alter table public.games
add constraint games_host_belongs_to_game
foreign key (host_player_id, id)
references public.players(id, game_id)
deferrable initially deferred;

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  number smallint not null,
  status public.game_status not null default 'generating',
  situation text not null,
  word_limit smallint not null,
  answer_deadline_at timestamptz,
  winner_player_id uuid,
  reason text,
  continuation text,
  next_situation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rounds_identity_in_game unique (id, game_id),
  constraint rounds_number_in_game unique (game_id, number),
  constraint rounds_number_range check (number between 1 and 8),
  constraint rounds_word_limit_range check (word_limit between 1 and 15),
  constraint rounds_winner_belongs_to_game foreign key (
    winner_player_id,
    game_id
  ) references public.players(id, game_id)
);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null,
  round_id uuid not null,
  player_id uuid not null,
  text text not null,
  submitted_at timestamptz not null default now(),
  constraint answers_once_per_player_round unique (round_id, player_id),
  constraint answers_text_not_blank check (length(btrim(text)) > 0),
  constraint answers_round_belongs_to_game foreign key (round_id, game_id)
    references public.rounds(id, game_id) on delete cascade,
  constraint answers_player_belongs_to_game foreign key (player_id, game_id)
    references public.players(id, game_id) on delete cascade
);

create index games_status_idx on public.games(status);
create index games_host_idx on public.games(host_player_id, id);
create index rounds_game_status_idx on public.rounds(game_id, status);
create index rounds_winner_idx on public.rounds(winner_player_id, game_id);
create index answers_round_game_idx on public.answers(round_id, game_id);
create index answers_player_game_idx on public.answers(player_id, game_id);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function private.set_updated_at() from public, anon, authenticated;

create trigger games_set_updated_at
before update on public.games
for each row execute function private.set_updated_at();

create trigger players_set_updated_at
before update on public.players
for each row execute function private.set_updated_at();

create trigger rounds_set_updated_at
before update on public.rounds
for each row execute function private.set_updated_at();

create function public.create_game_with_host(
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
begin
  if v_code = '' or v_host_name = '' or v_token_hash = '' then
    raise exception 'code, host name and token hash are required'
      using errcode = '22023';
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

create function public.join_game(
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
  v_player_id uuid := gen_random_uuid();
  v_slot smallint;
begin
  if v_code = '' or v_player_name = '' or v_token_hash = '' then
    raise exception 'code, player name and token hash are required'
      using errcode = '22023';
  end if;

  select g.*
  into v_game
  from public.games as g
  where g.code = v_code
  for update;

  if not found then
    raise exception 'game not found' using errcode = 'P0002';
  end if;

  if v_game.status <> 'waiting' then
    raise exception 'game is not accepting players' using errcode = '23514';
  end if;

  select candidate.slot
  into v_slot
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

alter table public.games enable row level security;
alter table public.players enable row level security;
alter table public.rounds enable row level security;
alter table public.answers enable row level security;

create policy games_deny_direct_client_access
on public.games for all to anon, authenticated
using (false) with check (false);

create policy players_deny_direct_client_access
on public.players for all to anon, authenticated
using (false) with check (false);

create policy rounds_deny_direct_client_access
on public.rounds for all to anon, authenticated
using (false) with check (false);

create policy answers_deny_direct_client_access
on public.answers for all to anon, authenticated
using (false) with check (false);

revoke all on table public.games from anon, authenticated;
revoke all on table public.players from anon, authenticated;
revoke all on table public.rounds from anon, authenticated;
revoke all on table public.answers from anon, authenticated;

grant select, insert, update, delete on table public.games to service_role;
grant select, insert, update, delete on table public.players to service_role;
grant select, insert, update, delete on table public.rounds to service_role;
grant select, insert, update, delete on table public.answers to service_role;

revoke execute on function public.create_game_with_host(text, text, text)
from public, anon, authenticated;
revoke execute on function public.join_game(text, text, text)
from public, anon, authenticated;

grant execute on function public.create_game_with_host(text, text, text)
to service_role;
grant execute on function public.join_game(text, text, text)
to service_role;

revoke usage on type public.game_status from anon, authenticated;
grant usage on type public.game_status to service_role;

alter default privileges in schema public
revoke all on tables from anon, authenticated;
alter default privileges in schema public
revoke execute on functions from public, anon, authenticated;
