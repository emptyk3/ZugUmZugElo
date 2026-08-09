import { ReportStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { confirmGame, rejectGame } from "../../actions";
import GamePhoto from "@/components/GamePhoto";
import GameEditor from "./GameEditor";
import ResolveGameReportsButton from "./ResolveGameReportsButton";
import PlayerAliasLink from "@/components/PlayerAliasLink";
import { ActionForm } from "@/app/form-submit";
import DeleteGameButton from "./DeleteGameButton";

export const dynamic = "force-dynamic";

function localDateTime(date: Date) {
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function userLabel(user: { email: string; player: { alias: string } | null } | null) {
  return user?.player?.alias ?? user?.email ?? "Unbekannt";
}

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ bearbeiten?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { bearbeiten } = await searchParams;
  const [game, players, missions] = await Promise.all([
    prisma.game.findUnique({ where: { id }, include: {
      createdByUser: { select: { email: true, player: { select: { alias: true } } } },
      reviewReasons: { orderBy: { createdAt: "desc" }, include: { resolvedByUser: { select: { email: true, player: { select: { alias: true } } } } } },
      participants: { orderBy: { placement: "asc" }, include: { player: { select: { id: true, alias: true } }, mission: { select: { id: true, name: true, isActive: true } } } },
      reports: { orderBy: { updatedAt: "desc" }, include: {
        submittedByUser: { select: { email: true, player: { select: { alias: true } } } },
        reviewedByUser: { select: { email: true, player: { select: { alias: true } } } },
      } },
    } }),
    prisma.player.findMany({ where: { isActive: true, deletedAt: null, mergedIntoPlayerId: null }, orderBy: { alias: "asc" }, select: { id: true, alias: true } }),
    prisma.mission.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, isActive: true } }),
  ]);
  if (!game) notFound();
  const allowedMissionIds = new Set([...missions.filter((mission) => mission.isActive).map((mission) => mission.id), ...game.participants.map((participant) => participant.missionId)]);
  const openFlags = game.reviewReasons.filter((flag) => flag.resolvedAt === null);
  const hasOpenReports = openFlags.length > 0 || game.reports.some((report) => report.status === ReportStatus.OPEN || report.status === ReportStatus.IN_REVIEW);

  return <main className="account-shell wide">
    <a href="/admin/partien">← Partieverwaltung</a>
    <div className="row-head"><h1>Partie vom {game.playedAt.toLocaleString("de-AT")}</h1><span className={`status status-${game.status.toLowerCase()}`}>{game.status}</span></div>
    <p>Erfasst am {game.createdAt.toLocaleString("de-AT")} von {userLabel(game.createdByUser)}</p>
    <p>Offene Meldungen: {openFlags.length} · Meldungshistorie: {game.reports.length}</p>
    {hasOpenReports && <ResolveGameReportsButton gameId={game.id} />}

    {game.reports.length > 0 && <section><h2>Meldungen zu dieser Partie</h2><div className="data-list">{game.reports.map((report) => <article className="data-row" key={report.id}>
      <div className="row-head"><strong>{report.reason}</strong><span className={`status status-${report.status.toLowerCase()}`}>{report.status === ReportStatus.RESOLVED ? "✓ Erledigt" : report.status}</span></div>
      <p>Ersteller: {userLabel(report.submittedByUser)} · Gemeldet am {report.createdAt.toLocaleString("de-AT")}</p>
      <p>{report.comment || "Keine zusätzliche Begründung"}</p>
      {report.reviewedAt && <p>Erledigt von {userLabel(report.reviewedByUser)} · {report.reviewedAt.toLocaleString("de-AT")}</p>}
      {report.resolution && <p>Abschluss: {report.resolution}</p>}
      <small><a href={`/admin/partien/${game.id}?bearbeiten=1`}>Partie direkt bearbeiten</a></small>
    </article>)}</div></section>}

    {game.reviewReasons.length > 0 && <section><h2>Prüfstatus</h2><div className="data-list">{game.reviewReasons.map((flag) => <article className="data-row" key={flag.id}>
      <div className="row-head"><strong>{flag.reason}</strong><span className={`status status-${flag.resolvedAt ? "resolved" : "open"}`}>{flag.resolvedAt ? "✓ Erledigt" : "Offen"}</span></div>
      <p>Erstellt am {flag.createdAt.toLocaleString("de-AT")}</p>
      {flag.resolvedAt && <p>Erledigt von {userLabel(flag.resolvedByUser)} · {flag.resolvedAt.toLocaleString("de-AT")}</p>}
    </article>)}</div></section>}

    <GameEditor gameId={game.id} playedAt={localDateTime(game.playedAt)} hasPhoto={Boolean(game.photoUrl && game.photoStorageId)} initialOpen={bearbeiten === "1"}
      participants={game.participants.map((participant) => ({ playerId: participant.playerId, points: String(participant.points), missionId: participant.missionId, missionKept: participant.missionKept, tiebreakRank: participant.tiebreakRank ? String(participant.tiebreakRank) : "" }))}
      players={players.map((player) => ({ id: player.id, label: player.alias }))}
      missions={missions.filter((mission) => allowedMissionIds.has(mission.id)).map((mission) => ({ id: mission.id, label: mission.name, active: mission.isActive }))} />
    <GamePhoto photoUrl={game.photoUrl} alt={`Foto der Partie vom ${game.playedAt.toLocaleString("de-AT")}`} />
    <div className="data-list">{game.participants.map((participant) => <article className="data-row" key={participant.id}>
      <h2>{participant.placement}. <PlayerAliasLink playerId={participant.player.id} alias={participant.player.alias} /></h2>
      <p>{participant.points} Punkte · {participant.mission.name}{!participant.missionKept ? " · Mission nicht behalten" : ""}{participant.tiebreakRank ? ` · Tiebreak ${participant.tiebreakRank}` : ""}</p>
      <p>Elo: {Math.round(participant.ratingBefore)} → {Math.round(participant.ratingAfter)} ({participant.ratingChange >= 0 ? "+" : ""}{Math.round(participant.ratingChange)})</p>
    </article>)}</div>
    {game.status === "PENDING" && <div className="admin-grid"><ActionForm action={confirmGame} submitLabel="Bestätigen und Elo neu berechnen"><input type="hidden" name="gameId" value={game.id} /><label>Prüfnotiz<textarea name="note" /></label></ActionForm><form action={rejectGame} className="account-form"><input type="hidden" name="gameId" value={game.id} /><label>Ablehnungsgrund<textarea name="note" required /></label><button>Ablehnen</button></form></div>}
    <DeleteGameButton gameId={game.id} />
  </main>;
}
