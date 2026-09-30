import "server-only";

import type {
  ContractError,
  CreateRoomCommand,
  JoinRoomCommand,
  RoomState,
  SetRoomPresenceCommand,
  StartRoomCommand,
} from "@/domain/contracts";

import {
  generatePlayerToken,
  generateRoomCode,
  hashPlayerToken,
  normalizeRoomCode,
} from "./identity";
import {
  RoomRepositoryError,
  type RoomRepository,
  type RoomSnapshot,
} from "./repository";
import { buildRoomState } from "./state";

const MAX_CODE_ATTEMPTS = 5;

export class RoomServiceError extends Error {
  constructor(
    readonly status: number,
    readonly contractError: ContractError,
  ) {
    super(contractError.message);
    this.name = "RoomServiceError";
  }
}

function mapRepositoryError(error: unknown): never {
  if (!(error instanceof RoomRepositoryError)) {
    throw error;
  }

  if (error.kind === "not_found") {
    throw new RoomServiceError(404, {
      code: "authorization_error",
      message: "Sala não encontrada.",
    });
  }

  if (error.kind === "authorization") {
    throw new RoomServiceError(401, {
      code: "authorization_error",
      message: "A identidade desta aba não autoriza a operação.",
    });
  }

  if (error.kind === "conflict" || error.kind === "collision") {
    throw new RoomServiceError(409, {
      code: "validation_error",
      message: "A operação não é válida para a sala neste momento.",
      issues: [
        {
          path: [],
          message: "Verifique a capacidade e a fase atual da sala.",
        },
      ],
    });
  }

  throw new RoomServiceError(503, {
    code: "external_unavailable",
    message: "Não foi possível acessar a sala agora.",
    retryable: true,
  });
}

export class RoomService {
  constructor(private readonly repository: RoomRepository) {}

  async create(command: CreateRoomCommand): Promise<{
    playerToken: string;
    state: RoomState;
  }> {
    const playerToken = command.playerToken ?? generatePlayerToken();
    const tokenHash = hashPlayerToken(playerToken);

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
      const code = generateRoomCode();

      try {
        const persistedCode = await this.repository.createRoom(
          code,
          command.playerName.trim(),
          tokenHash,
        );
        const snapshot = await this.repository.getSnapshot(
          persistedCode,
          tokenHash,
        );
        return { playerToken, state: buildRoomState(snapshot) };
      } catch (error) {
        if (
          error instanceof RoomRepositoryError &&
          error.kind === "collision" &&
          attempt < MAX_CODE_ATTEMPTS - 1
        ) {
          continue;
        }

        mapRepositoryError(error);
      }
    }

    throw new RoomServiceError(503, {
      code: "external_unavailable",
      message: "Não foi possível reservar um código de sala.",
      retryable: true,
    });
  }

  async join(command: JoinRoomCommand): Promise<{
    playerToken: string;
    state: RoomState;
  }> {
    const playerToken = command.playerToken ?? generatePlayerToken();
    const code = normalizeRoomCode(command.roomCode);
    const tokenHash = hashPlayerToken(playerToken);

    try {
      await this.repository.joinRoom(
        code,
        command.playerName.trim(),
        tokenHash,
      );
      const snapshot = await this.repository.getSnapshot(code, tokenHash);
      return { playerToken, state: buildRoomState(snapshot) };
    } catch (error) {
      mapRepositoryError(error);
    }
  }

  async getState(roomCode: string, playerToken: string): Promise<RoomState> {
    return this.snapshot(roomCode, playerToken).then(buildRoomState);
  }

  async start(command: StartRoomCommand): Promise<RoomState> {
    const code = normalizeRoomCode(command.roomCode);
    const tokenHash = hashPlayerToken(command.playerToken);

    try {
      await this.repository.startRoom(code, tokenHash);
      return buildRoomState(await this.repository.getSnapshot(code, tokenHash));
    } catch (error) {
      mapRepositoryError(error);
    }
  }

  async setPresence(command: SetRoomPresenceCommand): Promise<RoomState> {
    const code = normalizeRoomCode(command.roomCode);
    const tokenHash = hashPlayerToken(command.playerToken);

    try {
      await this.repository.setPresence(code, tokenHash, command.isConnected);
      return buildRoomState(await this.repository.getSnapshot(code, tokenHash));
    } catch (error) {
      mapRepositoryError(error);
    }
  }

  private async snapshot(
    roomCode: string,
    playerToken: string,
  ): Promise<RoomSnapshot> {
    try {
      return await this.repository.getSnapshot(
        normalizeRoomCode(roomCode),
        hashPlayerToken(playerToken),
      );
    } catch (error) {
      mapRepositoryError(error);
    }
  }
}
