"use client";

import { useState, type FormEvent } from "react";

import {
  createRoomCommandSchema,
  joinRoomCommandSchema,
  type CreateRoomCommand,
  type JoinRoomCommand,
} from "@/domain";
import { RoomClientError } from "@/lib/room-client";

export type RoomAccessOperations = {
  createRoom(command: CreateRoomCommand): Promise<void>;
  joinRoom(command: JoinRoomCommand): Promise<void>;
};

type RoomAccessProps = {
  operations?: RoomAccessOperations;
};

type FormStatus = {
  pending: boolean;
  error: string | null;
};

const initialStatus: FormStatus = { pending: false, error: null };

const unavailableOperations: RoomAccessOperations = {
  async createRoom() {
    throw new Error("Não foi possível criar a sala agora. Tente novamente.");
  },
  async joinRoom() {
    throw new Error("Não foi possível entrar na sala agora. Tente novamente.");
  },
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof RoomClientError ? error.message : fallback;
}

export function RoomAccess({
  operations = unavailableOperations,
}: RoomAccessProps) {
  const [createStatus, setCreateStatus] = useState(initialStatus);
  const [joinStatus, setJoinStatus] = useState(initialStatus);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const command = createRoomCommandSchema.safeParse({
      playerName: form.get("create-player-name"),
    });

    if (!command.success) {
      setCreateStatus({ pending: false, error: "Informe seu nome." });
      return;
    }

    setCreateStatus({ pending: true, error: null });

    try {
      await operations.createRoom(command.data);
      setCreateStatus(initialStatus);
    } catch (error) {
      setCreateStatus({
        pending: false,
        error: errorMessage(
          error,
          "Não foi possível criar a sala agora. Tente novamente.",
        ),
      });
    }
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const command = joinRoomCommandSchema.safeParse({
      roomCode: form.get("room-code"),
      playerName: form.get("join-player-name"),
    });

    if (!command.success) {
      const invalidCode = command.error.issues.some(
        (issue) => issue.path[0] === "roomCode",
      );
      const missingCode = !String(form.get("room-code") ?? "").trim();

      setJoinStatus({
        pending: false,
        error: invalidCode
          ? missingCode
            ? "Informe o código da sala."
            : "Código de sala inválido."
          : "Informe seu nome.",
      });
      return;
    }

    setJoinStatus({ pending: true, error: null });

    try {
      await operations.joinRoom(command.data);
      setJoinStatus(initialStatus);
    } catch (error) {
      setJoinStatus({
        pending: false,
        error: errorMessage(
          error,
          "Não foi possível entrar na sala agora. Tente novamente.",
        ),
      });
    }
  }

  return (
    <div className="home-shell">
      <header className="hero" aria-labelledby="game-title">
        <a className="brand" href="#game-title" aria-label="Uma Frase, início">
          <span className="brand-mark" aria-hidden="true">
            “
          </span>
          Uma Frase
        </a>

        <div className="hero-copy">
          <p className="eyebrow">Uma história. Duas pessoas. Oito rodadas.</p>
          <h1 id="game-title">
            Sua melhor ideia cabe em <em>uma frase.</em>
          </h1>
          <p className="game-rule">
            Responda à situação usando apenas o número de palavras permitido. A
            IA escolhe a melhor resposta e continua a história.
          </p>
        </div>

        <ol className="how-it-works" aria-label="Como funciona">
          <li>
            <span>01</span>
            Crie ou entre em uma sala
          </li>
          <li>
            <span>02</span>
            Escreva antes do tempo acabar
          </li>
          <li>
            <span>03</span>
            Descubra qual frase venceu
          </li>
        </ol>
      </header>

      <section className="access-panel" aria-labelledby="play-title">
        <div className="access-heading">
          <p className="eyebrow">Comece agora</p>
          <h2 id="play-title">Como você quer jogar?</h2>
          <p>Sem cadastro. Escolha uma opção para encontrar seu adversário.</p>
        </div>

        <div className="access-grid">
          <form
            className="access-card access-card-primary"
            onSubmit={handleCreate}
            aria-busy={createStatus.pending}
          >
            <div>
              <span className="card-number" aria-hidden="true">
                01
              </span>
              <h3>Criar uma sala</h3>
              <p>Você recebe o código para convidar a outra pessoa.</p>
            </div>

            <div className="field">
              <label htmlFor="create-player-name">Seu nome</label>
              <input
                id="create-player-name"
                name="create-player-name"
                type="text"
                autoComplete="name"
                placeholder="Como vamos chamar você?"
                disabled={createStatus.pending}
                aria-describedby={
                  createStatus.error ? "create-error" : undefined
                }
              />
            </div>

            {createStatus.error ? (
              <p className="form-error" id="create-error" role="alert">
                {createStatus.error}
              </p>
            ) : null}

            <button type="submit" disabled={createStatus.pending}>
              {createStatus.pending ? "Criando sala…" : "Criar sala"}
              <span aria-hidden="true">→</span>
            </button>
          </form>

          <form
            className="access-card"
            onSubmit={handleJoin}
            aria-busy={joinStatus.pending}
          >
            <div>
              <span className="card-number" aria-hidden="true">
                02
              </span>
              <h3>Entrar por código</h3>
              <p>Use o código enviado por quem criou a sala.</p>
            </div>

            <div className="field">
              <label htmlFor="room-code">Código da sala</label>
              <input
                className="room-code-input"
                id="room-code"
                name="room-code"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="Digite o código"
                disabled={joinStatus.pending}
                aria-describedby={joinStatus.error ? "join-error" : undefined}
              />
            </div>

            <div className="field">
              <label htmlFor="join-player-name">Seu nome</label>
              <input
                id="join-player-name"
                name="join-player-name"
                type="text"
                autoComplete="name"
                placeholder="Como vamos chamar você?"
                disabled={joinStatus.pending}
                aria-describedby={joinStatus.error ? "join-error" : undefined}
              />
            </div>

            {joinStatus.error ? (
              <p className="form-error" id="join-error" role="alert">
                {joinStatus.error}
              </p>
            ) : null}

            <button type="submit" disabled={joinStatus.pending}>
              {joinStatus.pending ? "Entrando na sala…" : "Entrar na sala"}
              <span aria-hidden="true">→</span>
            </button>
          </form>
        </div>
      </section>

      <footer>
        <span>Uma Frase</span>
        <p>Histórias inesperadas começam com poucas palavras.</p>
      </footer>
    </div>
  );
}
