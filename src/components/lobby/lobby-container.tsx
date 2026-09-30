"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";

import type { RoomState } from "@/domain";
import {
  createRoomClient,
  RoomClientError,
  type RoomClient,
} from "@/lib/room-client";
import {
  createRoomRealtime,
  type RoomConnectionStatus,
  type RoomRealtime,
} from "@/lib/room-realtime";
import {
  createRoomSessionStore,
  type RoomSessionStore,
} from "@/lib/room-session";

import { Lobby } from "./lobby";

type LobbyContainerProps = {
  roomCode: string;
  client?: Pick<RoomClient, "getRoomState" | "startRoom">;
  realtime?: RoomRealtime;
  sessions?: RoomSessionStore;
};

type LobbyViewState =
  | { status: "loading" }
  | { status: "ready"; state: RoomState }
  | { status: "error"; message: string };

function publicErrorMessage(error: unknown, fallback: string) {
  return error instanceof RoomClientError ? error.message : fallback;
}

const subscribeToStaticSession = () => () => undefined;

export function LobbyContainer({
  roomCode,
  client: providedClient,
  realtime: providedRealtime,
  sessions: providedSessions,
}: LobbyContainerProps) {
  const client = useMemo(
    () => providedClient ?? createRoomClient(),
    [providedClient],
  );
  const realtime = useMemo(
    () => providedRealtime ?? createRoomRealtime(),
    [providedRealtime],
  );
  const sessions = useMemo(
    () => providedSessions ?? createRoomSessionStore(),
    [providedSessions],
  );
  const [view, setView] = useState<LobbyViewState>({ status: "loading" });
  const [connectionStatus, setConnectionStatus] =
    useState<RoomConnectionStatus>("connecting");
  const [starting, setStarting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [notificationsReceived, setNotificationsReceived] = useState(0);
  const [retry, setRetry] = useState(0);
  const playerToken = useSyncExternalStore(
    subscribeToStaticSession,
    () => sessions.getPlayerToken(roomCode),
    () => undefined,
  );

  useEffect(() => {
    if (!playerToken) return;
    const activePlayerToken = playerToken;

    let active = true;
    let refreshing = false;
    let refreshQueued = false;

    async function refreshState() {
      if (refreshing) {
        refreshQueued = true;
        return;
      }

      refreshing = true;

      do {
        refreshQueued = false;

        try {
          const result = await client.getRoomState(roomCode, activePlayerToken);
          if (active) {
            setView({ status: "ready", state: result.state });
            setLastSyncedAt(
              new Date().toLocaleTimeString("pt-BR", { timeStyle: "medium" }),
            );
          }
        } catch (error) {
          if (active) {
            setView({
              status: "error",
              message: publicErrorMessage(
                error,
                "Não foi possível atualizar a sala. Tente novamente.",
              ),
            });
          }
        }
      } while (active && refreshQueued);

      refreshing = false;
    }

    const unsubscribe = realtime.subscribe(
      roomCode,
      (reason) => {
        if (!active) return;
        if (reason === "broadcast") {
          setNotificationsReceived((count) => count + 1);
        }
        void refreshState();
      },
      (status) => {
        if (active) setConnectionStatus(status);
      },
    );

    void refreshState();

    return () => {
      active = false;
      unsubscribe();
    };
  }, [client, playerToken, realtime, retry, roomCode]);

  async function handleStart() {
    if (!playerToken) return;

    setStarting(true);
    setActionError(null);

    try {
      const result = await client.startRoom(roomCode, playerToken);
      setView({ status: "ready", state: result.state });
    } catch (error) {
      setActionError(
        publicErrorMessage(
          error,
          "Não foi possível iniciar a partida. Tente novamente.",
        ),
      );
    } finally {
      setStarting(false);
    }
  }

  function handleRetry() {
    setView({ status: "loading" });
    setConnectionStatus("connecting");
    setRetry((value) => value + 1);
  }

  if (playerToken === undefined) {
    return (
      <main className="room-feedback" aria-busy="true">
        <span className="loading-mark" aria-hidden="true">
          “
        </span>
        <h1>Carregando sala…</h1>
        <p>Recuperando a identidade desta aba.</p>
      </main>
    );
  }

  if (playerToken === null) {
    return (
      <main className="room-feedback">
        <p className="eyebrow">Identidade desta aba</p>
        <h1>Entre novamente nesta sala.</h1>
        <p role="alert">
          Sua identificação desta sala não está disponível nesta aba.
        </p>
        <div className="feedback-actions">
          <Link href="/">Voltar ao início</Link>
        </div>
      </main>
    );
  }

  if (view.status === "loading") {
    return (
      <main className="room-feedback" aria-busy="true">
        <span className="loading-mark" aria-hidden="true">
          “
        </span>
        <h1>Carregando sala…</h1>
        <p>Consultando o estado confirmado pelo servidor.</p>
      </main>
    );
  }

  if (view.status === "error") {
    return (
      <main className="room-feedback">
        <p className="eyebrow">Falha recuperável</p>
        <h1>Não conseguimos abrir esta sala.</h1>
        <p role="alert">{view.message}</p>
        <div className="feedback-actions">
          <button type="button" onClick={handleRetry}>
            Tentar novamente
          </button>
          <Link href="/">Voltar ao início</Link>
        </div>
      </main>
    );
  }

  return (
    <Lobby
      state={view.state}
      connectionStatus={connectionStatus}
      lastSyncedAt={lastSyncedAt}
      notificationsReceived={notificationsReceived}
      starting={starting}
      actionError={actionError}
      onStart={() => void handleStart()}
    />
  );
}
