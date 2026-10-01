// Opt-in development integration test with synthetic identities only.
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const client = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = Array.from(
  randomBytes(8),
  (byte) => alphabet[byte % alphabet.length],
).join("");
const host = createHash("sha256").update(randomBytes(32)).digest("hex");
const guest = createHash("sha256").update(randomBytes(32)).digest("hex");
let gameId;
async function rpc(name, params) {
  const { data, error } = await client.rpc(name, params);
  assert.equal(error, null, `${name}: ${error?.code}`);
  return data;
}
async function update(table, id, values) {
  const { error } = await client.from(table).update(values).eq("id", id);
  assert.equal(error, null);
}
try {
  [{ game_id: gameId }] = await rpc("create_room_with_host", {
    p_code: code,
    p_host_name: "Synthetic host",
    p_token_hash: host,
  });
  await rpc("join_game", {
    p_code: code,
    p_player_name: "Synthetic guest",
    p_token_hash: guest,
  });
  await rpc("start_game", { p_code: code, p_token_hash: host });
  let previousRevision = 0;
  for (let number = 1; number <= 8; number++) {
    const claims = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        rpc("claim_narrative_work", {
          p_code: code,
          p_token_hash: index % 2 ? host : guest,
          p_retry: false,
        }),
      ),
    );
    const [lease] = claims.filter(Boolean);
    assert.equal(
      claims.filter(Boolean).length,
      1,
      "Exactly one generation reservation.",
    );
    await rpc("finish_narrative_work", {
      p_code: code,
      p_token_hash: host,
      p_work_token: lease.token,
      p_kind: "generate",
      p_result: {
        situation: `Synthetic situation ${number}`,
        updatedStorySummary: `Story ${number}`,
        wordLimit: 5,
      },
    });
    let snapshot = await rpc("get_room_snapshot", {
      p_code: code,
      p_token_hash: host,
    });
    const round = snapshot.state.currentRound;
    assert.equal(round.number, number);
    await update("rounds", round.id, {
      situation_ready_at: new Date(Date.now() - 1000).toISOString(),
    });
    await rpc("tick_round", { p_code: code, p_token_hash: host });
    await Promise.all(
      [host, guest].map((hash) =>
        rpc("submit_round_answer", {
          p_code: code,
          p_token_hash: hash,
          p_round_id: round.id,
          p_text: hash === host ? "Abro a porta." : "Fecho a porta.",
        }),
      ),
    );
    const judgments = await Promise.all(
      Array.from({ length: 6 }, () =>
        rpc("claim_narrative_work", {
          p_code: code,
          p_token_hash: host,
          p_retry: false,
        }),
      ),
    );
    assert.equal(
      judgments.filter(Boolean).length,
      1,
      "Exactly one judge reservation.",
    );
    const [judge] = judgments.filter(Boolean);
    const winner = snapshot.state.players[0].id;
    const params = {
      p_code: code,
      p_token_hash: host,
      p_work_token: judge.token,
      p_kind: "judge",
      p_result: {
        winnerPlayerId: winner,
        reason: "Synthetic reason",
        continuation: "Synthetic continuation",
        nextSituation: "Synthetic next situation",
        updatedStorySummary: `Story after ${number}`,
      },
    };
    await Promise.all(
      Array.from({ length: 8 }, () => rpc("finish_narrative_work", params)),
    );
    snapshot = await rpc("get_room_snapshot", {
      p_code: code,
      p_token_hash: host,
    });
    assert.equal(
      snapshot.state.players[0].score,
      number,
      "No duplicate score.",
    );
    assert.ok(snapshot.state.control.revision > previousRevision);
    previousRevision = snapshot.state.control.revision;
    if (number < 8)
      await Promise.all(
        Array.from({ length: 5 }, () =>
          rpc("advance_round", {
            p_code: code,
            p_token_hash: host,
            p_round_id: round.id,
          }),
        ),
      );
  }
  const lease = await rpc("claim_narrative_work", {
    p_code: code,
    p_token_hash: host,
    p_retry: false,
  });
  assert.equal(lease.kind, "epilogue");
  await rpc("finish_narrative_work", {
    p_code: code,
    p_token_hash: host,
    p_work_token: lease.token,
    p_kind: "epilogue",
    p_result: { epilogue: "Synthetic final epilogue." },
  });
  const [first, second] = await Promise.all(
    [host, guest].map((hash) =>
      rpc("get_room_snapshot", { p_code: code, p_token_hash: hash }),
    ),
  );
  assert.deepEqual(first.state, second.state);
  assert.equal(first.state.game.status, "finished");
  assert.equal(first.state.game.round, 8);
  assert.equal(first.state.control.epilogue, "Synthetic final epilogue.");
  console.log(
    "PASS: eight rounds, concurrent reservations/resolutions/advances, one official score and shared epilogue",
  );
} finally {
  if (gameId) {
    const { error } = await client.from("games").delete().eq("id", gameId);
    assert.equal(error, null, "Could not clean synthetic room.");
  }
}
