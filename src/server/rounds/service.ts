import "server-only";

import type {
  RoomState,
  SubmitAnswerCommand,
  ResolveRoomCommand,
  StartRoomCommand,
} from "@/domain/contracts";
import { hashPlayerToken, normalizeRoomCode } from "../rooms/identity";
import type { RoomRepository } from "../rooms/repository";
import {
  RoomService,
  mapRepositoryError,
  RoomServiceError,
} from "../rooms/service";
import type { RoundRepository } from "./repository";

export class RoundService extends RoomService {
  constructor(
    rooms: RoomRepository,
    protected readonly rounds: RoundRepository,
  ) {
    super(rooms);
  }

  override async getState(code: string, token: string): Promise<RoomState> {
    try {
      await this.rounds.tick(normalizeRoomCode(code), hashPlayerToken(token));
    } catch (error) {
      mapRepositoryError(error);
    }
    return super.getState(code, token);
  }

  override async start(command: StartRoomCommand): Promise<RoomState> {
    await super.start(command);
    return this.getState(command.roomCode, command.playerToken);
  }

  async submit(command: SubmitAnswerCommand): Promise<RoomState> {
    try {
      await this.rounds.submit(
        normalizeRoomCode(command.roomCode),
        hashPlayerToken(command.playerToken),
        command.roundId,
        command.text.trim(),
      );
    } catch (error) {
      mapRepositoryError(error);
    }
    return this.getState(command.roomCode, command.playerToken);
  }

  async resolve(command: ResolveRoomCommand): Promise<RoomState> {
    const state = await super.getState(command.roomCode, command.playerToken);
    if (state.public.currentRound?.id !== command.roundId) {
      throw new RoomServiceError(409, {
        code: "validation_error",
        message: "A rodada não é a rodada atual.",
        issues: [],
      });
    }
    return this.getState(command.roomCode, command.playerToken);
  }
}
