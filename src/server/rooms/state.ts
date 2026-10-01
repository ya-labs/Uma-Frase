import "server-only";

import { roomStateSchema, type RoomState } from "@/domain/contracts";

import type { RoomSnapshot } from "./repository";

const REVEAL_STATUSES = new Set(["reveal", "finished"]);
const ROUND_DETAILS_STATUSES = new Set([
  "answering",
  "judging",
  "judging_error",
  "reveal",
  "finished",
]);

export function buildRoomState(snapshot: RoomSnapshot): RoomState {
  const { game, players, currentRound, answers, control } = snapshot.state;
  const effectiveStatus =
    game.status === "paused" ? game.pausedFrom : game.status;
  const revealIsPublic =
    effectiveStatus !== null && REVEAL_STATUSES.has(effectiveStatus);
  const roundDetailsArePublic =
    effectiveStatus !== null && ROUND_DETAILS_STATUSES.has(effectiveStatus);
  const ownAnswer = answers.find(
    (answer) => answer.playerId === snapshot.playerId,
  );

  return roomStateSchema.parse({
    public: {
      game: {
        id: game.id,
        code: game.code,
        status: game.status,
        round: game.round,
        maxRounds: game.maxRounds,
        pausedFrom: game.pausedFrom,
        ...(game.status === "finished"
          ? {
              storySummary: game.storySummary,
              epilogue: control?.epilogue ?? "",
            }
          : {}),
      },
      players: players.map((player) => ({
        id: player.id,
        name: player.name,
        score: player.score,
        isConnected: player.isConnected,
        hasAnswered: answers.some((answer) => answer.playerId === player.id),
      })),
      ...(control
        ? {
            control: {
              revision: control.revision,
              canRetry: control.canRetry,
              workError: control.workError,
            },
          }
        : {}),
      currentRound: currentRound
        ? {
            id: currentRound.id,
            number: currentRound.number,
            situation: currentRound.situation,
            wordLimit: roundDetailsArePublic ? currentRound.wordLimit : null,
            answerDeadlineAt: roundDetailsArePublic
              ? currentRound.answerDeadlineAt
              : null,
            winnerPlayerId: revealIsPublic ? currentRound.winnerPlayerId : null,
            reason: revealIsPublic ? currentRound.reason : null,
            continuation: revealIsPublic ? currentRound.continuation : null,
            nextSituation: revealIsPublic ? currentRound.nextSituation : null,
            ...(revealIsPublic
              ? {
                  answers: answers.map((answer) => ({
                    playerId: answer.playerId,
                    text: answer.text,
                  })),
                }
              : {}),
          }
        : null,
    },
    private: {
      playerId: snapshot.playerId,
      isHost: game.hostPlayerId === snapshot.playerId,
      answer: ownAnswer
        ? {
            id: ownAnswer.id,
            roundId: ownAnswer.roundId,
            text: ownAnswer.text,
            submittedAt: ownAnswer.submittedAt,
          }
        : null,
    },
  });
}
