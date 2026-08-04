import assert from "node:assert/strict";
import test from "node:test";
import { calculateMissionStats, type MissionDefinition, type MissionParticipation } from "./mission-stats.ts";

const catalog: MissionDefinition[] = Array.from({ length: 6 }, (_, index) => ({ id: `m${index + 1}`, name: `Mission ${index + 1}`, sortOrder: index + 1 }));
const rows = (missionId: string, placements: number[], kept = true, points = 100): MissionParticipation[] => placements.map((placement, index) => ({
  points: points + index, placement, missionKept: kept, gameId: `${missionId}-${kept}-${index}`, playedAt: new Date(2026, 0, index + 1), mission: catalog.find((mission) => mission.id === missionId)!,
}));

test("Tabelle enthält Gesamt, sechs Missionen und Ohne Mission", () => {
  assert.deepEqual(calculateMissionStats([], catalog).rows.map((row) => row.name), ["Gesamt", ...catalog.map((mission) => mission.name), "Ohne Mission"]);
});

test("behaltene Mission zählt nur in ihrer Mission und nicht behaltene ausschließlich in Ohne Mission", () => {
  const stats = calculateMissionStats([...rows("m1", [1, 2]), ...rows("m1", [3], false)], catalog);
  const mission = stats.rows.find((row) => row.id === "m1")!;
  const without = stats.rows.find((row) => row.isWithoutMission)!;
  const total = stats.rows.find((row) => row.isTotal)!;
  assert.deepEqual({ missionGames: mission.games, withoutGames: without.games, totalGames: total.games }, { missionGames: 2, withoutGames: 1, totalGames: 3 });
  assert.equal(mission.keptRate, 2 / 3);
  assert.equal(without.keptRate, null);
});

test("Highlights benötigen zwei Kategorien mit jeweils mindestens drei Partien", () => {
  assert.equal(calculateMissionStats(rows("m1", [1, 1, 2]), catalog).best, null);
  const stats = calculateMissionStats([...rows("m1", [1, 1, 2]), ...rows("m2", [3, 4, 4])], catalog);
  assert.equal(stats.best?.id, "m1"); assert.equal(stats.worst?.id, "m2");
});

test("Ohne Mission kann beste oder schlechteste Kategorie sein", () => {
  const bestWithout = calculateMissionStats([...rows("m1", [3, 4, 4]), ...rows("m2", [1, 1, 2], false)], catalog);
  assert.equal(bestWithout.best?.id, "without-mission");
  const worstWithout = calculateMissionStats([...rows("m1", [1, 1, 2]), ...rows("m2", [3, 4, 4], false)], catalog);
  assert.equal(worstWithout.worst?.id, "without-mission");
});

test("Mission-Tiebreak nutzt Winrate, Platzierung, Punkte und stabilen Namen", () => {
  const stats = calculateMissionStats([...rows("m1", [1, 2, 3], true, 90), ...rows("m2", [1, 2, 3], true, 100)], catalog);
  assert.equal(stats.best?.id, "m2"); assert.equal(stats.worst?.id, "m1");
});
