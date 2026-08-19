import assert from "node:assert/strict";
import test from "node:test";
import { calculatePlayerStatistics } from "./player-statistics.ts";
import type { StatisticsGame, StatisticsPlayer } from "./types.ts";

const players: StatisticsPlayer[] = [
  { id: "a", alias: "Anna", imageUrl: null, currentRating: 1300 }, { id: "b", alias: "Berta", imageUrl: null, currentRating: 1300 },
  { id: "c", alias: "Clara", imageUrl: null, currentRating: 1100 }, { id: "d", alias: "Dora", imageUrl: null, currentRating: 1000 },
];
const game = (n: number, rows: Array<{ id: string; place: number; points: number; change: number; before?: number }>): StatisticsGame => ({ id: `g${n}`, playedAt: new Date(`2026-01-${String(n).padStart(2, "0")}T12:00:00Z`), createdAt: new Date(`2026-01-${String(n).padStart(2, "0")}T13:00:00Z`), participants: rows.map((r, i) => ({ id: `g${n}-${i}`, playerId: r.id, alias: r.id.toUpperCase(), imageUrl: null, points: r.points, placement: r.place, ratingBefore: r.before ?? 1000, ratingChange: r.change, ratingAfter: (r.before ?? 1000) + r.change, missionId: "m1", missionKept: true })) });

test("aktuelle Elo nutzt dichte geteilte Top-3-Ränge", () => {
  const top = calculatePlayerStatistics(players, []).currentTop;
  assert.deepEqual(top.map((p) => [p.id, p.rank]), [["a", 1], ["b", 1], ["c", 2], ["d", 3]]);
});

test("höchste Elo behält die erste stabile Erreichung und Einzelpunkte alle Rekordhalter", () => {
  const result = calculatePlayerStatistics(players, [game(1, [{ id: "a", place: 1, points: 100, change: 50 }]), game(2, [{ id: "a", place: 1, points: 100, change: 50 }, { id: "b", place: 2, points: 100, change: 50 }])]);
  assert.equal(result.highestAllTime.find((r) => r.id === "a")?.gameId, "g1");
  assert.deepEqual(result.highestScore.map((r) => r.id), ["a", "b"]);
});

test("Winrate und Durchschnittspunkte verlangen fünf Partien und wenden Tiebreaker an", () => {
  const games = Array.from({ length: 6 }, (_, i) => game(i + 1, [{ id: "a", place: i < 5 ? 1 : 2, points: 100, change: 1 }, ...(i < 5 ? [{ id: "b", place: i < 4 ? 1 : 2, points: 100, change: 1 }] : [])]));
  const result = calculatePlayerStatistics(players, games);
  assert.equal(result.highestWinRate[0].id, "a"); // gleiche Rate 4/5 vs 5/6? a gewinnt fachlich ohnehin
  assert.equal(result.highestAveragePoints[0].id, "a"); // gleiches Mittel, mehr Partien
  assert.ok(!result.highestWinRate.some((row) => row.id === "c"));
});

test("Winning Streak betrachtet nur eigene Partien, erkennt Ende, Laufstatus und Punkte-Tiebreak", () => {
  const games = [game(1, [{ id: "a", place: 1, points: 90, change: 1 }]), game(2, [{ id: "b", place: 2, points: 70, change: -1 }]), game(3, [{ id: "a", place: 1, points: 100, change: 1 }]), game(4, [{ id: "a", place: 2, points: 80, change: -1 }]), game(5, [{ id: "b", place: 1, points: 120, change: 1 }]), game(6, [{ id: "b", place: 1, points: 120, change: 1 }])];
  const result = calculatePlayerStatistics(players, games);
  assert.equal(result.longestWinningStreak[0].id, "b"); assert.equal(result.longestWinningStreak[0].running, true); assert.equal(result.longestWinningStreak[0].firstGameId, "g5");
});

test("Nichtverlust-Serie zählt Null, endet negativ und bewertet Gewinn sowie kürzere Serie", () => {
  const games = [game(1, [{ id: "a", place: 2, points: 80, change: 0 }]), game(2, [{ id: "a", place: 1, points: 90, change: 10 }]), game(3, [{ id: "a", place: 4, points: 50, change: -1 }]), game(4, [{ id: "b", place: 1, points: 100, change: 10 }])];
  const result = calculatePlayerStatistics(players, games);
  assert.equal(result.longestNonLossStreak[0].games, 2); assert.equal(result.greatestNonLossGain[0].id, "b"); assert.equal(result.greatestNonLossGain[0].games, 1);
});

test("gleitende Fünfer- und Zehnerfenster nutzen eigene Partien und verlinken den Anfang", () => {
  const games = Array.from({ length: 10 }, (_, i) => game(i + 1, [{ id: "a", place: 1, points: 100, change: i + 1, before: 1000 + i * 10 }]));
  const result = calculatePlayerStatistics(players, games);
  assert.equal(result.bestFiveGameGain[0].firstGameId, "g6"); assert.equal(result.bestFiveGameGain[0].games, 5);
  assert.equal(result.bestTenGameGain[0].firstGameId, "g1"); assert.equal(result.bestTenGameGain[0].games, 10);
});
