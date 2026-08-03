import assert from "node:assert/strict";
import test from "node:test";
import { calculateMissionStats, type MissionParticipation } from "./mission-stats.ts";

const mission = (id: string, placements: number[], kept = true): MissionParticipation[] => placements.map((placement, index) => ({ points: 100 + index, placement, missionKept: kept, gameId: `${id}-${index}`, playedAt: new Date(2026, 0, index + 1), mission: id === "none" ? null : { id, name: id, sortOrder: id.charCodeAt(0) } }));

test("Ohne Mission ist eine eigene neutrale Zeile", () => { const stats = calculateMissionStats(mission("none", [1])); assert.equal(stats.rows[0].name, "Ohne Mission"); assert.equal(stats.rows[0].isWithoutMission, true); });
test("Lieblings-, beste und schlechteste Mission beachten Fachregeln", () => {
  const stats = calculateMissionStats([...mission("A", [1, 1, 2]), ...mission("B", [1, 4]), ...mission("C", [3, 4])]);
  assert.equal(stats.favorite?.name, "A"); assert.equal(stats.best?.name, "A"); assert.equal(stats.worst?.name, "C");
  assert.equal(calculateMissionStats(mission("A", [1])).best, null);
});
test("Behalten- und Nicht-behalten-Anteile sind aus den Partien ableitbar", () => { const stats = calculateMissionStats([...mission("A", [1, 2]), ...mission("A", [3], false)]).rows[0]; assert.deepEqual([stats.kept / stats.games, stats.notKept / stats.games], [2 / 3, 1 / 3]); });
