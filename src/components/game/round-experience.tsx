import Link from "next/link";

import type { GameStatus, PublicRoundState, RoomState } from "@/domain";
import type { RoomConnectionStatus } from "@/lib/room-realtime";

type RoundExperienceProps = {
  state: RoomState;
  connectionStatus: RoomConnectionStatus;
  lastSyncedAt: string | null;
};

const connectionLabels: Record<RoomConnectionStatus, string> = {
  connecting: "Conectando às atualizações…",
  connected: "Partida sincronizada",
  reconnecting: "Reconectando às atualizações…",
  disconnected: "Atualizações desconectadas",
};

const phaseLabels: Record<GameStatus, string> = {
  waiting: "Sala de espera",
  generating: "Gerando situação",
  situation: "Situação revelada",
  answering: "Hora de responder",
  judging: "Julgamento em andamento",
  judging_error: "Julgamento interrompido",
  reveal: "Resultado da rodada",
  paused: "Partida pausada",
  finished: "Partida encerrada",
};

function Situation({ round }: { round: PublicRoundState }) {
  return (
    <section className="situation-card" aria-labelledby="situation-title">
      <p className="card-number">Situação</p>
      <h2 id="situation-title">{round.situation}</h2>
    </section>
  );
}

function OwnAnswer({ state }: { state: RoomState }) {
  if (!state.private.answer) return null;

  return (
    <aside className="own-answer" aria-label="Sua resposta">
      <span>Sua resposta</span>
      <p>“{state.private.answer.text}”</p>
    </aside>
  );
}

function Result({ state }: { state: RoomState }) {
  const { currentRound: round, players } = state.public;

  if (!round?.answers) return null;

  const winner = players.find((player) => player.id === round.winnerPlayerId);

  return (
    <div className="round-result">
      <section className="result-summary" aria-labelledby="result-title">
        <p className="eyebrow">Resultado confirmado</p>
        <h2 id="result-title">
          {winner ? `${winner.name} vence a rodada.` : "Rodada sem ponto."}
        </h2>
        {round.reason ? <p>{round.reason}</p> : null}
      </section>

      <section className="revealed-answers" aria-labelledby="answers-title">
        <div className="panel-heading">
          <h2 id="answers-title">Respostas reveladas</h2>
          <span>{round.answers.length}/2</span>
        </div>
        {round.answers.length > 0 ? (
          <ul>
            {round.answers.map((answer) => {
              const player = players.find(
                (candidate) => candidate.id === answer.playerId,
              );

              return (
                <li
                  key={answer.playerId}
                  className={
                    answer.playerId === round.winnerPlayerId
                      ? "winning-answer"
                      : undefined
                  }
                >
                  <span>{player?.name ?? "Jogador"}</span>
                  <p>“{answer.text}”</p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="empty-result">Ninguém respondeu nesta rodada.</p>
        )}
      </section>

      {round.continuation ? (
        <section className="story-continuation" aria-labelledby="story-title">
          <p className="card-number">A história continua</p>
          <h2 id="story-title">{round.continuation}</h2>
          {round.nextSituation ? (
            <p>Próxima situação: {round.nextSituation}</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function RoundPhase({ state }: { state: RoomState }) {
  const { game, currentRound: round } = state.public;
  const phase =
    game.status === "paused" && game.pausedFrom ? game.pausedFrom : game.status;

  if (phase === "generating") {
    return (
      <section className="phase-feedback" aria-live="polite" aria-busy="true">
        <span className="loading-mark" aria-hidden="true">
          “
        </span>
        <h2>Criando a situação da rodada…</h2>
        <p>Aguardando o estado confirmado pelo servidor.</p>
      </section>
    );
  }

  if (!round) {
    return (
      <section className="phase-feedback" aria-live="polite" aria-busy="true">
        <h2>Sincronizando a rodada…</h2>
        <p>Os detalhes aparecerão assim que forem confirmados.</p>
      </section>
    );
  }

  if (phase === "situation") {
    return (
      <>
        <Situation round={round} />
        <section className="limit-pending" aria-live="polite">
          <span>Limite de palavras</span>
          <strong>?</strong>
          <p>O servidor revelará o mesmo limite para os dois jogadores.</p>
        </section>
      </>
    );
  }

  if (phase === "answering") {
    return (
      <>
        <Situation round={round} />
        <section className="answer-state" aria-labelledby="answer-title">
          <div className="word-limit" aria-label="Limite de palavras">
            <span>Limite revelado</span>
            <strong>{round.wordLimit ?? "—"}</strong>
            <small>palavras</small>
          </div>
          <div>
            <p className="eyebrow">
              {state.private.answer ? "Resposta enviada" : "Sua resposta"}
            </p>
            <h2 id="answer-title">
              {state.private.answer
                ? "Agora é só aguardar."
                : "Escreva uma única frase."}
            </h2>
            <p>
              {state.private.answer
                ? "Sua frase permanece privada até a revelação do servidor."
                : "Prepare uma frase respeitando o limite confirmado para esta rodada."}
            </p>
          </div>
        </section>
        <OwnAnswer state={state} />
      </>
    );
  }

  if (phase === "judging" || phase === "judging_error") {
    return (
      <>
        <Situation round={round} />
        <section className="phase-feedback" aria-live="polite">
          <span className="loading-mark" aria-hidden="true">
            {phase === "judging" ? "…" : "!"}
          </span>
          <h2>
            {phase === "judging"
              ? "As respostas estão sendo julgadas."
              : "O julgamento não foi concluído."}
          </h2>
          <p>
            {phase === "judging"
              ? "As frases continuam privadas até o resultado confirmado."
              : "Aguardando uma nova confirmação do servidor para continuar."}
          </p>
        </section>
        <OwnAnswer state={state} />
      </>
    );
  }

  if (phase === "reveal" || phase === "finished") {
    return <Result state={state} />;
  }

  return null;
}

export function RoundExperience({
  state,
  connectionStatus,
  lastSyncedAt,
}: RoundExperienceProps) {
  const { game, players } = state.public;
  const effectivePhase =
    game.status === "paused" && game.pausedFrom ? game.pausedFrom : game.status;

  return (
    <main className="round-shell">
      <header className="lobby-header">
        <Link className="brand" href="/" aria-label="Voltar ao início">
          <span className="brand-mark" aria-hidden="true">
            “
          </span>
          Uma Frase
        </Link>
        <div className="connection-summary">
          <p
            className={`connection-state connection-${connectionStatus}`}
            role="status"
            aria-live="polite"
          >
            <span aria-hidden="true" />
            {connectionLabels[connectionStatus]}
          </p>
          <p className="connection-details">
            Última leitura: {lastSyncedAt ?? "aguardando"}
          </p>
        </div>
      </header>

      <section className="round-heading" aria-labelledby="round-title">
        <div>
          <p className="eyebrow">{phaseLabels[game.status]}</p>
          <h1 id="round-title">
            {game.status === "finished"
              ? "Fim de jogo."
              : `Rodada ${game.round} de ${game.maxRounds}`}
          </h1>
        </div>
        <ol className="scoreboard" aria-label="Placar">
          {players.map((player) => (
            <li key={player.id}>
              <span>
                {player.name}
                {player.id === state.private.playerId ? " (você)" : ""}
              </span>
              <strong>{player.score}</strong>
            </li>
          ))}
        </ol>
      </section>

      {game.status === "paused" ? (
        <aside className="pause-banner" role="status">
          <strong>Partida pausada.</strong>
          <span>
            A tela preserva a fase de{" "}
            {phaseLabels[effectivePhase].toLowerCase()}; aguarde a retomada
            confirmada pelo servidor.
          </span>
        </aside>
      ) : null}

      <div className="round-content" key={state.public.currentRound?.id}>
        <RoundPhase state={state} />
      </div>
    </main>
  );
}
