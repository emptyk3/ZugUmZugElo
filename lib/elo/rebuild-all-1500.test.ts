import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { rebuildAllEloAt1500InTransaction } from "./rebuild-all-1500.ts";

const playedAt = new Date("2026-01-01T12:00:00Z");
const createdAt = new Date("2026-01-01T13:00:00Z");
const players = [
  { id: "a", initialRating: 1200 }, { id: "b", initialRating: 1500 },
  { id: "c", initialRating: 1200 }, { id: "d", initialRating: 1500 },
  { id: "without-game", initialRating: 1200 },
];
const games = [
  { id: "first", playedAt, createdAt, participants: ["a", "b", "c", "d"].map((playerId, index) => ({ id: `first-${playerId}`, playerId, points: 100 - index * 10, tiebreakRank: null })) },
  { id: "second", playedAt: new Date("2026-02-01T12:00:00Z"), createdAt, participants: ["d", "c", "b", "a"].map((playerId, index) => ({ id: `second-${playerId}`, playerId, points: 100 - index * 10, tiebreakRank: null })) },
];

function fakeTransaction() {
  const calls: Array<{ operation: string; args: any }> = [];
  const tx = {
    player: { findMany: async () => players, updateMany: async (args: any) => { calls.push({ operation: "players", args }); return { count: players.length }; } },
    game: { findMany: async (args: any) => { calls.push({ operation: "games", args }); return games; } },
    auditLog: { findFirst: async () => null, create: async (args: any) => { calls.push({ operation: "audit", args }); return {}; } },
  } as unknown as Prisma.TransactionClient;
  return { tx, calls };
}

test("Legacy-Spieler werden gemeinsam auf 1500 gesetzt und die gesamte Historie wird neu aufgebaut", async () => {
  const { tx, calls } = fakeTransaction();
  let replay: any;
  const result = await rebuildAllEloAt1500InTransaction(tx, async (_transaction, calculated) => { replay = calculated; });
  assert.deepEqual(calls.find((call) => call.operation === "players")?.args.data, { initialRating: 1500 });
  assert.equal(result.affectedPlayers, 3);
  assert.equal(result.recalculatedGames, 2);
  assert.equal(replay.finalRatings.get("without-game"), 1500);
  assert.ok(replay.participantUpdates.every((row: any) => Number.isFinite(row.ratingBefore) && Number.isFinite(row.ratingChange) && Number.isFinite(row.ratingAfter)));
  const firstA = replay.participantUpdates.find((row: any) => row.id === "first-a");
  const secondA = replay.participantUpdates.find((row: any) => row.id === "second-a");
  assert.equal(firstA.ratingBefore, 1500);
  assert.equal(secondA.ratingBefore, firstA.ratingAfter);
});

test("Rebuild lädt nur bestätigte, nicht gelöschte Partien in stabiler Reihenfolge", async () => {
  const { tx, calls } = fakeTransaction();
  await rebuildAllEloAt1500InTransaction(tx, async () => undefined);
  const query = calls.find((call) => call.operation === "games")?.args;
  assert.deepEqual(query.where, { status: "CONFIRMED", deletedAt: null });
  assert.deepEqual(query.orderBy, [{ playedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }]);
});

test("ein Replay-Fehler verhindert Audit und wird an die Rollback-Transaktion weitergegeben", async () => {
  const { tx, calls } = fakeTransaction();
  await assert.rejects(rebuildAllEloAt1500InTransaction(tx, async () => { throw new Error("Schreibfehler"); }), /Schreibfehler/);
  assert.equal(calls.some((call) => call.operation === "audit"), false);
  const script = readFileSync("scripts/rebuild-all-elo-1500.ts", "utf8");
  assert.match(script, /prisma\.\$transaction/);
  assert.match(script, /--execute/);
  assert.match(script, /vollständig zurückgerollt/);
});

test("produktive Spieler-Anlagewege verwenden ausschließlich das zentrale Start-Elo", () => {
  const registration = readFileSync("app/auth-actions.ts", "utf8");
  const gameEntry = readFileSync("app/partie-eintragen/actions.ts", "utf8");
  for (const source of [registration, gameEntry]) {
    assert.match(source, /initialRating: DEFAULT_INITIAL_RATING/);
    assert.match(source, /currentRating: DEFAULT_INITIAL_RATING/);
    assert.doesNotMatch(source, /1200|beginner|advanced/);
  }
  for (const file of ["app/registrieren/page.tsx", "app/partie-eintragen/page.tsx"]) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /Anfänger|Fortgeschritten|1200|Startniveau/);
  }
});

test("Adminseite zeigt Start-Elo nur noch als Information", () => {
  const page = readFileSync("app/admin/spieler/[id]/page.tsx", "utf8");
  assert.match(page, /<dt>Start-Elo<\/dt>/);
  assert.doesNotMatch(page, /InitialRatingForm|Start-Elo ändern/);
});
