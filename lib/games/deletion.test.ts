import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { GameStatus } from "@prisma/client";
import { calculateChronologicalRatings, type ChronologicalGame } from "../elo/timeline.ts";
import { hardDeleteGameInTransaction } from "./deletion.ts";

test("Administrator-Löschung entfernt abhängige Daten, Partie und startet danach den Elo-Rebuild", async () => {
  const calls: string[] = [];
  const tx = {
    gameReport: { deleteMany: async () => { calls.push("reports"); } },
    game: { delete: async () => { calls.push("game"); } },
    auditLog: { create: async () => { calls.push("audit"); } },
  };
  await hardDeleteGameInTransaction(tx as never, { id: "g1", playedAt: new Date("2026-01-01"), status: GameStatus.CONFIRMED, photoUrl: null, photoStorageId: null }, "admin", { recalculate: async () => { calls.push("recalculate"); } });
  assert.deepEqual(calls, ["reports", "game", "recalculate", "audit"]);
});

test("Pending-Partie wird hart gelöscht, ohne unnötigen Elo-Rebuild", async () => {
  let recalculated = false;
  const tx = { gameReport: { deleteMany: async () => undefined }, game: { delete: async () => undefined }, auditLog: { create: async () => undefined } };
  await hardDeleteGameInTransaction(tx as never, { id: "g1", playedAt: new Date(), status: GameStatus.PENDING, photoUrl: null, photoStorageId: null }, "admin", { recalculate: async () => { recalculated = true; } });
  assert.equal(recalculated, false);
});

test("Entfernen einer rückdatierten Partie verändert die Elo-Historie späterer Partien", () => {
  const players = new Map([["a", 1200], ["b", 1200], ["c", 1200], ["d", 1200]]);
  const game = (id: string, day: number, order: string[]): ChronologicalGame => ({ id, playedAt: new Date(`2026-01-0${day}T12:00:00Z`), createdAt: new Date(`2026-01-0${day}T13:00:00Z`), participants: order.map((playerId, index) => ({ id: `${id}-${playerId}`, playerId, points: 100 - index * 10, tiebreakRank: null })) });
  const first = game("g1", 1, ["a", "b", "c", "d"]), deleted = game("g2", 2, ["d", "c", "b", "a"]), later = game("g3", 3, ["a", "c", "b", "d"]);
  const withDeleted = calculateChronologicalRatings(players, [first, deleted, later]);
  const withoutDeleted = calculateChronologicalRatings(players, [first, later]);
  const beforeWith = withDeleted.participantUpdates.find((row) => row.id === "g3-a")!.ratingBefore;
  const beforeWithout = withoutDeleted.participantUpdates.find((row) => row.id === "g3-a")!.ratingBefore;
  assert.notEqual(beforeWith, beforeWithout);
  assert.notDeepEqual([...withDeleted.finalRatings], [...withoutDeleted.finalRatings]);
});

test("Action ist admin-geschützt, löscht Blob vor Datenbankzustand und verwendet die gemeinsame Transaktion", () => {
  const action = readFileSync("app/admin/partien/[id]/actions.ts", "utf8");
  const section = action.slice(action.indexOf("export async function deleteGame"));
  assert.match(section, /const admin = await requireAdmin\(\)/);
  assert.ok(section.indexOf("await deleteStoredImage") < section.indexOf("await hardDeleteGameInTransaction"));
  assert.match(section, /ELO_RECALCULATION_TRANSACTION_OPTIONS/);
  assert.match(section, /recalculateEloFromTransaction/);
});

test("Admin-Oberfläche enthält Gefahrenbutton, vollständige Bestätigung und Erfolgsmeldung", () => {
  const button = readFileSync("app/admin/partien/[id]/DeleteGameButton.tsx", "utf8");
  const overview = readFileSync("app/admin/partien/page.tsx", "utf8");
  for (const text of ["🗑 Partie löschen", "Partie wirklich löschen?", "Diese Aktion kann nicht rückgängig gemacht werden.", "Endgültig löschen"]) assert.ok(button.includes(text));
  assert.ok(overview.includes("Partie wurde erfolgreich gelöscht."));
  assert.ok(overview.includes("Alle Elo-Werte wurden neu berechnet."));
});

test("Partie, Historie, Rangliste und Statistik lesen weiterhin direkt aus der verbleibenden Datenbasis", () => {
  for (const file of ["app/partien/page.tsx", "app/spieler/[id]/page.tsx", "app/page.tsx", "app/statistik/page.tsx"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /prisma\.(game|player)/, `${file} liest nicht direkt aus Prisma`);
  }
});
