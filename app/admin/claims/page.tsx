import PlayerAliasLink from "@/components/PlayerAliasLink";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { approveClaim, rejectClaim } from "../actions";

export const dynamic = "force-dynamic";
export default async function Page() {
  await requireAdmin();
  const claims = await prisma.playerClaim.findMany({ where: { status: "PENDING" }, include: { submittedByUser: { select: { firstName: true, lastName: true, player: { select: { id: true, alias: true, _count: { select: { participations: true } } } } } }, player: { select: { id: true, alias: true, userId: true, _count: { select: { participations: true } }, aliases: true } } } });
  return <main className="account-shell wide"><h1>Spieler-Claims</h1>{claims.length === 0 && <p>Keine offenen Claims.</p>}{claims.map((claim) => <article className="data-row" key={claim.id}><h2>{claim.submittedByUser.player ? <PlayerAliasLink playerId={claim.submittedByUser.player.id} alias={claim.submittedByUser.player.alias} /> : `${claim.submittedByUser.firstName} ${claim.submittedByUser.lastName}`} beansprucht <PlayerAliasLink playerId={claim.player.id} alias={claim.player.alias} /></h2><p>Partien: aktuell {claim.submittedByUser.player?._count.participations ?? 0}, beansprucht {claim.player._count.participations}. Aliasse: {claim.player.aliases.map((alias) => alias.alias).join(", ")}</p>{claim.player.userId ? <p className="form-error">Dieser Spieler ist bereits einem Benutzer zugeordnet.</p> : <form action={approveClaim} className="account-form"><input type="hidden" name="claimId" value={claim.id} /><label>Prüfnotiz<textarea name="note" /></label><button>Claim genehmigen</button></form>}<form action={rejectClaim} className="account-form"><input type="hidden" name="claimId" value={claim.id} /><label>Ablehnungsnotiz<textarea name="note" /></label><button>Ablehnen</button></form></article>)}</main>;
}
