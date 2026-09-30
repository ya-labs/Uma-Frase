import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { roomStateFixture } from "@/domain/contracts/fixtures";
import type { RoomClient } from "@/lib/room-client";
import type { RoomSessionStore } from "@/lib/room-session";

import { RoomAccessContainer } from "./room-access-container";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(cleanup);

describe("integração dos formulários com a sessão da aba", () => {
  it("salva a identidade recebida e navega depois da criação confirmada", async () => {
    const client = {
      createRoom: vi.fn().mockResolvedValue({
        playerToken: "opaque-token",
        state: roomStateFixture,
      }),
      joinRoom: vi.fn(),
    } satisfies Pick<RoomClient, "createRoom" | "joinRoom">;
    const sessions = {
      savePlayerToken: vi.fn(),
      getPlayerToken: vi.fn(),
      removePlayerToken: vi.fn(),
    } satisfies RoomSessionStore;
    const navigateToRoom = vi.fn();
    render(
      <RoomAccessContainer
        client={client}
        sessions={sessions}
        navigateToRoom={navigateToRoom}
      />,
    );

    fireEvent.change(screen.getAllByLabelText("Seu nome")[0], {
      target: { value: "Ana" },
    });
    fireEvent.click(screen.getByRole("button", { name: /criar sala/i }));

    await waitFor(() => {
      expect(sessions.savePlayerToken).toHaveBeenCalledWith(
        "ABC123",
        "opaque-token",
      );
      expect(navigateToRoom).toHaveBeenCalledWith("ABC123");
    });
    expect(document.body.textContent).not.toContain("opaque-token");
  });
});
