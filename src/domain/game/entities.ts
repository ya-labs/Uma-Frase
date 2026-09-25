export const MAX_PLAYERS = 2 as const;
export const MAX_ROUNDS = 8 as const;
export const ANSWER_DURATION_SECONDS = 10 as const;
export const MIN_WORD_LIMIT = 1 as const;
export const MAX_WORD_LIMIT = 15 as const;

export const GAME_STATUSES = [
  "waiting",
  "generating",
  "situation",
  "answering",
  "judging",
  "judging_error",
  "reveal",
  "paused",
  "finished",
] as const;

export const PAUSABLE_GAME_STATUSES = [
  "generating",
  "situation",
  "answering",
  "judging",
  "judging_error",
  "reveal",
] as const;

export type GameStatus = (typeof GAME_STATUSES)[number];
export type PausableGameStatus = (typeof PAUSABLE_GAME_STATUSES)[number];

export type Game = {
  id: string;
  code: string;
  status: GameStatus;
  hostPlayerId: string;
  round: number;
  maxRounds: typeof MAX_ROUNDS;
  storySummary: string;
  pausedFrom: PausableGameStatus | null;
  createdAt: string;
};

export type Player = {
  id: string;
  gameId: string;
  name: string;
  score: number;
  isConnected: boolean;
};

export type Round = {
  id: string;
  gameId: string;
  number: number;
  status: GameStatus;
  situation: string;
  wordLimit: number;
  answerDeadlineAt: string | null;
  winnerPlayerId: string | null;
  reason: string | null;
  continuation: string | null;
  nextSituation: string | null;
};

export type Answer = {
  id: string;
  roundId: string;
  playerId: string;
  text: string;
  submittedAt: string;
};
