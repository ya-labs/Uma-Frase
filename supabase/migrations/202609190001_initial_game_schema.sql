-- Uma Frase MVP 0.1
-- The browser never receives database write access. The server owns the
-- opaque session token and uses the service_role connection for transitions.

create schema if not exists game;

create table game.matches (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'waiting'
    check (status in ('waiting', 'playing', 'revealed', 'finished', 'abandoned')),
  current_round smallint not null default 0 check (current_round between 0 and 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table game.players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references game.matches(id) on delete cascade,
  slot smallint not null check (slot in (1, 2)),
  display_name text not null check (length(display_name) between 1 and 80),
  session_token_hash bytea not null unique,
  joined_at timestamptz not null default now(),
  unique (match_id, slot),
  unique (id, match_id)
);

create table game.rounds (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references game.matches(id) on delete cascade,
  round_number smallint not null check (round_number between 1 and 8),
  prompt text not null check (length(prompt) between 1 and 2000),
  word_limit smallint not null check (word_limit between 1 and 50),
  state text not null default 'active'
    check (state in ('active', 'revealed', 'closed')),
  reveal_at timestamptz not null,
  winner_player_id uuid,
  story_fragment text,
  created_at timestamptz not null default now(),
  unique (match_id, round_number),
  foreign key (winner_player_id, match_id)
    references game.players(id, match_id)
);

create table game.answers (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references game.rounds(id) on delete cascade,
  player_id uuid not null references game.players(id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  word_count smallint not null check (word_count > 0 and word_count <= 50),
  submitted_at timestamptz not null default now(),
  unique (round_id, player_id)
);

create index players_match_id_idx on game.players(match_id);
create index rounds_match_id_idx on game.rounds(match_id, round_number);
create index answers_round_id_idx on game.answers(round_id);

-- The application server is the only data-plane actor. The public roles have
-- no table privileges and no policies, so direct REST reads/writes fail closed.
alter table game.matches enable row level security;
alter table game.players enable row level security;
alter table game.rounds enable row level security;
alter table game.answers enable row level security;

revoke all on schema game from anon, authenticated;
revoke all on all tables in schema game from anon, authenticated;
grant usage on schema game to service_role;
grant all on all tables in schema game to service_role;
grant all on all sequences in schema game to service_role;

-- Keep updated_at server-owned; transition functions can update it explicitly.
create or replace function game.touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, game
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function game.touch_updated_at() from public, anon, authenticated;
grant execute on function game.touch_updated_at() to service_role;

create trigger matches_touch_updated_at
before update on game.matches
for each row execute function game.touch_updated_at();
