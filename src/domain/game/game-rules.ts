import {
  MAX_PLAYERS,
  MAX_ROUNDS,
  type Answer,
  type Game,
  type Player,
  type Round,
} from "./entities";

export const DOMAIN_RULE_ERROR_CODES = [
  "invalid_transition",
  "invalid_round",
  "invalid_player_count",
  "duplicate_player",
  "player_from_another_game",
  "host_not_found",
  "player_not_connected",
  "round_from_another_game",
  "round_status_mismatch",
  "duplicate_answer",
  "answer_from_another_round",
  "answer_from_unknown_player",
  "invalid_winner",
  "score_limit_exceeded",
  "missing_paused_state",
] as const;

export type DomainRuleErrorCode = (typeof DOMAIN_RULE_ERROR_CODES)[number];

export type DomainRuleError = {
  code: DomainRuleErrorCode;
  message: string;
};

export type DomainResult<T> =
  { ok: true; value: T } | { ok: false; error: DomainRuleError };

export function domainSuccess<T>(value: T): DomainResult<T> {
  return { ok: true, value };
}

export function domainFailure(
  code: DomainRuleErrorCode,
  message: string,
): DomainResult<never> {
  return { ok: false, error: { code, message } };
}

export function validatePlayerRoster(
  game: Game,
  players: readonly Player[],
): DomainResult<readonly [Player, Player]> {
  if (players.length !== MAX_PLAYERS) {
    return domainFailure(
      "invalid_player_count",
      `A partida deve possuir exatamente ${MAX_PLAYERS} jogadores.`,
    );
  }

  const [firstPlayer, secondPlayer] = players;

  if (firstPlayer.id === secondPlayer.id) {
    return domainFailure(
      "duplicate_player",
      "A partida não pode possuir jogadores duplicados.",
    );
  }

  if (players.some((player) => player.gameId !== game.id)) {
    return domainFailure(
      "player_from_another_game",
      "Todos os jogadores devem pertencer à partida.",
    );
  }

  if (!players.some((player) => player.id === game.hostPlayerId)) {
    return domainFailure(
      "host_not_found",
      "O host deve fazer parte dos jogadores da partida.",
    );
  }

  return domainSuccess([firstPlayer, secondPlayer]);
}

export type RoundResolutionKind = "judged" | "single_answer" | "no_answers";

export type RoundResolution = {
  kind: RoundResolutionKind;
  winnerPlayerId: string | null;
  players: readonly Player[];
};

export type ResolveRoundInput = {
  game: Game;
  round: Round;
  players: readonly Player[];
  answers: readonly Answer[];
  judgedWinnerPlayerId?: string | null;
};

export function resolveRound({
  game,
  round,
  players,
  answers,
  judgedWinnerPlayerId = null,
}: ResolveRoundInput): DomainResult<RoundResolution> {
  const rosterResult = validatePlayerRoster(game, players);

  if (!rosterResult.ok) return rosterResult;

  if (game.status !== "judging" || round.status !== game.status) {
    return domainFailure(
      "round_status_mismatch",
      "A rodada só pode ser resolvida durante a fase de julgamento.",
    );
  }

  if (round.gameId !== game.id) {
    return domainFailure(
      "round_from_another_game",
      "A rodada deve pertencer à partida.",
    );
  }

  if (
    round.number !== game.round ||
    round.number < 1 ||
    round.number > MAX_ROUNDS
  ) {
    return domainFailure(
      "invalid_round",
      "A rodada resolvida deve ser a rodada atual da partida.",
    );
  }

  const playerIds = new Set(players.map((player) => player.id));
  const answeredPlayerIds = new Set<string>();

  for (const answer of answers) {
    if (answer.roundId !== round.id) {
      return domainFailure(
        "answer_from_another_round",
        "Todas as respostas devem pertencer à rodada atual.",
      );
    }

    if (!playerIds.has(answer.playerId)) {
      return domainFailure(
        "answer_from_unknown_player",
        "A resposta deve pertencer a um jogador da partida.",
      );
    }

    if (answeredPlayerIds.has(answer.playerId)) {
      return domainFailure(
        "duplicate_answer",
        "Cada jogador pode possuir apenas uma resposta por rodada.",
      );
    }

    answeredPlayerIds.add(answer.playerId);
  }

  const eligiblePlayerIds = answers
    .filter((answer) => answer.text.trim().length > 0)
    .map((answer) => answer.playerId);

  if (eligiblePlayerIds.length === 0) {
    return domainSuccess({
      kind: "no_answers",
      winnerPlayerId: null,
      players: [...players],
    });
  }

  const winnerPlayerId =
    eligiblePlayerIds.length === 1
      ? eligiblePlayerIds[0]
      : judgedWinnerPlayerId;

  if (winnerPlayerId === null || !eligiblePlayerIds.includes(winnerPlayerId)) {
    return domainFailure(
      "invalid_winner",
      "O vencedor deve ser um jogador elegível que respondeu à rodada.",
    );
  }

  const winner = players.find((player) => player.id === winnerPlayerId);

  if (!winner) {
    return domainFailure(
      "invalid_winner",
      "O vencedor deve pertencer à partida.",
    );
  }

  if (winner.score >= MAX_ROUNDS) {
    return domainFailure(
      "score_limit_exceeded",
      "A pontuação não pode exceder o total de rodadas da partida.",
    );
  }

  return domainSuccess({
    kind: eligiblePlayerIds.length === 1 ? "single_answer" : "judged",
    winnerPlayerId,
    players: players.map((player) =>
      player.id === winnerPlayerId
        ? { ...player, score: player.score + 1 }
        : player,
    ),
  });
}
