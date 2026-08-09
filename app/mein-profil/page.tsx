import PlayerAvatar from "@/components/PlayerAvatar";
import PlayerAliasLink from "@/components/PlayerAliasLink";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { logout } from "../auth-actions";
import { changeAlias, changePassword, deleteAccount, requestNameChange, submitClaim } from "./actions";
import ProfileImageForm from "./ProfileImageForm";

export const dynamic = "force-dynamic";
function imageUrl(data: unknown) { return data && typeof data === "object" && "url" in data && typeof data.url === "string" ? data.url : null; }

export default async function Page() {
  const user = await requireUser("/mein-profil");
  const [requests, claims, claimable] = await Promise.all([
    prisma.profileChangeRequest.findMany({ where: { submittedByUserId: user.id, status: "PENDING" }, orderBy: { createdAt: "desc" } }),
    prisma.playerClaim.findMany({ where: { submittedByUserId: user.id, status: "PENDING" }, include: { player: { select: { id: true, alias: true } } } }),
    prisma.player.findMany({ where: { userId: null, isActive: true, deletedAt: null, mergedIntoPlayerId: null }, select: { id: true, alias: true }, take: 50, orderBy: { alias: "asc" } }),
  ]);
  const alias = user.player?.alias ?? user.firstName;
  return <main className="account-shell wide">
    <div className="profile-hero"><PlayerAvatar imageUrl={user.profileImageUrl} alias={alias} size={96} className="profile-avatar" /><div><h1>{user.player ? <PlayerAliasLink playerId={user.player.id} alias={alias} /> : alias}</h1><p>{user.firstName} {user.lastName} · {user.email}</p><p>Status: {user.status}{user.profileRestricted ? " · Profil eingeschränkt" : ""}</p>{user.player && <a href={`/spieler/${user.player.id}`}>Öffentliches Spielerprofil</a>}</div></div>
    {requests.length > 0 && <section><h2>Offene Profiländerungen</h2>{requests.map((request) => <article className="data-row" key={request.id}><strong>{request.type}</strong><p>Der bisherige Wert bleibt bis zur Adminentscheidung aktiv.</p>{request.type === "PROFILE_IMAGE" && imageUrl(request.requestedData) && <img className="request-image" src={imageUrl(request.requestedData)!} alt="Beantragtes Profilbild" loading="lazy" />}</article>)}</section>}
    <section><h2>Alias ändern</h2><p>{user.profileRestricted ? "Benötigt Adminfreigabe; der bisherige Alias bleibt aktiv." : "Wird sofort aktiv; der alte Alias bleibt in der Historie."}</p><form action={changeAlias} className="account-form"><input name="alias" required /><button>{user.profileRestricted ? "Beantragen" : "Alias ändern"}</button></form></section>
    <section><h2>Name ändern</h2><p>Benötigt immer Adminfreigabe.</p><form action={requestNameChange} className="account-form"><input name="firstName" defaultValue={user.firstName} required /><input name="lastName" defaultValue={user.lastName} required /><button>Namensänderung beantragen</button></form></section>
    <section><h2>Profilbild</h2><ProfileImageForm /></section>
    <section><h2>Passwort ändern</h2><form action={changePassword} className="account-form"><input name="current" type="password" placeholder="Aktuelles Passwort" required /><input name="password" type="password" minLength={4} placeholder="Neues Passwort" required /><input name="repeat" type="password" minLength={4} placeholder="Wiederholen" required /><button>Passwort ändern</button></form></section>
    <section><h2>Spieler beanspruchen</h2><form action={submitClaim} className="account-form"><select name="playerId" required><option value="">Auswählen</option>{claimable.map((player) => <option key={player.id} value={player.id}>{player.alias}</option>)}</select><button>Claim stellen</button></form><ul>{claims.map((claim) => <li key={claim.id}><PlayerAliasLink playerId={claim.player.id} alias={claim.player.alias} /> · wartet</li>)}</ul></section>
    <section><form action={logout}><button>Abmelden</button></form></section>
    <section className="danger"><h2>Benutzerkonto löschen</h2><form action={deleteAccount} className="account-form"><input name="password" type="password" required /><button>Benutzerkonto löschen</button></form></section>
  </main>;
}
