import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildMissionPlacementTimeline } from "./mission-placement-timeline.ts";
import { hideAllMissionLines, missionLineKey, onlyMissionAverages, toggleMissionLine } from "./mission-placement-timeline-visibility.ts";
import type { MissionCatalogItem, StatisticsGame } from "./types.ts";

const catalog: MissionCatalogItem[] = [
  { id: "m1", name: "Brest – Petrograd", sortOrder: 1 },
  { id: "m2", name: "Palermo – Moskwa", sortOrder: 2 },
  { id: "m3", name: "Lisboa – Danzig", sortOrder: 3 },
];
const game = (id: string, playedAt: string, rows: Array<{ id: string; missionId: string; kept: boolean; placement: number; alias?: string }>): StatisticsGame => ({
  id, playedAt: new Date(playedAt), createdAt: new Date(new Date(playedAt).getTime() + 60_000),
  participants: rows.map((row) => ({ id: row.id, playerId: `p-${row.id}`, alias: row.alias ?? row.id, imageUrl: null, points: 100, placement: row.placement, ratingBefore: 1500, ratingChange: 0, ratingAfter: 1500, missionId: row.missionId, missionKept: row.kept })),
});
const games = [
  game("g3", "2026-01-22T12:00:00Z", [{ id: "a", missionId: "m1", kept: true, placement: 1 }]),
  game("g1", "2026-01-01T10:00:00Z", [{ id: "a", missionId: "m1", kept: true, placement: 4 }, { id: "b", missionId: "m2", kept: false, placement: 3 }]),
  game("g2", "2026-01-01T18:00:00Z", [{ id: "a", missionId: "m2", kept: true, placement: 2 }, { id: "b", missionId: "m1", kept: false, placement: 3, alias: "Anna" }, { id: "c", missionId: "m2", kept: false, placement: 5, alias: "Berta" }]),
];

test("Platzierungszeitreihe verwendet gespeicherte Platzierungen und die Missionsstatistik-Datenbasis", () => {
  const timeline = buildMissionPlacementTimeline(games, catalog);
  assert.deepEqual(timeline.entries.map((entry) => entry.gameId), ["g1", "g2", "g3"]);
  assert.deepEqual(timeline.entries[0].missionValues.m1.placements.map((result) => result.placement), [4]);
  assert.deepEqual(timeline.entries[1].missionValues.m2.placements.map((result) => result.placement), [2]);
  assert.deepEqual(timeline.entries[1].missionValues["without-mission"].placements.map((result) => result.placement), [3, 5]);
  assert.deepEqual(timeline.entries[1].missionValues["without-mission"].placements.map((result) => result.playerAlias), ["Anna", "Berta"]);
});

test("jede Mission berechnet den kumulativen Ø Platz unabhängig und ohne Vorabrundung", () => {
  const timeline = buildMissionPlacementTimeline(games, catalog);
  assert.equal(timeline.entries[0].missionValues.m1.cumulativeAveragePlacement, 4);
  assert.equal(timeline.entries[2].missionValues.m1.cumulativeAveragePlacement, 2.5);
  assert.equal(timeline.entries[1].missionValues.m2.cumulativeAveragePlacement, 2);
  assert.equal(timeline.entries[0].missionValues["without-mission"].cumulativeAveragePlacement, 3);
  assert.equal(timeline.entries[1].missionValues["without-mission"].cumulativeAveragePlacement, 11 / 3);
  assert.ok(timeline.entries.flatMap((entry) => Object.values(entry.missionValues)).every((value) => value.cumulativeAveragePlacement === null || Number.isFinite(value.cumulativeAveragePlacement)));
});

test("fehlende Missionen bleiben null und beginnen erst mit der ersten relevanten Partie", () => {
  const timeline = buildMissionPlacementTimeline(games, catalog);
  assert.deepEqual(timeline.entries[0].missionValues.m2, { placements: [], cumulativeAveragePlacement: null });
  assert.ok(timeline.entries.every((entry) => entry.missionValues.m3.placements.length === 0 && entry.missionValues.m3.cumulativeAveragePlacement === null));
  assert.doesNotMatch(JSON.stringify(timeline), /NaN/);
});

test("jede Partie erhält genau eine globale komprimierte X-Position für alle Missionen", () => {
  const timeline = buildMissionPlacementTimeline(games, catalog);
  assert.equal(new Set(timeline.entries.map((entry) => entry.gameId)).size, timeline.entries.length);
  assert.equal(timeline.entries[0].visualPosition, 0);
  assert.ok(timeline.entries[0].visualPosition < timeline.entries[1].visualPosition);
  assert.ok(timeline.entries[1].visualPosition < timeline.entries[2].visualPosition);
  assert.ok(timeline.entries[2].visualPosition - timeline.entries[1].visualPosition < 8.01);
  assert.equal(timeline.entries[1].missionValues.m2.placements.length, 1);
  assert.equal(timeline.entries[1].missionValues["without-mission"].placements.length, 2);
});

test("Y-Achsenmaximum erweitert sich bei gespeicherten Platzierungen außerhalb 1 bis 5", () => {
  const timeline = buildMissionPlacementTimeline([game("g", "2026-02-01T12:00:00Z", [{ id: "a", missionId: "m1", kept: true, placement: 6 }])], catalog);
  assert.equal(timeline.maximumPlacement, 6);
});

test("Checkboxzustand startet nur mit Ø-Platz-Linien und Schnellaktionen bleiben korrekt", () => {
  const series = buildMissionPlacementTimeline([], catalog).series;
  const defaults = onlyMissionAverages(series);
  assert.ok(series.every((mission) => defaults.has(missionLineKey(mission.id, "average"))));
  assert.ok(series.every((mission) => !defaults.has(missionLineKey(mission.id, "result"))));
  assert.ok(toggleMissionLine(defaults, "m1", "result").has("m1:result"));
  assert.equal(hideAllMissionLines().size, 0);
});

test("Chart ist vollständig auf Platzierungen, globale X-Werte und gemeinsamen Partie-Tooltip umgestellt", () => {
  const chart = readFileSync(new URL("../../app/statistik/MissionPlacementTimelineChart.tsx", import.meta.url), "utf8");
  const gameChart = readFileSync(new URL("../../app/statistik/GamePointsTimelineChart.tsx", import.meta.url), "utf8");
  assert.match(chart, /Platzierungsentwicklung nach Mission/);
  assert.match(chart, /Platzierung/); assert.match(chart, /Laufender Ø Platz/);
  assert.doesNotMatch(chart, /Partiepunkte|Punkteentwicklung|value: "Punkte"|addCompressedTimelinePositions/);
  assert.match(chart, /dataKey="visualPosition"/); assert.match(chart, /reversed/); assert.match(chart, /domain=\{\[1, maximumPlacement\]\}/);
  assert.match(chart, /placementsByMission/); assert.match(chart, /<Scatter/);
  assert.match(chart, /shownMissions/); assert.match(chart, /gamesById\.get/); assert.match(chart, /Partie öffnen/);
  assert.match(chart, /minimumFractionDigits: 2, maximumFractionDigits: 2/);
  assert.match(gameChart, /winnerPoints/); assert.match(gameChart, /gameAveragePoints/); assert.match(gameChart, /cumulativePlayerAverage/);
});
