import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { repositoryError } from "../rooms/repository";

export interface RoundRepository {
  open(
    code: string,
    hash: string,
    situation: string,
    summary: string,
    limit: number,
  ): Promise<void>;
  tick(code: string, hash: string): Promise<void>;
  submit(
    code: string,
    hash: string,
    roundId: string,
    text: string,
  ): Promise<void>;
}

export class SupabaseRoundRepository implements RoundRepository {
  constructor(private readonly client: SupabaseClient) {}

  private async call(
    name: string,
    params: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await this.client.rpc(name, params);
    if (error) throw repositoryError(error);
  }

  open(
    code: string,
    hash: string,
    situation: string,
    summary: string,
    limit: number,
  ): Promise<void> {
    return this.call("open_round", {
      p_code: code,
      p_token_hash: hash,
      p_situation: situation,
      p_summary: summary,
      p_word_limit: limit,
    });
  }

  tick(code: string, hash: string): Promise<void> {
    return this.call("tick_round", { p_code: code, p_token_hash: hash });
  }

  submit(
    code: string,
    hash: string,
    roundId: string,
    text: string,
  ): Promise<void> {
    return this.call("submit_round_answer", {
      p_code: code,
      p_token_hash: hash,
      p_round_id: roundId,
      p_text: text,
    });
  }
}
