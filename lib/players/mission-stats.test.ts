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
  assert.ok(result.rows.every((row) => row.missionRank === null));
});

test("behaltene Mission zählt nur in ihrer Mission und nicht behaltene ausschließlich in Ohne Mission", () => {
  const stats = calculateMissionStats([...rows("m1", [1, 2]), ...rows("m1", [3], false)], catalog);
  const mission = stats.rows.find((row) => row.id === "m1")!;
  const without = stats.rows.find((row) => row.isWithoutMission)!;
  const total = stats.rows.find((row) => row.isTotal)!;
  assert.deepEqual({ missionGames: mission.games, withoutGames: without.games, totalGames: total.games }, { missionGames: 2, withoutGames: 1, totalGames: 3 });
  assert.equal(mission.keptRate, 2 / 3);
  assert.equal(without.keptRate, 1 / 3);
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

test("Kategorien mit null, einer oder zwei Partien bleiben ungerankt und folgen alphabetisch am Ende", () => {
  const stats = calculateMissionStats([
    ...rows("m2", [1]),
    ...rows("m3", [1, 2]),
    ...rows("m4", [2, 2, 2]),
    ...rows("m5", [1, 1], false),
  ], catalog);
  assert.deepEqual(stats.rows.map((row) => [row.id, row.missionRank]), [
    ["total", null], ["m4", 1], ["m1", null], ["m2", null], ["m3", null], ["m5", null], ["m6", null], ["without-mission", null],
  ]);
});

test("nur rankingfähige Kategorien beeinflussen Top-3-Hervorhebungen", () => {
  const stats = calculateMissionStats([
    ...rows("m1", [1, 1, 1], true, 100),
    ...rows("m2", [1, 2, 2], true, 90),
    ...rows("m3", [4, 4, 4], true, 200),
    ...rows("m4", [1, 1], true, 500),
  ], catalog);
  assert.deepEqual(stats.rankings.wins, { m1: 1, m2: 2, m3: 3 });
  assert.equal(stats.rankings.averagePoints.m3, 1);
  assert.equal(stats.rankings.averagePoints.m4, undefined);
  assert.equal(stats.rankings.averagePlacement.m4, undefined);
});

test("Max. Punkte rankt nur qualifizierte Kategorien absteigend", () => {
  const stats = calculateMissionStats([
    ...rows("m1", [1, 2, 3], true, 100),
    ...rows("m2", [1, 2, 3], true, 200),
    ...rows("m3", [1, 2, 3], true, 300),
    ...rows("m4", [1, 1], true, 900),
  ], catalog);
  assert.deepEqual(stats.rankings.highestScore, { m3: 1, m2: 2, m1: 3 });
  assert.equal(stats.rankings.highestScore.m4, undefined);
});

test("Gleichstände bei Max. Punkte erhalten denselben Wettbewerbsrang", () => {
  const first = rows("m1", [1, 2, 3], true, 100).map((row, index) => ({ ...row, points: [90, 95, 110][index] }));
  const second = rows("m2", [1, 2, 3], true, 100).map((row, index) => ({ ...row, points: [80, 100, 110][index] }));
  const third = rows("m3", [1, 2, 3], true, 100).map((row, index) => ({ ...row, points: [70, 90, 100][index] }));
  const stats = calculateMissionStats([...first, ...second, ...third], catalog);
  assert.deepEqual(stats.rankings.highestScore, { m1: 1, m2: 1, m3: 3 });
});

test("Ohne Mission zeigt seinen Anteil an allen bestätigten Partien", () => {
  const kept = rows("m1", Array.from({ length: 46 }, () => 2));
  const without = rows("m2", [3, 4], false);
  const stats = calculateMissionStats([...kept, ...without], catalog);
  assert.equal(stats.rows.find((row) => row.isWithoutMission)?.keptRate, 2 / 48);
  assert.equal(stats.rows.find((row) => row.isTotal)?.keptRate, 46 / 48);
  assert.equal(calculateMissionStats([], catalog).rows.find((row) => row.isWithoutMission)?.keptRate, null);
});

test("Ohne Mission ist ab drei Partien rankingfähig und darunter ungerankt", () => {
  const qualified = calculateMissionStats([...rows("m1", [2, 2, 2]), ...rows("m2", [1, 1, 1], false)], catalog);
  assert.equal(qualified.rows.find((row) => row.isWithoutMission)?.missionRank, 1);
  const unqualified = calculateMissionStats([...rows("m1", [2, 2, 2]), ...rows("m2", [1, 1], false)], catalog);
  const without = unqualified.rows.find((row) => row.isWithoutMission)!;
  assert.equal(without.missionRank, null);
  assert.equal(unqualified.rows.at(-1)?.id, "without-mission");
});

test("unqualifizierte Kategorien können weder beste noch schlechteste Mission werden", () => {
  const stats = calculateMissionStats([
    ...rows("m1", [2, 2, 2]),
    ...rows("m2", [3, 3, 3]),
    ...rows("m3", [1, 1]),
    ...rows("m4", [5, 5]),
  ], catalog);
  assert.equal(stats.best?.id, "m1");
  assert.equal(stats.worst?.id, "m2");
});

test("vollständige Leistungsgleichstände teilen sich den Rang wie in der globalen Statistik", () => {
  const stats = calculateMissionStats([
    ...rows("m1", [1, 2, 3], true, 100),
    ...rows("m2", [1, 2, 3], true, 100),
    ...rows("m3", [2, 3, 4], true, 100),
  ], catalog);
  const ranked = stats.rows.filter((row) => ["m1", "m2", "m3"].includes(row.id));
  assert.deepEqual(ranked.map((row) => [row.id, row.missionRank]), [["m1", 1], ["m2", 1], ["m3", 3]]);
  assert.deepEqual(stats.rankings.averagePlacement, { m1: 1, m2: 1, m3: 3 });
  assert.deepEqual(stats.rankings.winRate, { m1: 1, m2: 1, m3: 3 });
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
  assert.match(page, /<MissionValue rank=\{missions\.rankings\.averagePlacement\[row\.id\]\} showMedal=\{false\} goldPairSide="end">\{missionDeviation\(row\.placementStandardDeviation, 2\)\}<\/MissionValue>/);
  assert.match(page, /<MissionValue rank=\{missions\.rankings\.averagePoints\[row\.id\]\} showMedal=\{false\} goldPairSide="end">\{missionDeviation\(row\.pointsStandardDeviation, 1\)\}<\/MissionValue>/);
  assert.doesNotMatch(page, /row\.(?:placement|points)StandardDeviation === null \? "Keine Daten"/);
  assert.match(page, /MissionFeature label="Beste Mission"/);
  assert.match(page, /MissionFeature label="Schlechteste Mission"/);
  assert.match(page, /<dt>Median Punkte<\/dt><dd>\{pointsNumber\(mission\.medianPoints\)\}<\/dd>/);
  assert.match(page, /<MissionValue rank=\{missions\.rankings\.highestScore\[row\.id\]\}>\{row\.highestScore \? <Link/);
  assert.match(page, /<th className=\{styles\.missionRankHeader\}>Rang<\/th><th>Mission<\/th>/);
  assert.match(page, /missionRankLabel\(row\.missionRank\)/);
  assert.match(page, /const missionRankMarks = \{ 1: "🏆", 2: "🥈", 3: "🥉" \}/);
  assert.match(css, /\.missionRankColumn\{width:42px\}/);
  assert.match(page, /missions\.rankings\.wins\[row\.id\]/);
  assert.match(page, /missions\.rankings\.winRate\[row\.id\]/);
  assert.match(page, /missions\.rankings\.medianPoints\[row\.id\]/);
  assert.doesNotMatch(page, /missions\.rankings\.keptRate/);
  assert.match(page, /<td>\{percent\(row\.keptRate\)\}<\/td>/);
  assert.doesNotMatch(page, /row\.isWithoutMission \? "—" : percent\(row\.keptRate\)/);
  assert.match(page, /where: \{ game: \{ status: GameStatus\.CONFIRMED, deletedAt: null \} \}/);
  assert.match(css, /\.rank1\{background:#f9d966/);
  assert.match(css, /\.rank2\{background:#e3e6e8/);
  assert.match(css, /\.rank3\{background:#f3e2d3/);
  assert.match(css, /\.goldPairStart\{box-shadow:inset 1px 0/);
  assert.match(css, /\.goldPairEnd\{box-shadow:inset -1px 0/);
});
