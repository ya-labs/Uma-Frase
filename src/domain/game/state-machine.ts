import {
  MAX_ROUNDS,
  PAUSABLE_GAME_STATUSES,
  type Game,
  type GameStatus,
  type PausableGameStatus,
  type Player,
} from "./entities";
import {
  domainFailure,
  domainSuccess,
  type DomainResult,
  validatePlayerRoster,
} from "./game-rules";

export type GameEvent =
  | { type: "start"; players: readonly Player[] }
  | { type: "situation_ready" }
  | { type: "open_answers" }
  | { type: "close_answers" }
  | { type: "judgment_succeeded" }
  | { type: "judgment_failed" }
  | { type: "retry_judgment" }
  | { type: "advance_round" }
  | { type: "pause" }
  | { type: "resume" };

const DIRECT_TRANSITIONS = {
  situation_ready: ["generating", "situation"],
  open_answers: ["situation", "answering"],
  close_answers: ["answering", "judging"],
  judgment_succeeded: ["judging", "reveal"],
  judgment_failed: ["judging", "judging_error"],
  retry_judgment: ["judging_error", "judging"],
} as const satisfies Record<
  Exclude<GameEvent["type"], "start" | "advance_round" | "pause" | "resume">,
  readonly [GameStatus, GameStatus]
>;

function isPausableGameStatus(
  status: GameStatus,
): status is PausableGameStatus {
  return (PAUSABLE_GAME_STATUSES as readonly GameStatus[]).includes(status);
}

function transitionDirectly(
  game: Game,
  eventType: keyof typeof DIRECT_TRANSITIONS,
): DomainResult<Game> {
  const [source, target] = DIRECT_TRANSITIONS[eventType];

  if (game.status !== source) {
    return domainFailure(
      "invalid_transition",
      `O evento ${eventType} não é permitido durante a fase ${game.status}.`,
    );
  }

  return domainSuccess({ ...game, status: target });
}

export function transitionGame(
  game: Game,
  event: GameEvent,
): DomainResult<Game> {
  switch (event.type) {
    case "start": {
      if (game.status !== "waiting") {
        return domainFailure(
          "invalid_transition",
          "A partida só pode começar enquanto estiver aguardando jogadores.",
        );
      }

      if (game.round !== 0) {
        return domainFailure(
          "invalid_round",
          "Uma partida nova deve começar antes da primeira rodada.",
        );
      }

      const rosterResult = validatePlayerRoster(game, event.players);

      if (!rosterResult.ok) return rosterResult;

      if (event.players.some((player) => !player.isConnected)) {
        return domainFailure(
          "player_not_connected",
          "Os dois jogadores devem estar conectados para iniciar a partida.",
        );
      }

      return domainSuccess({
        ...game,
        status: "generating",
        round: 1,
        pausedFrom: null,
      });
    }

    case "advance_round": {
      if (game.status !== "reveal") {
        return domainFailure(
          "invalid_transition",
          "A rodada só pode avançar depois da revelação.",
        );
      }

      if (game.round < 1 || game.round > MAX_ROUNDS) {
        return domainFailure(
          "invalid_round",
          "A rodada atual está fora dos limites da partida.",
        );
      }

      if (game.round === game.maxRounds) {
        return domainSuccess({ ...game, status: "finished" });
      }

      return domainSuccess({
        ...game,
        status: "generating",
        round: game.round + 1,
      });
    }

    case "pause": {
      if (!isPausableGameStatus(game.status)) {
        return domainFailure(
          "invalid_transition",
          `A partida não pode ser pausada durante a fase ${game.status}.`,
        );
      }

      return domainSuccess({
        ...game,
        status: "paused",
        pausedFrom: game.status,
      });
    }

    case "resume": {
      if (game.status !== "paused") {
        return domainFailure(
          "invalid_transition",
          "Apenas uma partida pausada pode ser retomada.",
        );
      }

      if (game.pausedFrom === null) {
        return domainFailure(
          "missing_paused_state",
          "A fase anterior deve existir para retomar a partida.",
        );
      }

      return domainSuccess({
        ...game,
        status: game.pausedFrom,
        pausedFrom: null,
      });
    }

    default:
      return transitionDirectly(game, event.type);
  }
}
