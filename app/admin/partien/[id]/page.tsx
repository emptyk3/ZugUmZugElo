import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { confirmGame, rejectGame } from "../../actions";
import GamePhoto from "@/components/GamePhoto";
import GameEditor from "./GameEditor";

export const dynamic = "force-dynamic";

function localDateTime(date: Date) {
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ bearbeiten?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { bearbeiten } = await searchParams;
  const [game, players, missions] = await Promise.all([
    prisma.game.findUnique({ where: { id }, include: {
      createdByUser: { select: { email: true, player: { select: { alias: true } } } }, reviewReasons: true,
      participants: { orderBy: { placement: "asc" }, include: { player: { select: { id: true, alias: true } }, mission: { select: { id: true, name: true, isActive: true } } } }, reports: true,
    } }),
    prisma.player.findMany({ where: { isActive: true, deletedAt: null, mergedIntoPlayerId: null }, orderBy: { alias: "asc" }, select: { id: true, alias: true } }),
    prisma.mission.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, isActive: true } }),
  ]);
  if (!game) notFound();
  const allowedMissionIds = new Set([...missions.filter((mission) => mission.isActive).map((mission) => mission.id), ...game.participants.map((participant) => participant.missionId)]);

  return <main className="account-shell wide">
    <a href="/admin/partien">← Partieverwaltung</a>
    <div className="row-head"><h1>Partie vom {game.playedAt.toLocaleString("de-AT")}</h1><span className={`status status-${game.status.toLowerCase()}`}>{game.status}</span></div>
    <p>Erfasst am {game.createdAt.toLocaleString("de-AT")} von {game.createdByUser.player?.alias ?? game.createdByUser.email}</p>
    <p>Review-Gründe: {game.reviewReasons.map((reason) => reason.reason).join(", ") || "keine"} · Meldungen: {game.reports.length}</p>
    <GameEditor gameId={game.id} playedAt={localDateTime(game.playedAt)} hasPhoto={Boolean(game.photoUrl && game.photoStorageId)} initialOpen={bearbeiten === "1"}
      participants={game.participants.map((participant) => ({ playerId: participant.playerId, points: String(participant.points), missionId: participant.missionId, missionKept: participant.missionKept, tiebreakRank: participant.tiebreakRank ? String(participant.tiebreakRank) : "" }))}
      players={players.map((player) => ({ id: player.id, label: player.alias }))}
      missions={missions.filter((mission) => allowedMissionIds.has(mission.id)).map((mission) => ({ id: mission.id, label: mission.name, active: mission.isActive }))} />
    <GamePhoto photoUrl={game.photoUrl} alt={`Foto der Partie vom ${game.playedAt.toLocaleString("de-AT")}`} />
    <div className="data-list">{game.participants.map((participant) => <article className="data-row" key={participant.id}>
      <h2>{participant.placement}. <a href={`/admin/spieler/${participant.player.id}`}>{participant.player.alias}</a></h2>
      <p>{participant.points} Punkte · {participant.mission.name}{!participant.missionKept ? " · Mission nicht behalten" : ""}{participant.tiebreakRank ? ` · Tiebreak ${participant.tiebreakRank}` : ""}</p>
      <p>Elo: {Math.round(participant.ratingBefore)} → {Math.round(participant.ratingAfter)} ({participant.ratingChange >= 0 ? "+" : ""}{Math.round(participant.ratingChange)})</p>
    </article>)}</div>
    {game.status === "PENDING" && <div className="admin-grid"><form action={confirmGame} className="account-form"><input type="hidden" name="gameId" value={game.id} /><label>Prüfnotiz<textarea name="note" /></label><button>Bestätigen und Elo neu berechnen</button></form><form action={rejectGame} className="account-form"><input type="hidden" name="gameId" value={game.id} /><label>Ablehnungsgrund<textarea name="note" required /></label><button>Ablehnen</button></form></div>}
  </main>;
}
