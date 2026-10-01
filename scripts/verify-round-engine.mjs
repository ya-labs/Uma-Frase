// Opt-in integration test: creates synthetic rooms and removes only their IDs.
// Run: node --env-file=.env.local scripts/verify-round-engine.mjs
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(url && key, "Configure the development Supabase environment first.");
const client = createClient(url, key, { auth: { persistSession: false } });
const publicClient = createClient(
  url,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
);
const ids = [];
async function rpc(name, params) {
  const { data, error } = await client.rpc(name, params);
  assert.equal(error, null, `${name}: ${error?.code ?? "unknown"}`);
  return data;
}
try {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = Array.from(
    randomBytes(8),
    (byte) => alphabet[byte % alphabet.length],
  ).join("");
  const host = createHash("sha256").update(randomBytes(32)).digest("hex");
  const guest = createHash("sha256").update(randomBytes(32)).digest("hex");
  const [{ game_id: id }] = await rpc("create_room_with_host", {
    p_code: code,
    p_host_name: "Synthetic host",
    p_token_hash: host,
  });
  ids.push(id);
  await rpc("join_game", {
    p_code: code,
    p_player_name: "Synthetic guest",
    p_token_hash: guest,
  });
  await rpc("start_game", { p_code: code, p_token_hash: host });
  const round = await rpc("open_round", {
    p_code: code,
    p_token_hash: host,
    p_situation: "Synthetic situation",
    p_summary: "Synthetic summary",
    p_word_limit: 5,
  });
  const { error } = await client
    .from("rounds")
    .update({ situation_ready_at: new Date(Date.now() - 1000).toISOString() })
    .eq("id", round)
    .eq("game_id", id);
  assert.equal(error, null);
  await rpc("tick_round", { p_code: code, p_token_hash: host });
  const send = (hash, text) =>
    rpc("submit_round_answer", {
      p_code: code,
      p_token_hash: hash,
      p_round_id: round,
      p_text: text,
    });
  await Promise.all([
    ...Array.from({ length: 10 }, () => send(host, "Eu abro a porta.")),
    send(guest, "Eu fecho a porta."),
  ]);
  await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      rpc("tick_round", { p_code: code, p_token_hash: i % 2 ? host : guest }),
    ),
  );
  const snapshot = await rpc("get_room_snapshot", {
    p_code: code,
    p_token_hash: host,
  });
  assert.equal(snapshot.state.game.status, "judging");
  assert.equal(snapshot.state.answers.length, 2);
  assert.equal(
    snapshot.state.players.reduce((score, player) => score + player.score, 0),
    0,
  );
  const denied = await publicClient
    .from("answers")
    .select("text")
    .eq("round_id", round);
  assert.ok(denied.error, "Public API must reject private answer reads.");
  const rejected = await client.rpc("submit_round_answer", {
    p_code: code,
    p_token_hash: host,
    p_round_id: round,
    p_text: "Outra resposta.",
  });
  assert.equal(rejected.error?.code, "23514");
  console.log(
    "PASS: concurrent submissions, idempotence, single closure and public answer isolation",
  );
} finally {
  for (const id of ids) {
    const { error } = await client.from("games").delete().eq("id", id);
    assert.equal(error, null, "Could not remove synthetic integration room.");
  }
}
