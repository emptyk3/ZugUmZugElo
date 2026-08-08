import assert from "node:assert/strict";
import test from "node:test";
import { calculateMissionStatistics } from "./mission-statistics.ts";
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
  assert.ok(!result.best.kept.includes("without-mission")); assert.ok(!result.best.keptRate.includes("without-mission"));
});

test("Durchschnitte, Keine-Daten und stabil frühester Maximalpunkte-Link sind korrekt", () => {
  const result = calculateMissionStatistics([game("1", [["m1", true, 100, 2]]), game("2", [["m1", true, 100, 1]])], catalog);
  const m1 = result.rows[0]; assert.equal(m1.averagePlacement, 1.5); assert.equal(m1.averagePoints, 100); assert.equal(m1.averageWinnerPoints, 100); assert.equal(m1.maxPoints?.gameId, "1");
  assert.equal(result.rows[1].averageWinnerPoints, null);
});

test("Bestwerte markieren alle exakten Gleichstände, Platzierung minimiert und Ohne Mission darf gewinnen", () => {
  const result = calculateMissionStatistics([game("1", [["m1", true, 100, 1], ["m2", true, 100, 1], ["m2", false, 110, 1]])], catalog);
  assert.deepEqual(result.best.wins, ["m1", "m2", "without-mission"]);
  assert.deepEqual(result.best.averagePlacement, ["m1", "m2", "without-mission"]);
  assert.deepEqual(result.best.maxPoints, ["without-mission"]);
  assert.ok(!result.best.drawn.includes("without-mission"));
});

test("ungerundete Werte erzeugen keinen falschen Anzeige-Gleichstand", () => {
  const result = calculateMissionStatistics([game("1", [["m1", true, 100, 1], ["m1", true, 101, 2], ["m2", true, 100, 1], ["m2", true, 100, 2]])], catalog);
  assert.deepEqual(result.best.averagePoints, ["m1"]);
});
