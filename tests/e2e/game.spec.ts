import {
  test,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";

const gameIds: string[] = [];
const contexts: BrowserContext[] = [];
const admin = () =>
  createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

test.afterEach(async () => {
  for (const context of contexts.splice(0)) await context.close();
  for (const id of gameIds.splice(0)) {
    const { error } = await admin().from("games").delete().eq("id", id);
    expect(error, "Synthetic room cleanup").toBeNull();
  }
});

async function pair(browser: Browser) {
  const desktop = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  contexts.push(desktop, mobile);
  const host = await desktop.newPage();
  const guest = await mobile.newPage();
  await host.goto("/");
  await host.getByLabel("Seu nome").nth(0).fill("Pessoa A sintética");
  const created = host.waitForResponse(
    (response) =>
      response.url().endsWith("/api/rooms") &&
      response.request().method() === "POST",
  );
  await host.getByRole("button", { name: "Criar sala", exact: true }).click();
  const payload = await (await created).json();
  expect(payload.ok).toBe(true);
  gameIds.push(payload.data.state.public.game.id);
  const code: string = payload.data.state.public.game.code;
  await expect(host).toHaveURL(new RegExp(`/room/${code}$`));
  await guest.goto("/");
  await guest.getByLabel("Código da sala").fill(code);
  await guest.getByLabel("Seu nome").nth(1).fill("Pessoa B sintética");
  await guest
    .getByRole("button", { name: "Entrar na sala", exact: true })
    .click();
  await expect(guest).toHaveURL(new RegExp(`/room/${code}$`));
  await expect(
    host.getByRole("button", { name: /iniciar partida/i }),
  ).toBeEnabled();
  return {
    host,
    guest,
    code,
    desktop,
    mobile,
    gameId: payload.data.state.public.game.id as string,
  };
}

async function state(page: Page, code: string) {
  const token = await page.evaluate(
    (room) => sessionStorage.getItem(`uma-frase:room:${room}:player-token`),
    code,
  );
  const response = await page.request.get(`/api/rooms/${code}/state`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBe(true);
  const result = await response.json();
  expect(result.ok).toBe(true);
  return result.data.state;
}

async function start(host: Page, guest: Page) {
  await host.getByRole("button", { name: /iniciar partida/i }).click();
  await expect(
    host.getByRole("textbox", { name: "Sua resposta" }),
  ).toBeEnabled();
  await expect(
    guest.getByRole("textbox", { name: "Sua resposta" }),
  ).toBeEnabled();
}

test("duas janelas completam oito rodadas com teclado, mobile, privacidade e epílogo", async ({
  browser,
}, info) => {
  const { host, guest, code } = await pair(browser);
  await start(host, guest);
  for (let number = 1; number <= 8; number++) {
    await expect(
      host.getByRole("heading", { name: `Rodada ${number} de 8`, exact: true }),
    ).toBeVisible();
    const hostField = host.getByRole("textbox", { name: "Sua resposta" });
    const guestField = guest.getByRole("textbox", { name: "Sua resposta" });
    await expect(hostField).toBeEnabled();
    await expect(guestField).toBeEnabled();
    if (number === 1) {
      await hostField.fill(Array(16).fill("palavra").join(" "));
      await expect(
        host.getByRole("button", { name: /enviar resposta/i }),
      ).toBeDisabled();
    }
    await hostField.fill("Abro.");
    await hostField.press("Control+Enter");
    await expect(host.getByText("Agora é só aguardar.")).toBeVisible();
    const privateState = await state(guest, code);
    expect(privateState.public.currentRound).not.toHaveProperty("answers");
    expect(JSON.stringify(privateState)).not.toContain("Abro.");
    await guestField.fill("Espero.");
    await guest.getByRole("button", { name: /enviar resposta/i }).tap();
    if (number < 8) {
      await expect(
        host.getByRole("button", { name: "Próxima rodada", exact: true }),
      ).toBeEnabled();
      await expect(
        guest.getByText("Respostas reveladas", { exact: true }),
      ).toBeVisible();
      if (number === 1) {
        const results = await new AxeBuilder({ page: guest })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect(results.violations).toEqual([]);
        await guest.screenshot({
          path: info.outputPath("mobile-result.png"),
          fullPage: true,
        });
      }
      await host
        .getByRole("button", { name: "Próxima rodada", exact: true })
        .click();
    }
  }
  await expect(
    host.getByRole("heading", { name: "Fim de jogo.", exact: true }),
  ).toBeVisible();
  await expect(
    guest.getByRole("heading", { name: "Fim de jogo.", exact: true }),
  ).toBeVisible();
  await expect(
    guest.getByRole("heading", { name: "Epílogo", exact: true }),
  ).toBeVisible();
  const [first, second] = await Promise.all([
    state(host, code),
    state(guest, code),
  ]);
  expect(first.public.game).toEqual(second.public.game);
  expect(first.public.players).toEqual(second.public.players);
  expect(first.public.currentRound).toEqual(second.public.currentRound);
  expect(first.public.game.round).toBe(8);
  expect(
    first.public.players.reduce(
      (sum: number, player: { score: number }) => sum + player.score,
      0,
    ),
  ).toBe(8);
  expect(
    await guest.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await host.reload();
  await expect(
    host.getByRole("heading", { name: "Epílogo", exact: true }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page: host })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await host.screenshot({
    path: info.outputPath("desktop-ending.png"),
    fullPage: true,
  });
});

test("desconexão pausa no servidor e recarga preserva a resposta confirmada", async ({
  browser,
}) => {
  const { host, guest, code, mobile } = await pair(browser);
  await start(host, guest);
  await host.getByRole("textbox", { name: "Sua resposta" }).fill("Abro.");
  await host.getByRole("button", { name: /enviar resposta/i }).click();
  await expect(host.getByText("Agora é só aguardar.")).toBeVisible();
  await mobile.setOffline(true);
  await expect(
    host.getByText("Partida pausada.", { exact: true }),
  ).toBeVisible();
  const paused = await state(host, code);
  expect(paused.public.game.pausedFrom).toBe("answering");
  expect(paused.private.answer.text).toBe("Abro.");
  await host.reload();
  await expect(
    host.getByText("Partida pausada.", { exact: true }),
  ).toBeVisible();
  expect((await state(host, code)).public.control.remainingAnswerMs).toBe(
    paused.public.control.remainingAnswerMs,
  );
  await mobile.setOffline(false);
  await guest.reload();
  const field = guest.getByRole("textbox", { name: "Sua resposta" });
  await expect(field).toBeEnabled();
  await field.fill("Espero.");
  await guest.getByRole("button", { name: /enviar resposta/i }).click();
  await expect(
    host.getByText("Respostas reveladas", { exact: true }),
  ).toBeVisible();
  const result = await state(host, code);
  expect(result.public.currentRound.answers).toHaveLength(2);
});

test("falha narrativa conserva respostas privadas e só permite retry autorizado", async ({
  browser,
}) => {
  const { host, guest, code, gameId } = await pair(browser);
  await start(host, guest);
  let changed = await admin()
    .from("games")
    .update({
      work_error: true,
      work_until: new Date(Date.now() + 10000).toISOString(),
    })
    .eq("id", gameId);
  expect(changed.error).toBeNull();
  await host.getByRole("textbox", { name: "Sua resposta" }).fill("Abro.");
  await host.getByRole("button", { name: /enviar resposta/i }).click();
  await guest.getByRole("textbox", { name: "Sua resposta" }).fill("Espero.");
  await guest.getByRole("button", { name: /enviar resposta/i }).click();
  const before = await state(host, code);
  changed = await admin()
    .from("rounds")
    .update({ status: "judging_error" })
    .eq("id", before.public.currentRound.id)
    .eq("game_id", gameId);
  expect(changed.error).toBeNull();
  changed = await admin()
    .from("games")
    .update({
      status: "judging_error",
      work_error: true,
      work_until: new Date(Date.now() + 3000).toISOString(),
    })
    .eq("id", gameId);
  expect(changed.error).toBeNull();
  await expect(host.getByText("O julgamento não foi concluído.")).toBeVisible();
  expect((await state(guest, code)).public.currentRound).not.toHaveProperty(
    "answers",
  );
  await expect(
    host.getByRole("button", { name: /aguardando liberação/i }),
  ).toBeDisabled();
  await host.reload();
  await expect(host.getByText(/“Abro\.”/)).toBeVisible();
  await expect(
    host.getByRole("button", {
      name: "Tentar novamente o narrador",
      exact: true,
    }),
  ).toBeEnabled();
  await host
    .getByRole("button", { name: "Tentar novamente o narrador", exact: true })
    .click();
  await expect(
    guest.getByText("Respostas reveladas", { exact: true }),
  ).toBeVisible();
});
