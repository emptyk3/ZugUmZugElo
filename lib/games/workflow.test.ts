import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { GAME_PHOTO_REQUIRED_MESSAGE, validateGameParticipants } from "./validation.ts";

const participants = [1, 2, 3, 4].map((number) => ({ playerId: `p${number}`, points: 100 - number, missionId: `m${number}`, missionKept: true }));

test("neue Partie ohne Foto wird client- und serverseitig abgelehnt", () => {
  const action = readFileSync("app/partie-eintragen/actions.ts", "utf8");
  const page = readFileSync("app/partie-eintragen/page.tsx", "utf8");
  assert.ok(action.includes(`return { error: GAME_PHOTO_REQUIRED_MESSAGE }`));
  assert.ok(page.includes(GAME_PHOTO_REQUIRED_MESSAGE));
  assert.ok(page.includes("required />"));
});

test("Partieteilnehmer validieren Punkte, Spieler, Mission und Tiebreak", () => {
  assert.deepEqual(validateGameParticipants(participants), ["p1", "p2", "p3", "p4"]);
  assert.throws(() => validateGameParticipants([{ ...participants[0], points: 10 }, { ...participants[1], points: 10 }, participants[2], participants[3]]), /Tiebreak/);
  assert.throws(() => validateGameParticipants([{ ...participants[0], points: 1.5 }, ...participants.slice(1)]), /ganze Zahlen/);
});

test("Upload, Persistenz und Rollback verwenden die zentrale Storage-Lifecycle-Abstraktion", () => {
  const createAction = readFileSync("app/partie-eintragen/actions.ts", "utf8");
  const editAction = readFileSync("app/admin/partien/[id]/actions.ts", "utf8");
  assert.ok(createAction.includes("withStoredImageLifecycle(photoFile"));
  assert.ok(createAction.includes("photoUrl: photo.url"));
  assert.ok(createAction.includes("photoStorageId: photo.storageId"));
  assert.ok(editAction.includes("withStoredImageLifecycle(replacement"));
  assert.ok(editAction.includes("deleteStoredImage(result.oldPhoto)"));
});

test("Admin-Bearbeitung ist geschützt, atomar, auditiert und stößt Elo nur für bestätigte Partien an", () => {
  const action = readFileSync("app/admin/partien/[id]/actions.ts", "utf8");
  assert.ok(action.includes("await requireAdmin()"));
  assert.ok(action.includes("ELO_RECALCULATION_TRANSACTION_OPTIONS"));
  assert.ok(action.includes("oldGame.status === GameStatus.CONFIRMED"));
  assert.ok(action.includes("recalculateEloFromTransaction(tx, recalculationFrom)"));
  assert.ok(action.includes("auditLog.create"));
  assert.equal(action.includes("BLOB_READ_WRITE_TOKEN"), false);
  assert.equal(action.includes("arrayBuffer"), false);
});

test("Elo-Neuberechnungen verwenden einheitliche lange Transaktionsgrenzen",()=>{
  const options=readFileSync("lib/prisma/transaction-options.ts","utf8");
  assert.ok(options.includes("maxWait: 10_000"));
  assert.ok(options.includes("timeout: 30_000"));
  assert.ok(options.includes("TransactionIsolationLevel.Serializable"));
  for(const file of ["app/admin/actions.ts","app/admin/partien/[id]/actions.ts","lib/elo/recalculation.ts","lib/players/merge.ts"]){
    assert.ok(readFileSync(file,"utf8").includes("ELO_RECALCULATION_TRANSACTION_OPTIONS"),`${file} verwendet nicht die zentrale Transaktionskonfiguration`);
  }
});

test("Pending-Bestätigung bleibt atomar und liefert bei einem Fehler eine verständliche Rollback-Meldung",()=>{
  const action=readFileSync("app/admin/actions.ts","utf8");
  const confirmation=action.slice(action.indexOf("export async function confirmGame"),action.indexOf("export async function setTemporaryPassword"));
  const recalculation=confirmation.indexOf("await recalculateEloFromTransaction");
  const audit=confirmation.indexOf("await tx.auditLog.create");
  assert.ok(confirmation.includes("await prisma.$transaction"));
  assert.ok(recalculation>=0&&audit>recalculation,"AuditLog muss nach erfolgreicher Neuberechnung geschrieben werden");
  assert.ok(confirmation.includes("ELO_RECALCULATION_TRANSACTION_OPTIONS"));
  assert.ok(confirmation.includes("CONFIRM_GAME_ROLLBACK_MESSAGE"));
  assert.ok(action.includes("Die Elo-Neuberechnung wurde vollständig zurückgerollt"));
  assert.ok(readFileSync("app/admin/partien/page.tsx","utf8").includes("<ActionForm action={confirmGame}"));
  assert.ok(readFileSync("app/admin/partien/[id]/page.tsx","utf8").includes("<ActionForm action={confirmGame}"));
});

test("Bulk-Neuberechnung verwendet ausschließlich parameterisierte Prisma-SQL-Fragmente",()=>{
  const source=readFileSync("lib/elo/persistence.ts","utf8");
  assert.ok(source.includes("Prisma.sql"));
  assert.ok(source.includes("Prisma.join(values)"));
  assert.ok(source.includes('UPDATE "GameParticipant"'));
  assert.ok(source.includes('UPDATE "Player"'));
  assert.equal(source.includes("$executeRawUnsafe"),false);
});

test("Partiedetailseiten rendern vorhandene Fotos und neutralen Altbestand-Fallback", () => {
  const publicDetail = readFileSync("app/partien/[id]/page.tsx", "utf8");
  const adminDetail = readFileSync("app/admin/partien/[id]/page.tsx", "utf8");
  const photo = readFileSync("components/GamePhoto.tsx", "utf8");
  assert.ok(publicDetail.includes("<GamePhoto"));
  assert.ok(adminDetail.includes("<GamePhoto"));
  assert.ok(photo.includes("Für diese ältere Partie wurde kein Foto gespeichert."));
  assert.ok(photo.includes('target="_blank"'));
});

test("eingeloggte Nutzer können eine maximal 100 Zeichen lange Partiemeldung senden", () => {
  const action = readFileSync("app/partien/[id]/actions.ts", "utf8");
  const button = readFileSync("app/partien/[id]/ReportGameButton.tsx", "utf8");
  const admin = readFileSync("app/admin/partien/[id]/page.tsx", "utf8");
  assert.ok(action.includes("await requireUser"));
  assert.ok(action.includes("comment.length > 100"));
  assert.ok(action.includes("gameReport.upsert"));
  assert.ok(button.includes('maxLength={100}'));
  assert.ok(button.includes("Partie melden"));
  assert.ok(admin.includes("Meldungen zu dieser Partie"));
  assert.ok(admin.includes("Partie direkt bearbeiten"));
});

test("öffentliche Spielerprofile zeigen ausschließlich aktive Spieler und bestätigte Partien", () => {
  const profile = readFileSync("app/spieler/[id]/page.tsx", "utf8");
  assert.ok(profile.includes("isActive: true"));
  assert.ok(profile.includes("deletedAt: null"));
  assert.ok(profile.includes("mergedIntoPlayerId: null"));
  assert.ok(profile.includes("status: GameStatus.CONFIRMED"));
  assert.ok(profile.includes("currentRating"));
  assert.ok(profile.includes("Partieverlauf"));
  assert.equal(profile.includes("email: true"), false);
});

test("zentrale Alias-Verlinkung wird in Rangliste, Partien und Partieformular verwendet", () => {
  const link = readFileSync("components/PlayerAliasLink.tsx", "utf8");
  assert.ok(link.includes("/spieler/${playerId}"));
  for (const file of ["app/page.tsx", "app/partien/page.tsx", "app/partien/[id]/page.tsx", "app/partie-eintragen/page.tsx", "app/admin/spieler/page.tsx", "app/admin/partien/page.tsx", "app/mein-profil/page.tsx"]) {
    assert.ok(readFileSync(file, "utf8").includes("PlayerAliasLink"), `${file} verwendet keinen zentralen Spielerlink`);
  }
});
