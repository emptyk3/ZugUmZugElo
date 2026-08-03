import PlayerAvatar from "@/components/PlayerAvatar";
import PlayerAliasLink from "@/components/PlayerAliasLink";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { mergePlayersAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q = "" } = await searchParams;
  const where = { isActive: true, deletedAt: null, mergedIntoPlayerId: null, OR: q ? [{ alias: { contains: q, mode: "insensitive" as const } }, { aliases: { some: { alias: { contains: q, mode: "insensitive" as const } } } }] : undefined };
  const players = await prisma.player.findMany({ where, orderBy: { alias: "asc" }, select: { id: true, alias: true, currentRating: true, user: { select: { email: true, profileImageUrl: true } }, aliases: { select: { alias: true } }, claimTargets: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } }, participations: { where: { game: { status: "CONFIRMED", deletedAt: null } }, orderBy: { game: { playedAt: "desc" } }, take: 1, select: { game: { select: { playedAt: true } } } }, _count: { select: { participations: true } } } });
  const all = await prisma.player.findMany({ where: { isActive: true, deletedAt: null, mergedIntoPlayerId: null }, orderBy: { alias: "asc" }, select: { id: true, alias: true, _count: { select: { participations: true } } } });
  return <main className="account-shell wide"><h1>Spielerverwaltung</h1><form className="filter-bar"><input name="q" defaultValue={q} placeholder="Alias suchen" /><button>Suchen</button></form><div className="data-list">{players.map((player) => <article className="data-row" key={player.id}><div className="row-head"><PlayerAliasLink playerId={player.id} alias={player.alias} className="player-with-avatar"><PlayerAvatar imageUrl={player.user?.profileImageUrl} alias={player.alias} size={48} /><h2>{player.alias}</h2></PlayerAliasLink><strong>{Math.round(player.currentRating)} Elo</strong></div><p>{player._count.participations} Partien · zuletzt {player.participations[0]?.game.playedAt.toLocaleString("de-AT") ?? "–"}</p><p>Aliasse: {player.aliases.map((alias) => alias.alias).join(", ")} · Benutzer: {player.user?.email ?? "–"} · Claim: {player.claimTargets[0]?.status ?? "keiner"}</p><a className="button-link" href={`/admin/spieler/${player.id}`}>Spieler administrieren</a></article>)}</div><section><h2>Spieler zusammenführen</h2><form action={mergePlayersAction} className="account-form"><label>Quelle<select name="sourcePlayerId" required><option value="">Auswählen</option>{all.map((player) => <option value={player.id} key={player.id}>{player.alias} · {player._count.participations}</option>)}</select></label><label>Ziel<select name="targetPlayerId" required><option value="">Auswählen</option>{all.map((player) => <option value={player.id} key={player.id}>{player.alias} · {player._count.participations}</option>)}</select></label><label>Begründung<textarea name="note" required /></label><button>Zusammenführen</button></form></section></main>;
}
