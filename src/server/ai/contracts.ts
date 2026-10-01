import "server-only";

import type {
  InitialSituationInput,
  InitialSituationResult,
  JudgeInput,
  JudgeResult,
  SituationInput,
  EpilogueInput,
  EpilogueResult,
} from "@/domain/contracts";

export interface SituationGenerator {
  generateInitialSituation(
    input: InitialSituationInput,
  ): Promise<InitialSituationResult>;
}

export interface RoundJudge {
  judgeRound(input: JudgeInput): Promise<JudgeResult>;
}

export interface NarrativeProvider extends RoundJudge {
  generateSituation(input: SituationInput): Promise<InitialSituationResult>;
  generateEpilogue(input: EpilogueInput): Promise<EpilogueResult>;
}
