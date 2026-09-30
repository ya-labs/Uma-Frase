import { MAX_ROUNDS } from "../game";
import type { RoomState } from "./state";

export const roomStateFixture: RoomState = {
  public: {
    game: {
      id: "game-1",
      code: "ABC123",
      status: "answering",
      round: 1,
      maxRounds: MAX_ROUNDS,
      pausedFrom: null,
    },
    players: [
      {
        id: "player-1",
        name: "Ana",
        score: 0,
        isConnected: true,
        hasAnswered: true,
      },
      {
        id: "player-2",
        name: "Bruno",
        score: 0,
        isConnected: true,
        hasAnswered: true,
      },
    ],
    currentRound: {
      id: "round-1",
      number: 1,
      situation: "Uma porta se abriu.",
      wordLimit: 5,
      answerDeadlineAt: "2026-09-29T17:00:10.000Z",
      winnerPlayerId: null,
      reason: null,
      continuation: null,
      nextSituation: null,
    },
  },
  private: {
    playerId: "player-1",
    isHost: true,
    answer: {
      id: "answer-1",
      roundId: "round-1",
      text: "Eu atravesso sem olhar para trás.",
      submittedAt: "2026-09-29T17:00:07.000Z",
    },
  },
};
