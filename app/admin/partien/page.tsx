import { GameStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { confirmGame, rejectGame } from "../actions";
import PlayerAliasLink from "@/components/PlayerAliasLink";
import { ActionForm } from "@/app/form-submit";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const { status = "ALL" } = await searchParams;
  const validStatus = Object.values(GameStatus).includes(status as GameStatus) ? status as GameStatus : undefined;
  const games = await prisma.game.findMany({
    where: { status: validStatus, deletedAt: null },
    orderBy: [{ playedAt: "desc" }, { createdAt: "desc" }],
    include: {
      createdByUser: { select: { email: true, player: { select: { alias: true } } } },
      reviewReasons: true,
      _count: { select: { reports: { where: { status: "OPEN" } } } },
      participants: { orderBy: { placement: "asc" }, include: { player: { select: { id: true, alias: true } } } },
    },
  });

  return <main className="account-shell wide">
    <h1>Partieverwaltung</h1>
    <form className="filter-bar"><select name="status" defaultValue={status}><option value="ALL">Alle Status</option>{Object.values(GameStatus).filter((value) => value !== "DELETED").map((value) => <option key={value}>{value}</option>)}</select><button>Filtern</button></form>
    <p className="muted">{games.length} Partien</p>
    <div className="data-list">{games.map((game) => <article className="data-row" key={game.id}>
      <div className="row-head"><h2>{game.playedAt.toLocaleString("de-AT")}</h2><span className={`status status-${game.status.toLowerCase()}`}>{game.status}</span></div>
      <p>Ersteller: {game.createdByUser.player?.alias ?? game.createdByUser.email}</p>
      {game._count.reports > 0 && <p className="form-error"><strong>{game._count.reports} offene {game._count.reports === 1 ? "Meldung" : "Meldungen"}</strong></p>}
      <ol>{game.participants.map((participant) => <li key={participant.id}>{participant.placement}. <PlayerAliasLink playerId={participant.player.id} alias={participant.player.alias} /> · {participant.points} Punkte</li>)}</ol>
      <div className="actions">
        <a className="button-link" href={`/admin/partien/${game.id}`}>Partie öffnen</a>
        <a className="button-link" href={`/admin/partien/${game.id}?bearbeiten=1`}>Partie bearbeiten</a>
        {game.status === "PENDING" && <><ActionForm action={confirmGame} submitLabel="Bestätigen"><input type="hidden" name="gameId" value={game.id} /></ActionForm><form action={rejectGame}><input type="hidden" name="gameId" value={game.id} /><input type="hidden" name="note" value="In der Partieverwaltung abgelehnt" /><button>Ablehnen</button></form></>}
      </div>
    </article>)}</div>
  </main>;
}
