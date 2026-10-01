"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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

import { RoundExperience } from "../game/round-experience";
import { shouldAcceptRoomState } from "../game/room-state-order";
import { Lobby } from "./lobby";

type LobbyContainerProps = {
  roomCode: string;
  client?: Pick<RoomClient, "getRoomState" | "startRoom"> &
    Partial<
      Pick<
        RoomClient,
        "submitAnswer" | "setPresence" | "advanceRoom" | "retryNarrative"
      >
    >;
  realtime?: RoomRealtime;
  sessions?: RoomSessionStore;
};

type LobbyViewState =
  | { status: "loading" }
  | { status: "ready"; state: RoomState; receivedAt: number }
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
  const [answerSubmitting, setAnswerSubmitting] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState<{
    roundId: string;
    message: string;
    retryable: boolean;
  } | null>(null);
  const answerRequestsInFlight = useRef(new Set<string>());
  const actionRequestInFlight = useRef(false);
  const [gameActionPending, setGameActionPending] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
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
          const receivedAt = Date.now();
          if (active) {
            setView((currentView) => {
              if (
                currentView.status === "ready" &&
                !shouldAcceptRoomState(currentView.state, result.state)
              ) {
                return currentView;
              }

              return { status: "ready", state: result.state, receivedAt };
            });
            setLastSyncedAt(
              new Date().toLocaleTimeString("pt-BR", { timeStyle: "medium" }),
            );
            setSyncError(null);
          }
        } catch (error) {
          if (active) {
            const message = publicErrorMessage(
              error,
              "Não foi possível atualizar a sala. Tente novamente.",
            );
            setSyncError(message);
            setView((current) =>
              current.status === "ready"
                ? current
                : { status: "error", message },
            );
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

    const polling = window.setInterval(() => {
      if (navigator.onLine) void refreshState();
    }, 1000);
    let presencePending = false;
    async function heartbeat() {
      if (
        !active ||
        !client.setPresence ||
        presencePending ||
        !navigator.onLine
      )
        return;
      presencePending = true;
      try {
        await client.setPresence(roomCode, activePlayerToken, true);
      } catch {
        /* Reads retain and recover the confirmed state. */
      } finally {
        presencePending = false;
      }
    }
    const presence = window.setInterval(() => void heartbeat(), 2000);
    function offline() {
      setSyncError(
        "Conexão perdida. Seu estado confirmado foi preservado; aguardando o servidor para retomar.",
      );
    }
    function online() {
      void heartbeat();
      void refreshState();
    }
    function leaving() {
      void client
        .setPresence?.(roomCode, activePlayerToken, false)
        .catch(() => undefined);
    }
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    window.addEventListener("pagehide", leaving);

    return () => {
      active = false;
      window.clearInterval(polling);
      window.clearInterval(presence);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      window.removeEventListener("pagehide", leaving);
      unsubscribe();
    };
  }, [client, playerToken, realtime, retry, roomCode]);

  async function handleStart() {
    if (!playerToken || actionRequestInFlight.current) return;
    actionRequestInFlight.current = true;

    setStarting(true);
    setActionError(null);

    try {
      const result = await client.startRoom(roomCode, playerToken);
      const receivedAt = Date.now();
      setView((currentView) => {
        if (
          currentView.status === "ready" &&
          !shouldAcceptRoomState(currentView.state, result.state)
        ) {
          return currentView;
        }

        return { status: "ready", state: result.state, receivedAt };
      });
    } catch (error) {
      setActionError(
        publicErrorMessage(
          error,
          "Não foi possível iniciar a partida. Tente novamente.",
        ),
      );
    } finally {
      actionRequestInFlight.current = false;
      setStarting(false);
    }
  }

  async function handleSubmitAnswer(roundId: string, text: string) {
    if (
      !playerToken ||
      !client.submitAnswer ||
      answerRequestsInFlight.current.has(roundId)
    ) {
      if (!client.submitAnswer) {
        setAnswerError({
          roundId,
          message: "O envio ainda não está disponível neste servidor.",
          retryable: false,
        });
      }
      return;
    }

    answerRequestsInFlight.current.add(roundId);
    setAnswerSubmitting(roundId);
    setAnswerError(null);

    try {
      const result = await client.submitAnswer(
        roomCode,
        playerToken,
        roundId,
        text.trim(),
      );
      const receivedAt = Date.now();
      setView((currentView) => {
        if (
          currentView.status === "ready" &&
          !shouldAcceptRoomState(currentView.state, result.state)
        ) {
          return currentView;
        }

        return { status: "ready", state: result.state, receivedAt };
      });
    } catch (error) {
      setAnswerError({
        roundId,
        message: publicErrorMessage(
          error,
          "Não foi possível enviar sua resposta. Tente novamente.",
        ),
        retryable: error instanceof RoomClientError && error.retryable,
      });
      setRetry((value) => value + 1);
    } finally {
      answerRequestsInFlight.current.delete(roundId);
      setAnswerSubmitting((current) => (current === roundId ? null : current));
    }
  }

  function handleRetry() {
    setView((current) =>
      current.status === "ready" ? current : { status: "loading" },
    );
    setConnectionStatus("connecting");
    setRetry((value) => value + 1);
  }

  async function handleGameAction(action: "advance" | "retry") {
    if (
      !playerToken ||
      view.status !== "ready" ||
      actionRequestInFlight.current
    )
      return;
    if (action === "retry" && !view.state.public.control?.canRetry) return;
    const roundId = view.state.public.currentRound?.id;
    if (
      action === "advance" &&
      (!roundId ||
        !view.state.private.isHost ||
        view.state.public.game.status !== "reveal" ||
        view.state.public.game.round >= 8)
    )
      return;
    actionRequestInFlight.current = true;
    setGameActionPending(true);
    setActionError(null);
    try {
      const result =
        action === "advance"
          ? await client.advanceRoom?.(roomCode, playerToken, roundId!)
          : await client.retryNarrative?.(roomCode, playerToken);
      const receivedAt = Date.now();
      if (result)
        setView((current) =>
          current.status === "ready" &&
          !shouldAcceptRoomState(current.state, result.state)
            ? current
            : { status: "ready", state: result.state, receivedAt },
        );
    } catch (error) {
      setActionError(
        publicErrorMessage(
          error,
          "Não foi possível continuar agora. Tente novamente.",
        ),
      );
    } finally {
      actionRequestInFlight.current = false;
      setGameActionPending(false);
    }
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

  if (view.state.public.game.status !== "waiting") {
    return (
      <RoundExperience
        state={view.state}
        clockReceivedAt={view.receivedAt}
        connectionStatus={connectionStatus}
        lastSyncedAt={lastSyncedAt}
        submitting={answerSubmitting === view.state.public.currentRound?.id}
        submitError={
          answerError &&
          answerError.roundId === view.state.public.currentRound?.id
            ? answerError.message
            : null
        }
        submitErrorRetryable={Boolean(
          answerError &&
          answerError.roundId === view.state.public.currentRound?.id &&
          answerError.retryable,
        )}
        syncError={syncError}
        actionError={actionError}
        actionPending={gameActionPending}
        onRefresh={handleRetry}
        onAdvance={() => void handleGameAction("advance")}
        onRetryNarrative={() => void handleGameAction("retry")}
        onSubmitAnswer={(roundId, text) =>
          void handleSubmitAnswer(roundId, text)
        }
      />
    );
  }

  return (
    <>
      {syncError ? (
        <aside className="sync-banner" role="alert">
          {syncError}
          <button type="button" onClick={handleRetry}>
            Reconectar
          </button>
        </aside>
      ) : null}
      <Lobby
        state={view.state}
        connectionStatus={connectionStatus}
        lastSyncedAt={lastSyncedAt}
        notificationsReceived={notificationsReceived}
        starting={starting}
        actionError={actionError}
        onStart={() => void handleStart()}
      />
    </>
  );
}
