import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { repositoryError, RoomRepositoryError } from "../rooms/repository";

const workSchema = z
  .object({ token: z.uuid(), kind: z.enum(["generate", "judge", "epilogue"]) })
  .strict();
export type NarrativeWork = z.infer<typeof workSchema>;
export interface NarrativeRepository {
  claim(
    code: string,
    hash: string,
    retry: boolean,
  ): Promise<NarrativeWork | null>;
  finish(
    code: string,
    hash: string,
    work: NarrativeWork,
    result: Record<string, unknown>,
  ): Promise<void>;
  fail(code: string, hash: string, work: NarrativeWork): Promise<void>;
  advance(code: string, hash: string, roundId: string): Promise<void>;
}

export class SupabaseNarrativeRepository implements NarrativeRepository {
  constructor(private readonly client: SupabaseClient) {}
  private async call(
    name: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    const { data, error } = await this.client.rpc(name, params);
    if (error) throw repositoryError(error);
    return data;
  }
  async claim(
    code: string,
    hash: string,
    retry: boolean,
  ): Promise<NarrativeWork | null> {
    const data = await this.call("claim_narrative_work", {
      p_code: code,
      p_token_hash: hash,
      p_retry: retry,
    });
    if (data === null) return null;
    const result = workSchema.safeParse(data);
    if (!result.success)
      throw new RoomRepositoryError("unavailable", "Invalid work reservation.");
    return result.data;
  }
  async finish(
    code: string,
    hash: string,
    work: NarrativeWork,
    result: Record<string, unknown>,
  ): Promise<void> {
    await this.call("finish_narrative_work", {
      p_code: code,
      p_token_hash: hash,
      p_work_token: work.token,
      p_kind: work.kind,
      p_result: result,
    });
  }
  async fail(code: string, hash: string, work: NarrativeWork): Promise<void> {
    await this.call("fail_narrative_work", {
      p_code: code,
      p_token_hash: hash,
      p_work_token: work.token,
      p_kind: work.kind,
    });
  }
  async advance(code: string, hash: string, roundId: string): Promise<void> {
    await this.call("advance_round", {
      p_code: code,
      p_token_hash: hash,
      p_round_id: roundId,
    });
  }
}
