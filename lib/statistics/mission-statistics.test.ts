import assert from "node:assert/strict";
import test from "node:test";
import { calculateMissionStatistics, createMissionRankings, type MissionStatisticRow } from "./mission-statistics.ts";
import type { StatisticsGame } from "./types.ts";

const catalog = [{ id: "m1", name: "Mission 1", sortOrder: 1 }, { id: "m2", name: "Mission 2", sortOrder: 2 }];
const game = (id: string, rows: Array<[string, boolean, number, number]>): StatisticsGame => ({ id, playedAt: new Date(`2026-01-0${id}T12:00:00Z`), createdAt: new Date(`2026-01-0${id}T13:00:00Z`), participants: rows.map(([missionId, missionKept, points, placement], i) => ({ id: `${id}-${i}`, playerId: `p${i}`, alias: `P${i}`, imageUrl: null, points, placement, ratingBefore: 1000, ratingChange: 0, ratingAfter: 1000, missionId, missionKept })) });

test("Ausgeteilt zählt alle Zuordnungen, Leistung nur behaltene und nicht behaltene nur Ohne Mission", () => {
  const result = calculateMissionStatistics([game("1", [["m1", true, 100, 1], ["m1", false, 90, 2], ["m2", true, 80, 3]])], catalog);
  const m1 = result.rows[0], without = result.rows[2];
  assert.equal(m1.drawn, 2); assert.equal(m1.kept, 1); assert.equal(m1.averagePoints, 100); assert.equal(m1.winRate, 1);
  assert.equal(m1.drawnRate, 2 / 3); assert.equal(m1.keptRate, 1 / 2);
  assert.equal(without.drawn, null); assert.equal(without.kept, 1); assert.equal(without.keptRate, 1 / 3);
  assert.equal(without.averagePoints, 90); assert.equal(without.winRate, 0);
  assert.equal(result.rankings.kept["without-mission"], 1); assert.equal(result.rankings.keptRate["without-mission"], 3);
});

test("Durchschnitte, Keine-Daten und stabil frühester Maximalpunkte-Link sind korrekt", () => {
  const result = calculateMissionStatistics([game("1", [["m1", true, 100, 2]]), game("2", [["m1", true, 100, 1]])], catalog);
  const m1 = result.rows[0]; assert.equal(m1.averagePlacement, 1.5); assert.equal(m1.averagePoints, 100); assert.equal(m1.averageWinnerPoints, 100); assert.equal(m1.maxPoints?.gameId, "1");
  assert.equal(result.rows[1].averageWinnerPoints, null);
});

test("Leistungsrankings markieren exakte Gleichstände und Ohne Mission", () => {
  const result = calculateMissionStatistics([game("1", [["m1", true, 100, 1], ["m2", true, 100, 1], ["m2", false, 110, 1]])], catalog);
  assert.equal(result.rankings.wins.m1, 1); assert.equal(result.rankings.wins.m2, 1); assert.equal(result.rankings.wins["without-mission"], 1);
  assert.equal(result.rankings.averagePlacement.m1, 1); assert.equal(result.rankings.averagePlacement["without-mission"], 1);
  assert.equal(result.rankings.maxPoints["without-mission"], 1);
  assert.deepEqual(result.rankings.drawn, {}); assert.deepEqual(result.rankings.drawnRate, {});
});

test("ungerundete Werte erzeugen keinen falschen Anzeige-Gleichstand", () => {
  const result = calculateMissionStatistics([game("1", [["m1", true, 100, 1], ["m1", true, 101, 2], ["m2", true, 100, 1], ["m2", true, 100, 2]])], catalog);
  assert.equal(result.rankings.averagePoints.m1, 1); assert.equal(result.rankings.averagePoints.m2, 2);
});

const rankedRow = (id: string, value: number | null, without = false): MissionStatisticRow => ({
  id, name: id, isWithoutMission: without, drawn: value, drawnRate: value, kept: value, keptRate: value,
  wins: value ?? 0, winRate: value, averagePlacement: value, averagePoints: value,
  averageWinnerPoints: value, maxPoints: value === null ? null : { value, gameId: `game-${id}` },
});

test("alle acht Leistungswerte verwenden Top 3, Verteilungswerte nie", () => {
  const rankings = createMissionRankings([rankedRow("first", 40), rankedRow("second", 30), rankedRow("third", 20), rankedRow("fourth", 10)]);
  assert.deepEqual(rankings.drawn, {}); assert.deepEqual(rankings.drawnRate, {});
  for (const metric of ["kept", "keptRate", "wins", "winRate", "averagePoints", "averageWinnerPoints", "maxPoints"] as const) {
    assert.deepEqual(rankings[metric], { first: 1, second: 2, third: 3 });
  }
  assert.deepEqual(rankings.averagePlacement, { fourth: 1, third: 2, second: 3 });
});

test("klassische Wettbewerbsplatzierung überspringt nach zwei ersten Plätzen Rang 2", () => {
  const rankings = createMissionRankings([rankedRow("a", 45), rankedRow("b", 45), rankedRow("c", 38.2), rankedRow("d", 30)]);
  assert.deepEqual(rankings.winRate, { a: 1, b: 1, c: 3 });
});

test("Ohne Mission nimmt an sämtlichen Leistungsrankings einschließlich Behalten teil", () => {
  const rankings = createMissionRankings([rankedRow("mission", 10), rankedRow("without-mission", 20, true)]);
  for (const metric of ["kept", "keptRate", "wins", "winRate", "averagePoints", "averageWinnerPoints", "maxPoints"] as const) assert.equal(rankings[metric]["without-mission"], 1);
  assert.equal(rankings.averagePlacement["without-mission"], 2);
});

test("Ranking vergleicht ungerundete Rohwerte und ignoriert null sowie NaN", () => {
  const rows = [rankedRow("precise-first", 100.04), rankedRow("precise-second", 100.03), rankedRow("none", null), rankedRow("invalid", Number.NaN)];
  const rankings = createMissionRankings(rows);
  assert.equal(rankings.averagePoints["precise-first"], 1); assert.equal(rankings.averagePoints["precise-second"], 2);
  assert.equal(rankings.averagePoints.none, undefined); assert.equal(rankings.averagePoints.invalid, undefined);
});
