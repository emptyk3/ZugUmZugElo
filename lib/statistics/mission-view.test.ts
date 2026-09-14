import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildMissionStatisticsView, filterMissionGames, resolveMissionPlayerCountFilter } from "./mission-view.ts";
import type { MissionCatalogItem, StatisticsGame, StatisticsParticipation } from "./types.ts";

const catalog: MissionCatalogItem[] = [
  { id: "m1", name: "Mission 1", sortOrder: 1 },
  { id: "m2", name: "Mission 2", sortOrder: 2 },
];
const participant = (id: string, missionId: string, missionKept: boolean, points: number, placement: number, ratingChange: number): StatisticsParticipation => ({
  id, playerId: `player-${id}`, alias: `Spieler ${id}`, imageUrl: null, points, placement,
  ratingBefore: 1500, ratingChange, ratingAfter: 1500 + ratingChange, missionId, missionKept,
});
const game = (id: string, day: number, participants: StatisticsParticipation[]): StatisticsGame => ({
  id, playedAt: new Date(`2026-01-${String(day).padStart(2, "0")}T12:00:00Z`),
  createdAt: new Date(`2026-01-${String(day).padStart(2, "0")}T13:00:00Z`), participants,
});
const fourPlayerGame = game("four", 1, [
  participant("4a", "m1", true, 100, 1, 5), participant("4b", "m1", false, 80, 4, -2),
  participant("4c", "m2", true, 90, 2, 1), participant("4d", "m2", true, 70, 3, 0),
]);
const fivePlayerGame = game("five", 2, [
  participant("5a", "m1", true, 120, 2, 3), participant("5b", "m2", true, 110, 1, 4),
  participant("5c", "m2", false, 60, 5, -4), participant("5d", "m1", true, 100, 3, 2),
  participant("5e", "m2", true, 90, 4, -1),
]);
const games = [fourPlayerGame, fivePlayerGame];

test("Gesamt ist Standard und enthält Vierer- und Fünferpartien", () => {
  assert.equal(resolveMissionPlayerCountFilter(undefined), "gesamt");
  assert.equal(resolveMissionPlayerCountFilter("unbekannt"), "gesamt");
  const view = buildMissionStatisticsView(games, catalog, "gesamt");
  assert.deepEqual(view.games.map((entry) => entry.id), ["four", "five"]);
  assert.deepEqual(view.timeline.entries.map((entry) => entry.gameId), ["four", "five"]);
  assert.equal(view.statistics.totalDrawn, 9);
});

test("Viererfilter berechnet alle Missionswerte ausschließlich aus Viererpartien", () => {
  const view = buildMissionStatisticsView(games, catalog, "4");
  const m1 = view.statistics.rows.find((row) => row.id === "m1")!;
  const without = view.statistics.rows.find((row) => row.id === "without-mission")!;
  assert.deepEqual(view.games.map((entry) => entry.id), ["four"]);
  assert.deepEqual({ drawn: m1.drawn, kept: m1.kept, wins: m1.wins, winRate: m1.winRate }, { drawn: 2, kept: 1, wins: 1, winRate: 1 });
  assert.deepEqual({ averagePlacement: m1.averagePlacement, placementSigma: m1.placementStandardDeviation }, { averagePlacement: 1, placementSigma: 0 });
  assert.deepEqual({ medianPoints: m1.medianPoints, averagePoints: m1.averagePoints, pointsSigma: m1.pointsStandardDeviation, averageRatingChange: m1.averageRatingChange }, { medianPoints: 100, averagePoints: 100, pointsSigma: 0, averageRatingChange: 5 });
  assert.equal(m1.drawnRate, 1 / 2); assert.equal(m1.keptRate, 1 / 2);
  assert.equal(without.kept, 1); assert.equal(without.keptRate, 1 / 4); assert.equal(without.averagePoints, 80);
  assert.deepEqual(view.timeline.entries.map((entry) => entry.gameId), ["four"]);
});

test("Fünferfilter berechnet alle Missionswerte ausschließlich aus Fünferpartien", () => {
  const view = buildMissionStatisticsView(games, catalog, "5");
  const m1 = view.statistics.rows.find((row) => row.id === "m1")!;
  const without = view.statistics.rows.find((row) => row.id === "without-mission")!;
  assert.deepEqual(view.games.map((entry) => entry.id), ["five"]);
  assert.deepEqual({ drawn: m1.drawn, kept: m1.kept, wins: m1.wins, winRate: m1.winRate }, { drawn: 2, kept: 2, wins: 0, winRate: 0 });
  assert.deepEqual({ averagePlacement: m1.averagePlacement, placementSigma: m1.placementStandardDeviation }, { averagePlacement: 2.5, placementSigma: .5 });
  assert.deepEqual({ medianPoints: m1.medianPoints, averagePoints: m1.averagePoints, pointsSigma: m1.pointsStandardDeviation, averageRatingChange: m1.averageRatingChange }, { medianPoints: 110, averagePoints: 110, pointsSigma: 10, averageRatingChange: 2.5 });
  assert.equal(m1.drawnRate, 2 / 5); assert.equal(m1.keptRate, 1);
  assert.equal(without.kept, 1); assert.equal(without.keptRate, 1 / 5); assert.equal(without.averageRatingChange, -4);
  assert.deepEqual(view.timeline.entries.map((entry) => entry.gameId), ["five"]);
});

test("Sortierung und Top-3-Rankings werden für jeden Filter unabhängig neu berechnet", () => {
  const total = buildMissionStatisticsView(games, catalog, "gesamt").statistics;
  const four = buildMissionStatisticsView(games, catalog, "4").statistics;
  const five = buildMissionStatisticsView(games, catalog, "5").statistics;
  assert.equal(total.rows[0].id, "m1"); assert.equal(four.rows[0].id, "m1"); assert.equal(five.rows[0].id, "m2");
  assert.equal(four.rankings.averagePlacement.m1, 1);
  assert.equal(five.rankings.averagePlacement.m2, 1);
  assert.notDeepEqual(four.rankings.averagePoints, five.rankings.averagePoints);
});

test("leere Filtermenge erzeugt gültige leere Statistik und Zeitachse", () => {
  assert.deepEqual(filterMissionGames([fourPlayerGame], "5"), []);
  const view = buildMissionStatisticsView([fourPlayerGame], catalog, "5");
  assert.equal(view.games.length, 0); assert.equal(view.timeline.entries.length, 0); assert.equal(view.statistics.totalDrawn, 0);
  assert.doesNotMatch(JSON.stringify(view), /NaN|Infinity/);
});

test("Mission-Unterreiter sind URL-basiert und verändern keine anderen Statistikbereiche", () => {
  const page = readFileSync("app/statistik/page.tsx", "utf8");
  const css = readFileSync("app/statistik/page.module.css", "utf8");
  assert.match(page, /resolveMissionPlayerCountFilter\(parameters\.spieleranzahl\)/);
  assert.match(page, /\[\["gesamt", "Gesamt"\], \["4", "4 Spieler"\], \["5", "5 Spieler"\]\]/);
  assert.match(page, /\/statistik\?bereich=missionen&spieleranzahl=\$\{key\}/);
  assert.match(page, /aria-current=\{filter === key \? "page" : undefined\}/);
  assert.match(page, /missionView = area === "missionen" \? buildMissionStatisticsView\(games, missions, missionFilter\) : null/);
  assert.match(page, /calculatePlayerStatistics\(publicPlayers, games\)/);
  assert.match(page, /calculateGameStatistics\(games\)/);
  assert.match(page, /view\.games\.length === 0 \? .*Noch keine Daten vorhanden\./);
  assert.match(css, /\.missionSubtabs\{display:flex;flex-wrap:wrap/);
});
