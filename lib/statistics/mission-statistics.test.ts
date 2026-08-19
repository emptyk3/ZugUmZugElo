import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculateMissionStatistics, compareMissionRows, createMissionRankings, type MissionStatisticRow } from "./mission-statistics.ts";
import type { StatisticsGame } from "./types.ts";

const catalog = [{ id: "m1", name: "Mission 1", sortOrder: 1 }, { id: "m2", name: "Mission 2", sortOrder: 2 }];
const game = (id: string, rows: Array<[string, boolean, number, number, number?]>): StatisticsGame => ({ id, playedAt: new Date(`2026-01-0${id}T12:00:00Z`), createdAt: new Date(`2026-01-0${id}T13:00:00Z`), participants: rows.map(([missionId, missionKept, points, placement, ratingChange], i) => ({ id: `${id}-${i}`, playerId: `p${i}`, alias: `P${i}`, imageUrl: null, points, placement, ratingBefore: 1000, ratingChange: ratingChange ?? 0, ratingAfter: 1000 + (ratingChange ?? 0), missionId, missionKept })) });

test("Ausgeteilt zählt alle Zuordnungen, Leistung nur behaltene und nicht behaltene nur Ohne Mission", () => {
  const result = calculateMissionStatistics([game("1", [["m1", true, 100, 1], ["m1", false, 90, 2], ["m2", true, 80, 3]])], catalog);
  const m1 = result.rows.find((row) => row.id === "m1")!, without = result.rows.find((row) => row.id === "without-mission")!;
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
  averageWinnerPoints: value, averageRatingChange: value, maxPoints: value === null ? null : { value, gameId: `game-${id}` },
});

test("alle neun Leistungswerte verwenden Top 3, Verteilungswerte nie", () => {
  const rankings = createMissionRankings([rankedRow("first", 40), rankedRow("second", 30), rankedRow("third", 20), rankedRow("fourth", 10)]);
  assert.deepEqual(rankings.drawn, {}); assert.deepEqual(rankings.drawnRate, {});
  for (const metric of ["kept", "keptRate", "wins", "winRate", "averagePoints", "averageWinnerPoints", "averageRatingChange", "maxPoints"] as const) {
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
  for (const metric of ["kept", "keptRate", "wins", "winRate", "averagePoints", "averageWinnerPoints", "averageRatingChange", "maxPoints"] as const) assert.equal(rankings[metric]["without-mission"], 1);
  assert.equal(rankings.averagePlacement["without-mission"], 2);
});

test("Ø Elo ± mittelt exakte positive und negative Änderungen aus den relevanten Teilnahmen", () => {
  const result = calculateMissionStatistics([
    game("1", [["m1", true, 100, 1, 8.25], ["m2", true, 90, 2, -3.1], ["m1", false, 80, 3, -4.2]]),
    game("2", [["m1", true, 95, 2, 4.55], ["m2", true, 105, 1, -1.1], ["m2", false, 70, 4, 2.2]]),
  ], catalog);
  assert.equal(result.rows.find((row) => row.id === "m1")?.averageRatingChange, 6.4);
  assert.equal(result.rows.find((row) => row.id === "m2")?.averageRatingChange, -2.1);
  assert.equal(result.rows.find((row) => row.id === "without-mission")?.averageRatingChange, -1);
});

test("Ø Elo ± nimmt mit ungerundeten Rohwerten an der Top-3-Hervorhebung teil", () => {
  const rows = [rankedRow("first", 6.44), rankedRow("second", 6.43), rankedRow("third", 0), rankedRow("fourth", -2.1)];
  assert.deepEqual(createMissionRankings(rows).averageRatingChange, { first: 1, second: 2, third: 3 });
});

test("Standardsortierung verwendet Ø Platz, Sieg-%, Ø Punkte, Name und stabile ID", () => {
  const row = (id: string, name: string, placement: number | null, winRate: number | null, points: number | null, without = false) => ({
    ...rankedRow(id, 1, without), name, averagePlacement: placement, winRate, averagePoints: points,
  });
  const rows = [
    row("low", "Zulu", 2, .9, 120),
    row("win", "Zulu", 1.5, .6, 80),
    row("points", "Zulu", 1.5, .5, 100),
    row("alpha-b", "Alpha", 1.5, .5, 90),
    row("alpha-a", "Alpha", 1.5, .5, 90),
    row("without-mission", "Ohne Mission", 1.2, .2, 60, true),
    row("none", "Keine Daten", null, null, null),
  ];
  assert.deepEqual(rows.sort(compareMissionRows).map((entry) => entry.id), ["without-mission", "win", "points", "alpha-a", "alpha-b", "low", "none"]);
});

test("Missions-UI enthält ±-Spalte, Vorzeichen, Sortierhinweis und Rangkennzeichnung", () => {
  const page = readFileSync("app/statistik/page.tsx", "utf8");
  assert.match(page, /<th>Ø Elo ±<\/th>/);
  assert.match(page, /value > 0 \? `\+\$\{number/);
  assert.match(page, /value < 0 \? `−\$\{number/);
  assert.match(page, /averageRatingChange/);
  assert.match(page, /Die Reihenfolge richtet sich nach der durchschnittlichen Platzierung/);
  assert.match(page, /index < 3 \? missionMedals/);
  assert.match(page, /: `\$\{index \+ 1\}\.\`/);
  assert.match(page, /1: "🏆", 2: "🥈", 3: "🥉"/);
});

test("Missions-Tabelle hält Namen und Header auf Desktop einzeilig und bleibt mobil scrollbar", () => {
  const page = readFileSync("app/statistik/page.tsx", "utf8");
  const css = readFileSync("app/statistik/page.module.css", "utf8");
  assert.match(page, /styles\.missionTableCard/);
  assert.match(page, /<colgroup><col className=\{styles\.missionNameColumn\} \/><col className=\{styles\.missionDrawnColumn\}/);
  assert.match(page, /<th>Gezogen<\/th><th>% Gezogen<\/th>/);
  assert.match(page, /<\/table><\/div><p className=\{styles\.missionExplanation\}>/);
  assert.match(css, /\.missionPage \.hero,\.missionPage \.tabs,\.missionTableCard\{width:min\(1320px,100%\)\}/);
  assert.match(css, /\.missionTableWrap th:first-child\{min-width:225px;white-space:nowrap\}/);
  assert.match(css, /\.missionTableWrap thead th\{white-space:nowrap\}/);
  assert.match(css, /\.missionNameColumn\{width:225px\}\.missionDrawnColumn\{width:54px\}/);
  assert.match(css, /\.missionExplanation span\{display:block\}/);
  assert.match(css, /@media\(min-width:1280px\)/);
  assert.match(css, /\.missionTableWrap\{overflow-x:visible\}/);
  assert.match(css, /\.tableWrap\{overflow-x:auto/);
});

test("Ranking vergleicht ungerundete Rohwerte und ignoriert null sowie NaN", () => {
  const rows = [rankedRow("precise-first", 100.04), rankedRow("precise-second", 100.03), rankedRow("none", null), rankedRow("invalid", Number.NaN)];
  const rankings = createMissionRankings(rows);
  assert.equal(rankings.averagePoints["precise-first"], 1); assert.equal(rankings.averagePoints["precise-second"], 2);
  assert.equal(rankings.averagePoints.none, undefined); assert.equal(rankings.averagePoints.invalid, undefined);
});
