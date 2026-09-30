import Link from "next/link";

import type { RoomState } from "@/domain";
import type { RoomConnectionStatus } from "@/lib/room-realtime";

type LobbyProps = {
  state: RoomState;
  connectionStatus: RoomConnectionStatus;
  starting: boolean;
  actionError: string | null;
  onStart: () => void;
};

const connectionLabels: Record<RoomConnectionStatus, string> = {
  connecting: "Conectando às atualizações…",
  connected: "Lobby sincronizado",
  reconnecting: "Reconectando às atualizações…",
  disconnected: "Atualizações desconectadas",
};

export function Lobby({
  state,
  connectionStatus,
  starting,
  actionError,
  onStart,
}: LobbyProps) {
  const { game, players } = state.public;
  const isWaiting = game.status === "waiting";
  const canRequestStart =
    state.private.isHost &&
    isWaiting &&
    players.length === 2 &&
    players.every((player) => player.isConnected);

  return (
    <main className="lobby-shell">
      <header className="lobby-header">
        <Link className="brand" href="/" aria-label="Voltar ao início">
          <span className="brand-mark" aria-hidden="true">
            “
          </span>
          Uma Frase
        </Link>
        <p
          className={`connection-state connection-${connectionStatus}`}
          role="status"
          aria-live="polite"
        >
          <span aria-hidden="true" />
          {connectionLabels[connectionStatus]}
        </p>
      </header>

      <section className="lobby-content" aria-labelledby="lobby-title">
        <div className="lobby-intro">
          <p className="eyebrow">Sala de espera</p>
          <h1 id="lobby-title">Preparem as melhores frases.</h1>
          <p>
            Compartilhe o código com a outra pessoa. O servidor confirmará
            quando todos estiverem prontos.
          </p>
        </div>

        <div className="room-code-block" aria-label="Código da sala">
          <span>Código da sala</span>
          <strong>{game.code}</strong>
        </div>

        <div className="lobby-grid">
          <section className="players-panel" aria-labelledby="players-title">
            <div className="panel-heading">
              <h2 id="players-title">Jogadores</h2>
              <span>{players.length}/2</span>
            </div>

            <ul className="player-list">
              {players.map((player) => (
                <li key={player.id}>
                  <span className="player-avatar" aria-hidden="true">
                    {player.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="player-name">
                    <strong>{player.name}</strong>
                    {player.id === state.private.playerId ? (
                      <small>Você</small>
                    ) : null}
                  </span>
                  <span
                    className={
                      player.isConnected
                        ? "player-status connected"
                        : "player-status"
                    }
                  >
                    {player.isConnected ? "Conectado" : "Reconectando"}
                  </span>
                </li>
              ))}

              {players.length < 2 ? (
                <li className="empty-player">
                  <span className="player-avatar" aria-hidden="true">
                    ?
                  </span>
                  <span className="player-name">
                    <strong>Aguardando jogador</strong>
                    <small>Compartilhe o código da sala</small>
                  </span>
                </li>
              ) : null}
            </ul>
          </section>

          <aside className="lobby-action" aria-labelledby="match-title">
            <p className="card-number">Próximo passo</p>
            <h2 id="match-title">
              {isWaiting ? "A partida começa em breve." : "Partida iniciada."}
            </h2>

            {isWaiting ? (
              state.private.isHost ? (
                <>
                  <p>
                    Você criou esta sala. Quando os dois jogadores estiverem
                    conectados, poderá solicitar o início.
                  </p>
                  <button
                    className="primary-action"
                    type="button"
                    disabled={!canRequestStart || starting}
                    onClick={onStart}
                  >
                    {starting ? "Iniciando…" : "Iniciar partida"}
                    <span aria-hidden="true">→</span>
                  </button>
                </>
              ) : (
                <p>Aguardando o host solicitar o início da partida.</p>
              )
            ) : (
              <p>O servidor confirmou o início. Prepare-se para a situação.</p>
            )}

            {actionError ? (
              <p className="form-error" role="alert">
                {actionError}
              </p>
            ) : null}
          </aside>
        </div>
      </section>
    </main>
  );
}
