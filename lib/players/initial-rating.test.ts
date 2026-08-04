import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { changeInitialRatingInTransaction, validateInitialRatingRequest } from "./initial-rating.ts";

const firstPlayedAt = new Date("2026-01-02T10:00:00.000Z");

function fakeTransaction(options: { initial?: number; current?: number; firstGame?: Date | null; deletedAt?: Date | null; mergedIntoPlayerId?: string | null } = {}) {
  const writes: Array<{ operation: string; args: any }> = [];
  const player = {
    id: "player-1", initialRating: options.initial ?? 1200, currentRating: options.current ?? 1333,
    deletedAt: options.deletedAt ?? null, mergedIntoPlayerId: options.mergedIntoPlayerId ?? null,
  };
  const tx = {
    player: {
      findUnique: async () => player,
      update: async (args: any) => { writes.push({ operation: "player", args }); return {}; },
    },
    game: {
      findFirst: async (args: any) => { writes.push({ operation: "firstGame", args }); return options.firstGame === null ? null : { playedAt: options.firstGame ?? firstPlayedAt }; },
    },
    auditLog: {
      create: async (args: any) => { writes.push({ operation: "audit", args }); return {}; },
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, writes };
}

function replay(finalRating: number) {
  return async (_tx: Prisma.TransactionClient, from: Date) => ({
    participantUpdates: [
      { id: "p-1", gameId: "game-1", playerId: "player-1", placement: 1, ratingBefore: 1500, ratingChange: 10, ratingAfter: 1510 },
      { id: "p-2", gameId: "game-1", playerId: "opponent", placement: 2, ratingBefore: 1400, ratingChange: -10, ratingAfter: 1390 },
      { id: "p-3", gameId: "game-2", playerId: "player-1", placement: 2, ratingBefore: 1510, ratingChange: -5, ratingAfter: finalRating },
    ],
    finalRatings: new Map([["player-1", finalRating], ["opponent", 1390]]),
    from,
  });
}

test("Start-Elo kann von 1200 auf 1500 mit chronologischer Neuberechnung geändert werden", async () => {
  const { tx, writes } = fakeTransaction({ initial: 1200 });
  const result = await changeInitialRatingInTransaction(tx, { playerId: "player-1", adminId: "admin-1", newInitialRating: 1500, reason: "Korrektur", confirmed: true }, replay(1505) as never);
  assert.equal(result.recalculationFrom?.toISOString(), firstPlayedAt.toISOString());
  assert.equal(result.recalculatedGames, 2);
  assert.equal(result.updatedParticipants, 3);
  assert.deepEqual(writes.find((write) => write.operation === "player")?.args.data, { initialRating: 1500 });
});

test("Start-Elo kann von 1500 auf 1200 geändert werden", async () => {
  const { tx, writes } = fakeTransaction({ initial: 1500 });
  await changeInitialRatingInTransaction(tx, { playerId: "player-1", adminId: "admin-1", newInitialRating: 1200, reason: "Korrektur", confirmed: true }, replay(1210) as never);
  assert.deepEqual(writes.find((write) => write.operation === "player")?.args.data, { initialRating: 1200 });
});

test("Spieler ohne bestätigte Partie erhält initialRating und currentRating ohne Replay", async () => {
  const { tx, writes } = fakeTransaction({ initial: 1200, firstGame: null });
  let replayCalled = false;
  const result = await changeInitialRatingInTransaction(tx, { playerId: "player-1", adminId: "admin-1", newInitialRating: 1500, reason: "Korrektur", confirmed: true }, (async () => { replayCalled = true; throw new Error(); }) as never);
  assert.equal(replayCalled, false);
  assert.equal(result.recalculationFrom, null);
  assert.deepEqual(writes.find((write) => write.operation === "player")?.args.data, { initialRating: 1500, currentRating: 1500 });
});

test("erste Partie berücksichtigt nur bestätigte, nicht gelöschte Teilnahmen und ist stabil sortiert", async () => {
  const { tx, writes } = fakeTransaction();
  await changeInitialRatingInTransaction(tx, { playerId: "player-1", adminId: "admin-1", newInitialRating: 1500, reason: "Korrektur", confirmed: true }, replay(1505) as never);
  const query = writes.find((write) => write.operation === "firstGame")?.args;
  assert.deepEqual(query.where, { status: "CONFIRMED", deletedAt: null, participants: { some: { playerId: "player-1" } } });
  assert.deepEqual(query.orderBy, [{ playedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }]);
});

test("gleicher oder ungültiger Wert, Grund und Bestätigung werden serverseitig abgelehnt", async () => {
  assert.throws(() => validateInitialRatingRequest({ playerId: "p", newInitialRating: 1300, reason: "x", confirmed: true }), /1200 oder 1500/);
  assert.throws(() => validateInitialRatingRequest({ playerId: "p", newInitialRating: 1500, reason: "", confirmed: true }), /Änderungsgrund/);
  assert.throws(() => validateInitialRatingRequest({ playerId: "p", newInitialRating: 1500, reason: "x", confirmed: false }), /bestätige/);
  const { tx } = fakeTransaction({ initial: 1500 });
  await assert.rejects(changeInitialRatingInTransaction(tx, { playerId: "p", adminId: "a", newInitialRating: 1500, reason: "x", confirmed: true }, replay(1500) as never), /entspricht bereits/);
});

test("gelöschte und gemergte Spieler werden abgelehnt", async () => {
  await assert.rejects(changeInitialRatingInTransaction(fakeTransaction({ deletedAt: new Date() }).tx, { playerId: "p", adminId: "a", newInitialRating: 1500, reason: "x", confirmed: true }, replay(1500) as never), /gelöschten/);
  await assert.rejects(changeInitialRatingInTransaction(fakeTransaction({ mergedIntoPlayerId: "target" }).tx, { playerId: "p", adminId: "a", newInitialRating: 1500, reason: "x", confirmed: true }, replay(1500) as never), /zusammengeführten/);
});

test("Replay-Fehler verhindert Audit und wird für den Transaktions-Rollback weitergereicht", async () => {
  const { tx, writes } = fakeTransaction();
  await assert.rejects(changeInitialRatingInTransaction(tx, { playerId: "player-1", adminId: "admin-1", newInitialRating: 1500, reason: "x", confirmed: true }, (async () => { throw new Error("Replay fehlgeschlagen"); }) as never), /Replay fehlgeschlagen/);
  assert.equal(writes.some((write) => write.operation === "audit"), false);
  const action = readFileSync("app/admin/spieler/[id]/actions.ts", "utf8");
  assert.ok(action.includes("prisma.$transaction"));
  assert.ok(action.includes("ELO_RECALCULATION_TRANSACTION_OPTIONS"));
  assert.ok(action.includes("Alle Änderungen wurden zurückgerollt"));
});

test("AuditLog enthält alte und neue Werte, Zeitpunkt und Mengengerüst", async () => {
  const { tx, writes } = fakeTransaction({ initial: 1200, current: 1333 });
  await changeInitialRatingInTransaction(tx, { playerId: "player-1", adminId: "admin-1", newInitialRating: 1500, reason: "Einstufung korrigiert", confirmed: true }, replay(1505) as never);
  const data = writes.find((write) => write.operation === "audit")?.args.data;
  assert.equal(data.actorUserId, "admin-1"); assert.equal(data.entityType, "PlayerInitialRating");
  assert.deepEqual(data.oldData, { initialRating: 1200, currentRating: 1333 });
  assert.deepEqual(data.newData, { initialRating: 1500, currentRating: 1505, recalculationFrom: firstPlayedAt.toISOString(), recalculatedGames: 2, updatedParticipants: 3 });
  assert.equal(data.note, "Einstufung korrigiert");
});

test("Admin-Action prüft aktive Adminrolle und revalidiert alle betroffenen Ansichten", () => {
  const action = readFileSync("app/admin/spieler/[id]/actions.ts", "utf8");
  assert.ok(action.includes("await requireAdmin()"));
  for (const path of ['revalidatePath("/")', 'revalidatePath("/partien")', 'revalidatePath(`/spieler/${playerId}`)', 'revalidatePath("/admin/spieler")', 'revalidatePath(`/admin/spieler/${playerId}`)']) assert.ok(action.includes(path));
});

test("zentrale Neuberechnung lädt initialRating innerhalb der Transaktion neu", () => {
  const source = readFileSync("lib/elo/recalculation.ts", "utf8");
  assert.ok(source.includes("tx.player.findMany({ select: { id: true, initialRating: true } })"));
  assert.ok(source.indexOf("tx.player.findMany") < source.indexOf("ratingsAtStart"));
});
