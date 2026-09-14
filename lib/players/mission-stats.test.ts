import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculateMissionStats, type MissionDefinition, type MissionParticipation } from "./mission-stats.ts";

const catalog: MissionDefinition[] = Array.from({ length: 6 }, (_, index) => ({ id: `m${index + 1}`, name: `Mission ${index + 1}`, sortOrder: index + 1 }));
const rows = (missionId: string, placements: number[], kept = true, points = 100): MissionParticipation[] => placements.map((placement, index) => ({
  points: points + index, placement, missionKept: kept, gameId: `${missionId}-${kept}-${index}`, playedAt: new Date(2026, 0, index + 1), mission: catalog.find((mission) => mission.id === missionId)!,
}));

test("Tabelle enthält Gesamt ohne Rang sowie sechs Missionen und Ohne Mission", () => {
  const result = calculateMissionStats([], catalog);
  assert.deepEqual(result.rows.map((row) => row.name), ["Gesamt", ...catalog.map((mission) => mission.name), "Ohne Mission"]);
  assert.equal(result.rows[0].missionRank, null);
});

test("behaltene Mission zählt nur in ihrer Mission und nicht behaltene ausschließlich in Ohne Mission", () => {
  const stats = calculateMissionStats([...rows("m1", [1, 2]), ...rows("m1", [3], false)], catalog);
  const mission = stats.rows.find((row) => row.id === "m1")!;
  const without = stats.rows.find((row) => row.isWithoutMission)!;
  const total = stats.rows.find((row) => row.isTotal)!;
  assert.deepEqual({ missionGames: mission.games, withoutGames: without.games, totalGames: total.games }, { missionGames: 2, withoutGames: 1, totalGames: 3 });
  assert.equal(mission.keptRate, 2 / 3);
  assert.equal(without.keptRate, null);
  assert.equal(mission.placementStandardDeviation, .5);
  assert.equal(mission.pointsStandardDeviation, .5);
  assert.equal(mission.medianPoints, 100.5);
  assert.equal(without.placementStandardDeviation, 0);
  assert.equal(without.pointsStandardDeviation, 0);
  assert.equal(total.placementStandardDeviation, Math.sqrt(2 / 3));
  assert.ok(Math.abs(total.pointsStandardDeviation! - Math.sqrt(2) / 3) < 1e-12);
});

test("σ Platz und σ Punkte sind Populationswerte und leere Kategorien bleiben gültig", () => {
  const stats = calculateMissionStats(rows("m1", [1, 2, 3], true, 90), catalog);
  const mission = stats.rows.find((item) => item.id === "m1")!;
  const empty = stats.rows.find((item) => item.id === "m2")!;
  assert.ok(Math.abs(mission.placementStandardDeviation! - Math.sqrt(2 / 3)) < 1e-12);
  assert.ok(Math.abs(mission.pointsStandardDeviation! - Math.sqrt(2 / 3)) < 1e-12);
  assert.equal(mission.medianPoints, 91);
  assert.equal(empty.medianPoints, null);
  assert.equal(empty.placementStandardDeviation, null);
  assert.equal(empty.pointsStandardDeviation, null);
  assert.doesNotMatch(JSON.stringify(stats), /NaN|Infinity/);
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

test("Mission-Tiebreak nutzt nach Platzierung Winrate, Punkte und stabilen Namen", () => {
  const stats = calculateMissionStats([...rows("m1", [1, 2, 3], true, 90), ...rows("m2", [1, 2, 3], true, 100)], catalog);
  assert.equal(stats.best?.id, "m2"); assert.equal(stats.worst?.id, "m1");
});

test("Missionen einschließlich Ohne Mission werden nach Leistung sortiert und fortlaufend gerankt", () => {
  const stats = calculateMissionStats([
    ...rows("m1", [2, 2, 2], true, 100),
    ...rows("m2", [1, 2, 3], true, 100),
    ...rows("m3", [1, 2, 3], true, 110),
    ...rows("m4", [1, 1, 1], false, 90),
  ], catalog);
  assert.deepEqual(stats.rows.slice(0, 5).map((row) => [row.id, row.missionRank]), [
    ["total", null], ["without-mission", 1], ["m3", 2], ["m2", 3], ["m1", 4],
  ]);
});

test("vollständige Leistungsgleichstände teilen sich den Rang wie in der globalen Statistik", () => {
  const stats = calculateMissionStats([
    ...rows("m1", [1, 2, 3], true, 100),
    ...rows("m2", [1, 2, 3], true, 100),
    ...rows("m3", [2, 3, 4], true, 100),
  ], catalog);
  const ranked = stats.rows.filter((row) => ["m1", "m2", "m3"].includes(row.id));
  assert.deepEqual(ranked.map((row) => [row.id, row.missionRank]), [["m1", 1], ["m2", 1], ["m3", 3]]);
});

test("Beste und schlechteste Mission werden primär über Ø Platzierung statt Winrate gewählt", () => {
  const stats = calculateMissionStats([
    ...rows("m1", [1, 2, 2], true, 100),
    ...rows("m2", [1, 1, 5], true, 120),
  ], catalog);
  assert.equal(stats.best?.id, "m1");
  assert.equal(stats.worst?.id, "m2");
  assert.ok(stats.best!.winRate! < stats.worst!.winRate!);
});

test("Standardabweichungen verändern die Auswahl der Highlights nicht", () => {
  const stable = rows("m1", [1, 2, 3], true, 100).map((item) => ({ ...item, points: 100 }));
  const variable = rows("m2", [1, 2, 3], true, 100).map((item, index) => ({ ...item, points: [80, 100, 120][index] }));
  const stats = calculateMissionStats([...stable, ...variable], catalog);
  assert.equal(stats.best?.id, "m1");
  assert.equal(stats.worst?.id, "m1");
  assert.notEqual(stats.best?.pointsStandardDeviation, stats.rows.find((item) => item.id === "m2")?.pointsStandardDeviation);
});

test("Profil-Missionsstatistik zeigt kleine σ-Spalten und kennzeichnet alle Streuungswerte mit ±", () => {
  const page = readFileSync("app/spieler/[id]/page.tsx", "utf8");
  const css = readFileSync("app/spieler/[id]/page.module.css", "utf8");
  assert.match(page, /<th>Ø Platz<\/th><th className=\{styles\.sigmaHeader\}>σ<\/th><th>Median Punkte<\/th><th>Ø Punkte<\/th><th className=\{styles\.sigmaHeader\}>σ<\/th><th>Max\. Punkte<\/th>/);
  assert.match(css, /\.tableWrap thead th\.sigmaHeader\{text-transform:none\}/);
  assert.doesNotMatch(page, /Σ Platz|Σ Punkte/);
  assert.match(page, /const missionDeviation = \(value: number \| null, digits: number\) => value === null \? "—" : `± \$\{fixedNumber\(value, digits\)\}`/);
  assert.match(page, /<dt>σ Platzierung<\/dt><dd>\{missionDeviation\(mission\.placementStandardDeviation, 2\)\}<\/dd>/);
  assert.match(page, /<dt>σ Punkte<\/dt><dd>\{missionDeviation\(mission\.pointsStandardDeviation, 1\)\}<\/dd>/);
  assert.match(page, /<td>\{missionDeviation\(row\.placementStandardDeviation, 2\)\}<\/td>/);
  assert.match(page, /<td>\{missionDeviation\(row\.pointsStandardDeviation, 1\)\}<\/td>/);
  assert.doesNotMatch(page, /row\.(?:placement|points)StandardDeviation === null \? "Keine Daten"/);
  assert.match(page, /MissionFeature label="Beste Mission"/);
  assert.match(page, /MissionFeature label="Schlechteste Mission"/);
  assert.match(page, /<dt>Median Punkte<\/dt><dd>\{pointsNumber\(mission\.medianPoints\)\}<\/dd>/);
  assert.match(page, /row\.highestScore \? <Link/);
  assert.match(page, /<th className=\{styles\.missionRankHeader\}>Rang<\/th><th>Mission<\/th>/);
  assert.match(page, /missionRankLabel\(row\.missionRank\)/);
  assert.match(page, /const missionRankMarks = \{ 1: "🏆", 2: "🥈", 3: "🥉" \}/);
  assert.match(css, /\.missionRankColumn\{width:42px\}/);
});
