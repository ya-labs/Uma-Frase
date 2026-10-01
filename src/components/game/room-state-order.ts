import type { GameStatus, RoomState } from "@/domain";

const PHASE_ORDER: Record<GameStatus, number> = {
  waiting: 0,
  generating: 1,
  situation: 2,
  answering: 3,
  judging: 4,
  judging_error: 4,
  reveal: 5,
  paused: 0,
  finished: 6,
};

function effectiveStatus(state: RoomState): GameStatus {
  const { game } = state.public;

  return game.status === "paused" && game.pausedFrom
    ? game.pausedFrom
    : game.status;
}

/**
 * Realtime notifications only tell the client to refetch. A slower, older
 * response must not move the interface back to an earlier confirmed phase.
 */
export function shouldAcceptRoomState(
  current: RoomState,
  incoming: RoomState,
): boolean {
  if (
    current.public.game.id !== incoming.public.game.id ||
    current.private.playerId !== incoming.private.playerId
  ) {
    return false;
  }

  const currentRound = current.public.game.round;
  const incomingRound = incoming.public.game.round;

  if (incomingRound !== currentRound) return incomingRound > currentRound;

  if (
    PHASE_ORDER[effectiveStatus(incoming)] <
    PHASE_ORDER[effectiveStatus(current)]
  ) {
    return false;
  }

  if (current.private.answer && !incoming.private.answer) return false;

  return current.public.players.every((currentPlayer) => {
    const incomingPlayer = incoming.public.players.find(
      (player) => player.id === currentPlayer.id,
    );

    return (
      incomingPlayer !== undefined &&
      incomingPlayer.score >= currentPlayer.score &&
      (!currentPlayer.hasAnswered || incomingPlayer.hasAnswered)
    );
  });
}
