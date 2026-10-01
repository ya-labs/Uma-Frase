import "server-only";

import {
  initialSituationResultSchema,
  createEligibleJudgeResultSchema,
  epilogueResultSchema,
  type RoomState,
  type StartRoomCommand,
  type ResolveRoomCommand,
} from "@/domain/contracts";
import type { NarrativeProvider } from "../ai/contracts";
import { hashPlayerToken, normalizeRoomCode } from "../rooms/identity";
import type { RoomRepository } from "../rooms/repository";
import { mapRepositoryError } from "../rooms/service";
import { buildRoomState } from "../rooms/state";
import { RoundService } from "./service";
import type { RoundRepository } from "./repository";
import type { NarrativeRepository } from "./narrative-repository";
import { drawWordLimit } from "./word-limit";

export class NarrativeService extends RoundService {
  constructor(
    private readonly narrativeRooms: RoomRepository,
    rounds: RoundRepository,
    private readonly work: NarrativeRepository,
    private readonly provider: () => NarrativeProvider,
  ) {
    super(narrativeRooms, rounds);
  }

  override async getState(code: string, token: string): Promise<RoomState> {
    await super.getState(code, token);
    return this.progress(code, token, false);
  }

  private async progress(
    rawCode: string,
    token: string,
    retry: boolean,
  ): Promise<RoomState> {
    const code = normalizeRoomCode(rawCode);
    const hash = hashPlayerToken(token);
    try {
      // One bounded provider call per request fits the serverless timeout.
      for (let pass = 0; pass < 1; pass++) {
        const reserved = await this.work.claim(code, hash, retry && pass === 0);
        if (!reserved) break;
        try {
          const snapshot = await this.narrativeRooms.getSnapshot(code, hash);
          const { game, currentRound, answers } = snapshot.state;
          const provider = this.provider();
          let result: Record<string, unknown>;
          if (reserved.kind === "generate") {
            const generated = initialSituationResultSchema.parse(
              await provider.generateSituation({
                roundNumber: game.round,
                storySummary: game.storySummary.slice(-6000),
                suggestedSituation:
                  game.round > 1
                    ? (snapshot.state.control?.suggestedSituation ?? null)
                    : null,
              }),
            );
            result = { ...generated, wordLimit: drawWordLimit() };
          } else if (reserved.kind === "judge") {
            if (!currentRound || answers.length !== 2)
              throw new Error("Invalid judging state.");
            result = createEligibleJudgeResultSchema(
              answers.map((answer) => answer.playerId),
            ).parse(
              await provider.judgeRound({
                roundNumber: game.round,
                storySummary: game.storySummary.slice(-6000),
                situation: currentRound.situation,
                wordLimit: currentRound.wordLimit,
                answers: answers.map((answer) => ({
                  playerId: answer.playerId,
                  text: answer.text,
                })),
              }),
            );
          } else {
            result = epilogueResultSchema.parse(
              await provider.generateEpilogue({
                storySummary: game.storySummary.slice(-6000),
              }),
            );
          }
          await this.work.finish(code, hash, reserved, result);
        } catch {
          // Persist only a generic failure flag, never SDK errors, prompts or keys.
          await this.work.fail(code, hash, reserved);
          break;
        }
      }
      return buildRoomState(await this.narrativeRooms.getSnapshot(code, hash));
    } catch (error) {
      mapRepositoryError(error);
    }
  }

  async retry(command: StartRoomCommand): Promise<RoomState> {
    // RPC checks eligibility, cooldown and reservation atomically.
    return this.progress(command.roomCode, command.playerToken, true);
  }

  async advance(command: ResolveRoomCommand): Promise<RoomState> {
    try {
      await this.work.advance(
        normalizeRoomCode(command.roomCode),
        hashPlayerToken(command.playerToken),
        command.roundId,
      );
    } catch (error) {
      mapRepositoryError(error);
    }
    return this.getState(command.roomCode, command.playerToken);
  }
}
