import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildMissionPointsTimeline } from "./mission-points-timeline.ts";
import { hideAllMissionLines, missionLineKey, onlyMissionAverages, toggleMissionLine } from "./mission-points-timeline-visibility.ts";
import type { MissionCatalogItem, StatisticsGame } from "./types.ts";

const catalog: MissionCatalogItem[] = [
  { id: "m1", name: "Brest – Petrograd", sortOrder: 1 },
  { id: "m2", name: "Palermo – Moskwa", sortOrder: 2 },
  { id: "m3", name: "Lisboa – Danzig", sortOrder: 3 },
];
const game = (id: string, day: number, rows: Array<{ id: string; missionId: string; kept: boolean; points: number }>): StatisticsGame => ({
  id, playedAt: new Date(`2026-01-${String(day).padStart(2, "0")}T12:00:00Z`), createdAt: new Date(`2026-01-${String(day).padStart(2, "0")}T13:00:00Z`),
  participants: rows.map((row, index) => ({ id: row.id, playerId: `p-${row.id}`, alias: row.id, imageUrl: null, points: row.points, placement: index + 1, ratingBefore: 1500, ratingChange: 0, ratingAfter: 1500, missionId: row.missionId, missionKept: row.kept })),
});
const games = [
  game("g2", 2, [{ id: "a", missionId: "m2", kept: true, points: 120 }, { id: "b", missionId: "m1", kept: false, points: 70 }]),
  game("g1", 1, [{ id: "a", missionId: "m1", kept: true, points: 100 }, { id: "b", missionId: "m2", kept: false, points: 80 }]),
  game("g3", 3, [{ id: "a", missionId: "m1", kept: true, points: 110 }, { id: "b", missionId: "m2", kept: true, points: 90 }, { id: "c", missionId: "unknown", kept: true, points: 999 }]),
];

test("Missions-Zeitreihe nutzt je Mission ausschließlich behaltene Teilnahmen und Ohne Mission ausschließlich nicht behaltene", () => {
  const timeline = buildMissionPointsTimeline(games, catalog);
  assert.deepEqual(timeline.series.map((series) => series.id), ["m1", "m2", "m3", "without-mission"]);
  assert.equal(timeline.entries.length, 6);
  assert.deepEqual(timeline.entries.map((entry) => entry.gameId), ["g1", "g1", "g2", "g2", "g3", "g3"]);
  assert.deepEqual(timeline.entries.filter((entry) => entry.missionValues.m1.points !== null).map((entry) => entry.missionValues.m1.points), [100, 110]);
  assert.deepEqual(timeline.entries.filter((entry) => entry.missionValues.m2.points !== null).map((entry) => entry.missionValues.m2.points), [120, 90]);
  assert.deepEqual(timeline.entries.filter((entry) => entry.missionValues["without-mission"].points !== null).map((entry) => entry.missionValues["without-mission"].points), [80, 70]);
});

test("jede Mission kumuliert unabhängig, startet mit dem eigenen Wert und verwendet sonst null", () => {
  const timeline = buildMissionPointsTimeline(games, catalog);
  const m1 = timeline.entries.filter((entry) => entry.missionValues.m1.points !== null);
  const m2 = timeline.entries.filter((entry) => entry.missionValues.m2.points !== null);
  const without = timeline.entries.filter((entry) => entry.missionValues["without-mission"].points !== null);
  assert.deepEqual(m1.map((entry) => entry.missionValues.m1.cumulativeAverage), [100, 105]);
  assert.deepEqual(m2.map((entry) => entry.missionValues.m2.cumulativeAverage), [120, 105]);
  assert.deepEqual(without.map((entry) => entry.missionValues["without-mission"].cumulativeAverage), [80, 75]);
  assert.ok(timeline.entries.every((entry) => entry.missionValues.m3.points === null && entry.missionValues.m3.cumulativeAverage === null));
  assert.ok(timeline.entries.slice(0, 2).every((entry) => entry.missionValues.m2.points === null));
  assert.ok(timeline.entries.flatMap((entry) => Object.values(entry.missionValues)).every((value) => value.cumulativeAverage === null || Number.isFinite(value.cumulativeAverage)));
});

test("Sichtbarkeit startet nur mit Durchschnitten und unterstützt Checkboxen sowie Schnellaktionen", () => {
  const series = buildMissionPointsTimeline([], catalog).series;
  const defaults = onlyMissionAverages(series);
  assert.ok(series.every((mission) => defaults.has(missionLineKey(mission.id, "average"))));
  assert.ok(series.every((mission) => !defaults.has(missionLineKey(mission.id, "result"))));
  const enabledResult = toggleMissionLine(defaults, "m1", "result");
  assert.ok(enabledResult.has("m1:result"));
  assert.ok(!toggleMissionLine(enabledResult, "m1", "result").has("m1:result"));
  assert.equal(hideAllMissionLines().size, 0);
  assert.deepEqual(onlyMissionAverages(series), defaults);
});

test("Chart verwendet vorbereitete Daten, komprimierte Zeitachse, Tooltip und Partie-Link", () => {
  const chart = readFileSync(new URL("../../app/statistik/MissionPointsTimelineChart.tsx", import.meta.url), "utf8");
  assert.match(chart, /useState<Set<string>>\(\(\) => onlyMissionAverages\(series\)\)/);
  assert.match(chart, /Alle ausblenden/); assert.match(chart, /Nur Durchschnitte/);
  assert.match(chart, /type="checkbox"/); assert.match(chart, /checked=\{visible\.has/);
  assert.match(chart, /addCompressedTimelinePositions\(entries\)/); assert.match(chart, /dataKey="visualPosition"/);
  assert.match(chart, /Partiepunkte:/); assert.match(chart, /Laufender Durchschnitt:/); assert.match(chart, /href=\{`\/partien\/\$\{point\.gameId\}`\}/);
  assert.match(chart, /connectNulls/);
  assert.doesNotMatch(chart, /reduce\(/);
});
