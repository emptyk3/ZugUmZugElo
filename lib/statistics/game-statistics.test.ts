import assert from "node:assert/strict";
import test from "node:test";
import { buildGamePointsTimeline, calculateGameStatistics } from "./game-statistics.ts";
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

test("Zeitreihe sortiert stabil nach playedAt, createdAt und id", () => {
  const first = game("3", [103, 90, 80, 70]);
  const second = game("2", [102, 90, 80, 70]);
  const third = game("1", [101, 90, 80, 70]);
  for (const row of [first, second, third]) row.playedAt = new Date("2026-02-01T12:00:00Z");
  first.createdAt = new Date("2026-02-01T12:01:00Z");
  second.createdAt = third.createdAt = new Date("2026-02-01T12:00:00Z");
  assert.deepEqual(buildGamePointsTimeline([first, second, third]).map((row) => row.gameId), ["1", "2", "3"]);
});

test("Zeitreihe berechnet Partie- und kumulative Werte ohne vorzeitige Rundung", () => {
  const result = buildGamePointsTimeline([
    game("1", [100, 90, 80, 70]),
    game("2", [200, 20, 20, 20, 20]),
  ]);
  assert.deepEqual(result.map((row) => row.winnerPoints), [100, 200]);
  assert.deepEqual(result.map((row) => row.gameAveragePoints), [85, 56]);
  assert.deepEqual(result.map((row) => row.cumulativeWinnerAverage), [100, 150]);
  assert.equal(result[0].cumulativePlayerAverage, 85);
  assert.equal(result[1].cumulativePlayerAverage, 620 / 9); // alle 9 Einzelergebnisse, nicht (85 + 56) / 2
});

test("Zeitreihe verwendet den gespeicherten Erstplatzierten", () => {
  const [entry] = buildGamePointsTimeline([game("1", [120, 130, 80, 70], [2, 1, 3, 4])]);
  assert.equal(entry.winnerPoints, 130);
});

test("Vierer- und Fünferzeitreihen filtern und kumulieren unabhängig", () => {
  const result = calculateGameStatistics([
    game("1", [100, 90, 80, 70]),
    game("2", [200, 20, 20, 20, 20]),
    game("3", [140, 100, 90, 80]),
  ]);
  assert.deepEqual(result.timelines.fourPlayers.map((row) => row.gameId), ["1", "3"]);
  assert.deepEqual(result.timelines.fivePlayers.map((row) => row.gameId), ["2"]);
  assert.deepEqual(result.timelines.fourPlayers.map((row) => row.cumulativeWinnerAverage), [100, 120]);
  assert.deepEqual(result.timelines.fivePlayers.map((row) => row.cumulativeWinnerAverage), [200]);
  assert.equal(result.timelines.fourPlayers[1].cumulativePlayerAverage, 750 / 8);
  assert.equal(result.timelines.fivePlayers[0].cumulativePlayerAverage, 56);
});

test("eine einzelne Partie und leere Kategorien erzeugen gültige Zeitreihen", () => {
  const result = calculateGameStatistics([game("1", [100, 90, 80, 70])]);
  assert.equal(result.timelines.total.length, 1);
  assert.equal(result.timelines.total[0].cumulativeWinnerAverage, 100);
  assert.deepEqual(result.timelines.fivePlayers, []);
  assert.deepEqual(calculateGameStatistics([]).timelines, { total: [], fourPlayers: [], fivePlayers: [] });
});
