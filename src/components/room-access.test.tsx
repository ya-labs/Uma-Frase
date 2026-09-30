import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RoomAccess, type RoomAccessOperations } from "./room-access";
import { RoomClientError } from "@/lib/room-client";

afterEach(cleanup);

function operations(
  overrides: Partial<RoomAccessOperations> = {},
): RoomAccessOperations {
  return {
    createRoom: vi.fn().mockResolvedValue(undefined),
    joinRoom: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("RoomAccess", () => {
  it("apresenta a regra principal e as duas ações", () => {
    render(<RoomAccess operations={operations()} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Sua melhor ideia cabe em uma frase.",
      }),
    ).toBeDefined();
    expect(
      screen.getByText(/responda à situação usando apenas/i),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: /criar sala/i })).toBeDefined();
    expect(
      screen.getByRole("button", { name: /entrar na sala/i }),
    ).toBeDefined();
  });

  it("valida a criação antes de chamar a operação", () => {
    const roomOperations = operations();
    render(<RoomAccess operations={roomOperations} />);

    fireEvent.click(screen.getByRole("button", { name: /criar sala/i }));

    expect(screen.getByRole("alert").textContent).toBe("Informe seu nome.");
    expect(roomOperations.createRoom).not.toHaveBeenCalled();
  });

  it("anuncia um código inválido sem tentar entrar na sala", () => {
    const roomOperations = operations();
    render(<RoomAccess operations={roomOperations} />);

    fireEvent.change(screen.getByLabelText("Código da sala"), {
      target: { value: "ABC123" },
    });
    fireEvent.change(screen.getAllByLabelText("Seu nome")[1], {
      target: { value: "Bruno" },
    });
    fireEvent.click(screen.getByRole("button", { name: /entrar na sala/i }));

    expect(screen.getByRole("alert").textContent).toBe(
      "Código de sala inválido.",
    );
    expect(roomOperations.joinRoom).not.toHaveBeenCalled();
  });

  it("envia os valores normalizados pelos contratos públicos", async () => {
    const roomOperations = operations();
    render(<RoomAccess operations={roomOperations} />);

    fireEvent.change(screen.getByLabelText("Código da sala"), {
      target: { value: "  abcd2345  " },
    });
    fireEvent.change(screen.getAllByLabelText("Seu nome")[1], {
      target: { value: "  Bruno  " },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: /entrar na sala/i }).closest("form")!,
    );

    await waitFor(() => {
      expect(roomOperations.joinRoom).toHaveBeenCalledWith({
        roomCode: "ABCD2345",
        playerName: "Bruno",
      });
    });
  });

  it("mantém o estado de carregamento enquanto cria a sala", async () => {
    let finishRequest: (() => void) | undefined;
    const pendingRequest = new Promise<void>((resolve) => {
      finishRequest = resolve;
    });
    const roomOperations = operations({
      createRoom: vi.fn().mockReturnValue(pendingRequest),
    });
    render(<RoomAccess operations={roomOperations} />);

    fireEvent.change(screen.getAllByLabelText("Seu nome")[0], {
      target: { value: "Ana" },
    });
    fireEvent.click(screen.getByRole("button", { name: /criar sala/i }));

    const pendingButton = await screen.findByRole("button", {
      name: /criando sala/i,
    });
    expect((pendingButton as HTMLButtonElement).disabled).toBe(true);
    expect(pendingButton.closest("form")?.getAttribute("aria-busy")).toBe(
      "true",
    );

    finishRequest?.();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /criar sala/i })).toBeDefined();
    });
  });

  it("anuncia uma falha de entrada e permite tentar novamente", async () => {
    const roomOperations = operations({
      joinRoom: vi
        .fn()
        .mockRejectedValue(
          new RoomClientError("validation", "Sala não encontrada."),
        ),
    });
    render(<RoomAccess operations={roomOperations} />);

    fireEvent.change(screen.getByLabelText("Código da sala"), {
      target: { value: "ABCD2345" },
    });
    fireEvent.change(screen.getAllByLabelText("Seu nome")[1], {
      target: { value: "Bruno" },
    });
    fireEvent.click(screen.getByRole("button", { name: /entrar na sala/i }));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Sala não encontrada.",
    );
    expect(
      (
        screen.getByRole("button", {
          name: /entrar na sala/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
});
