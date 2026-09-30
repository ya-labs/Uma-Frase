import "server-only";

import type {
  InitialSituationInput,
  InitialSituationResult,
  JudgeInput,
  JudgeResult,
} from "@/domain/contracts";

export interface SituationGenerator {
  generateInitialSituation(
    input: InitialSituationInput,
  ): Promise<InitialSituationResult>;
}

export interface RoundJudge {
  judgeRound(input: JudgeInput): Promise<JudgeResult>;
}
