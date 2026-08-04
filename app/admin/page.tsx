import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin();
  const [users, games, claims, reports, suspended, players, profileChanges, activities] = await Promise.all([
    prisma.user.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.game.count({ where: { status: "PENDING" } }),
    prisma.playerClaim.count({ where: { status: "PENDING" } }),
    prisma.gameReviewFlag.count({ where: { resolvedAt: null } }),
    prisma.user.count({ where: { status: "SUSPENDED" } }),
    prisma.player.count({ where: { isActive: true, deletedAt: null, mergedIntoPlayerId: null } }),
    prisma.profileChangeRequest.count({ where: { status: "PENDING" } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { actorUser: { select: { email: true, player: { select: { alias: true } } } } } }),
  ]);
  const cards = [
    ["Offene Benutzerfreigaben", users, "/admin/benutzer?status=PENDING_APPROVAL"],
    ["Pending-Partien", games, "/admin/partien?status=PENDING"],
    ["Offene Claims", claims, "/admin/claims"],
    ["Offene Profiländerungen", profileChanges, "/admin/profilantraege"],
    ["Offene Meldungen", reports, "/admin/partien"],
    ["Spieler verwalten", players, "/admin/spieler"],
    ["Gesperrte Nutzer", suspended, "/admin/benutzer?status=SUSPENDED"],
    ["Audit-Log", activities.length, "/admin/logs"],
  ] as const;
  return <main className="account-shell wide"><h1>Administration</h1><div className="admin-grid">{cards.map(([label, count, href]) => <a className="admin-card" href={href} key={label}><strong>{count}</strong><br />{label}</a>)}</div><section><div className="row-head"><h2>Letzte Aktivitäten</h2><a href="/admin/logs">Alle anzeigen</a></div><div className="activity-list">{activities.map((activity) => <div key={activity.id}><strong>{activity.action} · {activity.entityType}</strong><span>{activity.actorUser?.player?.alias ?? activity.actorUser?.email ?? "System"} · {activity.createdAt.toLocaleString("de-AT")}</span></div>)}</div></section></main>;
}
