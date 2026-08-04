import assert from "node:assert/strict";
import test from "node:test";
import { calculateGameStatistics } from "./game-statistics.ts";
import type { StatisticsGame } from "./types.ts";

const game = (id: string, points: number[], placements = points.map((_, i) => i + 1)): StatisticsGame => ({ id, playedAt: new Date(`2026-01-${id.padStart(2, "0")}T12:00:00Z`), createdAt: new Date(`2026-01-${id.padStart(2, "0")}T13:00:00Z`), participants: points.map((score, i) => ({ id: `${id}-${i}`, playerId: `p${i}`, alias: `P${i}`, imageUrl: null, points: score, placement: placements[i], ratingBefore: 1000, ratingChange: 0, ratingAfter: 1000, missionId: "m1", missionKept: true })) });

test("Spielstatistiken teilen Vierer- und Fünferpartien auf und mitteln Teilnehmer direkt", () => {
  const result = calculateGameStatistics([game("1", [100, 90, 80, 70]), game("2", [200, 20, 20, 20, 20])]);
  assert.equal(result.total.games, 2); assert.equal(result.fourPlayers.games, 1); assert.equal(result.fivePlayers.games, 1);
  assert.equal(result.total.averagePoints, 620 / 9); // kein Mittel der beiden Partiemittel
  assert.equal(result.total.averageWinnerPoints, 150);
});

test("gespeicherter Erstplatzierter zählt auch beim Punktegleichstand", () => {
  const result = calculateGameStatistics([game("1", [100, 100, 80, 70], [2, 1, 3, 4])]);
  assert.equal(result.total.averageWinnerPoints, 100);
});

test("leere und unerwartete Kategorien bleiben definiert", () => {
  const empty = calculateGameStatistics([]);
  assert.deepEqual(empty.fourPlayers, { games: 0, averagePoints: null, averageWinnerPoints: null });
  assert.equal(calculateGameStatistics([game("1", [10, 9, 8])]).unexpectedPlayerCountGames, 1);
});

