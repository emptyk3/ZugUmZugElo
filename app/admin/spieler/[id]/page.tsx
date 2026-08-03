import { notFound } from "next/navigation";
import PlayerAliasLink from "@/components/PlayerAliasLink";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { addPlayerAlias } from "../../actions";

export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin(); const { id } = await params;
  const player = await prisma.player.findUnique({ where: { id }, include: { user: { select: { email: true, firstName: true, lastName: true } }, aliases: { orderBy: { validFrom: "desc" } }, claimTargets: { orderBy: { createdAt: "desc" }, include: { submittedByUser: { select: { email: true } } } }, participations: { orderBy: { game: { playedAt: "desc" } }, include: { game: { select: { id: true, playedAt: true, status: true } } } } } });
  if (!player) notFound();
  return <main className="account-shell wide"><a href="/admin/spieler">← Spielerverwaltung</a><h1><PlayerAliasLink playerId={player.id} alias={player.alias} /></h1><p><a href={`/spieler/${player.id}`}>Öffentliches Spielerprofil öffnen</a></p><dl className="facts"><div><dt>Elo</dt><dd>{Math.round(player.currentRating)}</dd></div><div><dt>Partien</dt><dd>{player.participations.length}</dd></div><div><dt>Benutzer</dt><dd>{player.user ? `${player.user.firstName} ${player.user.lastName} · ${player.user.email}` : "nicht verbunden"}</dd></div><div><dt>Status</dt><dd>{player.isActive ? "aktiv" : "inaktiv"}</dd></div></dl><section><h2>Aliasse</h2><ul>{player.aliases.map((alias) => <li key={alias.id}>{alias.alias} · ab {alias.validFrom.toLocaleDateString("de-AT")}</li>)}</ul><form action={addPlayerAlias} className="account-form"><input type="hidden" name="playerId" value={player.id} /><label>Alias zur Historie hinzufügen<input name="alias" required /></label><button>Alias hinzufügen</button></form></section><section><h2>Claims</h2>{player.claimTargets.length ? <ul>{player.claimTargets.map((claim) => <li key={claim.id}>{claim.status} · {claim.submittedByUser.email}</li>)}</ul> : <p>Keine Claims.</p>}</section><section><h2>Partien</h2><ul>{player.participations.map((participation) => <li key={participation.id}><a href={`/admin/partien/${participation.game.id}`}>{participation.game.playedAt.toLocaleString("de-AT")} · {participation.game.status}</a></li>)}</ul></section></main>;
}
