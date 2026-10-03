import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculatePlayerStatistics } from "./player-statistics.ts";
import type { StatisticsGame, StatisticsPlayer } from "./types.ts";

const players: StatisticsPlayer[] = [
  { id: "a", alias: "Anna", imageUrl: null, currentRating: 1300 }, { id: "b", alias: "Berta", imageUrl: null, currentRating: 1300 },
  { id: "c", alias: "Clara", imageUrl: null, currentRating: 1100 }, { id: "d", alias: "Dora", imageUrl: null, currentRating: 1000 },
];
const game = (n: number, rows: Array<{ id: string; place: number; points: number; change: number; before?: number }>): StatisticsGame => ({ id: `g${n}`, playedAt: new Date(`2026-01-${String(n).padStart(2, "0")}T12:00:00Z`), createdAt: new Date(`2026-01-${String(n).padStart(2, "0")}T13:00:00Z`), participants: rows.map((r, i) => ({ id: `g${n}-${i}`, playerId: r.id, alias: r.id.toUpperCase(), imageUrl: null, points: r.points, placement: r.place, ratingBefore: r.before ?? 1000, ratingChange: r.change, ratingAfter: (r.before ?? 1000) + r.change, missionId: "m1", missionKept: true })) });
const playerGames = (id: string, points: number[], placements = points.map(() => 2), offset = 0) => points.map((score, index) => game(offset + index + 1, [{ id, place: placements[index], points: score, change: 0 }]));

test("aktuelle Elo nutzt dichte geteilte Top-3-Ränge", () => {
  const top = calculatePlayerStatistics(players, []).currentTop;
  assert.deepEqual(top.map((p) => [p.id, p.rank]), [["a", 1], ["b", 1], ["c", 2], ["d", 3]]);
});

test("Partienrangliste sortiert absteigend und verwendet dichte Ränge mit stabilem Alias-Tiebreak", () => {
  const result = calculatePlayerStatistics(players, [
    game(1, [{ id: "b", place: 1, points: 100, change: 0 }, { id: "a", place: 2, points: 90, change: 0 }]),
    game(2, [{ id: "b", place: 1, points: 100, change: 0 }, { id: "a", place: 2, points: 90, change: 0 }]),
    game(3, [{ id: "c", place: 1, points: 100, change: 0 }]),
  ]);
  assert.deepEqual(result.mostGames.map((row) => [row.id, row.games, row.rank]), [
    ["a", 2, 1], ["b", 2, 1], ["c", 1, 2], ["d", 0, 3],
  ]);
});

test("jede bestätigte Partie zählt je Spieler höchstens einmal", () => {
  const duplicate = game(1, [{ id: "a", place: 1, points: 100, change: 0 }, { id: "a", place: 2, points: 90, change: 0 }]);
  const result = calculatePlayerStatistics(players, [duplicate]);
  assert.equal(result.mostGames.find((row) => row.id === "a")?.games, 1);
});

test("höchste Elo behält die erste stabile Erreichung", () => {
  const result = calculatePlayerStatistics(players, [game(1, [{ id: "a", place: 1, points: 100, change: 50 }]), game(2, [{ id: "a", place: 1, points: 100, change: 50 }, { id: "b", place: 2, points: 100, change: 50 }])]);
  assert.equal(result.highestAllTime.find((r) => r.id === "a")?.gameId, "g1");
});

test("höchste Elo aller Zeiten liefert dichte Top-3-Ränge je Spieler", () => {
  const result = calculatePlayerStatistics(players, [game(1, [
    { id: "a", place: 1, points: 100, change: 40, before: 1500 },
    { id: "b", place: 2, points: 90, change: 30, before: 1500 },
    { id: "c", place: 3, points: 80, change: 20, before: 1500 },
    { id: "d", place: 4, points: 70, change: 10, before: 1500 },
  ])]);
  assert.deepEqual(result.highestAllTime.map((row) => [row.id, row.value, row.rank]), [
    ["a", 1540, 1], ["b", 1530, 2], ["c", 1520, 3],
  ]);
});

test("Winrate und Durchschnittspunkte verlangen fünf Partien und wenden Tiebreaker an", () => {
  const games = Array.from({ length: 6 }, (_, i) => game(i + 1, [{ id: "a", place: i < 5 ? 1 : 2, points: 100, change: 1 }, ...(i < 5 ? [{ id: "b", place: i < 4 ? 1 : 2, points: 100, change: 1 }] : [])]));
  const result = calculatePlayerStatistics(players, games);
  assert.equal(result.highestWinRate[0].id, "a"); // gleiche Rate 4/5 vs 5/6? a gewinnt fachlich ohnehin
  assert.equal(result.highestAveragePoints[0].id, "a"); // gleiches Mittel, mehr Partien
  assert.ok(!result.highestWinRate.some((row) => row.id === "c"));
});

test("höchste Median-Punkte berechnet gerade und ungerade Mediane und verlangt fünf Partien", () => {
  const result = calculatePlayerStatistics(players, [
    ...playerGames("a", [10, 20, 30, 40, 50]),
    ...playerGames("b", [10, 20, 30, 40, 50, 60], undefined, 6),
    ...playerGames("c", [100, 100, 100, 100], undefined, 13),
  ]);
  assert.equal(result.highestMedianPoints[0].id, "b");
  assert.equal(result.highestMedianPoints[0].medianPoints, 35);
  assert.ok(!result.highestMedianPoints.some((row) => row.id === "c"));
});

test("Median-Tiebreak verwendet Ø-Punkte, Partien und Alias", () => {
  const result = calculatePlayerStatistics(players, [
    ...playerGames("a", [80, 100, 100, 100, 140]),
    ...playerGames("b", [90, 100, 100, 100, 110, 100], undefined, 6),
  ]);
  assert.equal(result.highestMedianPoints[0].id, "a");
});

test("beste Ø-Platzierung verwendet den kleinsten Wert und Winrate-Tiebreak", () => {
  const result = calculatePlayerStatistics(players, [
    ...playerGames("a", [100, 100, 100, 100, 100], [1, 2, 2, 2, 3]),
    ...playerGames("b", [100, 100, 100, 100, 100], [1, 1, 2, 3, 3], 6),
    ...playerGames("c", [100, 100, 100, 100], [1, 1, 1, 1], 12),
  ]);
  assert.equal(result.bestAveragePlacement[0].id, "b");
  assert.equal(result.bestAveragePlacement[0].averagePlacement, 2);
  assert.ok(!result.bestAveragePlacement.some((row) => row.id === "c"));
});

test("Winning Streak betrachtet nur eigene Partien, erkennt Ende, Laufstatus und Punkte-Tiebreak", () => {
  const games = [game(1, [{ id: "a", place: 1, points: 90, change: 1 }]), game(2, [{ id: "b", place: 2, points: 70, change: -1 }]), game(3, [{ id: "a", place: 1, points: 100, change: 1 }]), game(4, [{ id: "a", place: 2, points: 80, change: -1 }]), game(5, [{ id: "b", place: 1, points: 120, change: 1 }]), game(6, [{ id: "b", place: 1, points: 120, change: 1 }])];
  const result = calculatePlayerStatistics(players, games);
  assert.equal(result.longestWinningStreak[0].id, "b"); assert.equal(result.longestWinningStreak[0].running, true); assert.equal(result.longestWinningStreak[0].firstGameId, "g5");
});

test("Nichtverlust-Serie zählt Null, endet negativ und bewertet Gewinn sowie kürzere Serie", () => {
  const games = [game(1, [{ id: "a", place: 2, points: 80, change: 0 }]), game(2, [{ id: "a", place: 1, points: 90, change: 10 }]), game(3, [{ id: "a", place: 4, points: 50, change: -1 }]), game(4, [{ id: "b", place: 1, points: 100, change: 10 }])];
  const result = calculatePlayerStatistics(players, games);
  assert.equal(result.longestNonLossStreak[0].games, 2); assert.equal(result.greatestNonLossGain[0].id, "b"); assert.equal(result.greatestNonLossGain[0].games, 1);
});

test("gleitende Fünfer- und Zehnerfenster nutzen eigene Partien und verlinken den Anfang", () => {
  const games = Array.from({ length: 10 }, (_, i) => game(i + 1, [{ id: "a", place: 1, points: 100, change: i + 1, before: 1000 + i * 10 }]));
  const result = calculatePlayerStatistics(players, games);
  assert.equal(result.bestFiveGameGain[0].firstGameId, "g6"); assert.equal(result.bestFiveGameGain[0].games, 5);
  assert.equal(result.bestTenGameGain[0].firstGameId, "g1"); assert.equal(result.bestTenGameGain[0].games, 10);
});

test("Leistungsrekorde liefern Rang 1 bis 3 bei unveränderten Mindestmengen und Sortierrichtungen", () => {
  const performanceGames = [
    ...playerGames("a", [120, 120, 120, 120, 120], [4, 4, 4, 4, 4]),
    ...playerGames("b", [110, 110, 110, 110, 110], [3, 3, 3, 3, 3], 6),
    ...playerGames("c", [100, 100, 100, 100, 100], [2, 2, 2, 2, 2], 12),
    ...playerGames("d", [90, 90, 90, 90, 90], [1, 1, 1, 1, 1], 18),
  ];
  const result = calculatePlayerStatistics(players, performanceGames);
  assert.deepEqual(result.highestAveragePoints.map((row) => [row.id, row.rank]), [["a", 1], ["b", 2], ["c", 3]]);
  assert.deepEqual(result.highestMedianPoints.map((row) => [row.id, row.rank]), [["a", 1], ["b", 2], ["c", 3]]);
  assert.deepEqual(result.bestAveragePlacement.map((row) => [row.id, row.rank]), [["d", 1], ["c", 2], ["b", 3]]);
  assert.equal(result.highestWinRate[0].id, "d");
  assert.ok(result.highestWinRate.every((row) => row.games >= 5 && row.rank <= 3));
});

test("Serien- und Rolling-Rekorde liefern die drei besten Spieler nach bestehenden Vergleichen", () => {
  const records: StatisticsGame[] = [];
  const configs = [{ id: "a", gain: 4 }, { id: "b", gain: 3 }, { id: "c", gain: 2 }, { id: "d", gain: 1 }];
  configs.forEach(({ id, gain }, playerIndex) => {
    let rating = 1000;
    for (let index = 0; index < 10; index += 1) {
      records.push(game(playerIndex * 20 + index + 1, [{ id, place: index < 5 - playerIndex ? 1 : 2, points: 100, change: gain, before: rating }]));
      rating += gain;
    }
  });
  const result = calculatePlayerStatistics(players, records);
  assert.deepEqual(result.longestWinningStreak.map((row) => [row.id, row.rank]), [["a", 1], ["b", 2], ["c", 3]]);
  assert.deepEqual(result.longestNonLossStreak.slice(0, 3).map((row) => [row.id, row.rank]), [["a", 1], ["b", 2], ["c", 3]]);
  assert.deepEqual(result.greatestNonLossGain.map((row) => [row.id, row.rank]), [["a", 1], ["b", 2], ["c", 3]]);
  assert.deepEqual(result.bestFiveGameGain.map((row) => [row.id, row.rank]), [["a", 1], ["b", 2], ["c", 3]]);
  assert.deepEqual(result.bestTenGameGain.map((row) => [row.id, row.rank]), [["a", 1], ["b", 2], ["c", 3]]);
});

test("Spielerstatistik entfernt Höchstpunktzahl und Zwischenüberschrift und verwendet ein gemeinsames Rekordkarten-Grid", () => {
  const page = readFileSync("app/statistik/page.tsx", "utf8");
  const playerArea = page.slice(page.indexOf("function PlayersArea"), page.indexOf("function GamesArea"));
  assert.doesNotMatch(playerArea, /Höchste Punktzahl|highestScore|Serienrekorde|groupTitle/);
  assert.equal(playerArea.match(/styles\.cardGrid/g)?.length, 1);
  assert.deepEqual([...playerArea.matchAll(/<h2>([^<]+)<\/h2>/g)].map((match) => match[1]), ["Höchste aktuelle Elo", "Meiste gespielte Partien"]);
  const cardHeadings = ["Höchste Elo aller Zeiten", "Höchste Winrate", "Höchste Ø-Punkte", "Höchste Median-Punkte", "Beste Ø-Platzierung", "Längste Winning Streak", "Längste Serie ohne Elo-Verlust", "Größtes Plus ohne Verlust", "Bestes Plus über 5 Partien", "Bestes Plus über 10 Partien"];
  assert.deepEqual([...playerArea.matchAll(/<RecordCard [^>]*title="([^"]+)"/g)].map((match) => match[1]), cardHeadings);
  assert.match(playerArea, /highestMedianPoints/);
  assert.match(playerArea, /bestAveragePlacement/);
  assert.match(playerArea, /<RecordTopList rows=\{statistics\.mostGames\} value=\{\(row\) => `\$\{row\.games\} Partien`\}/);
  assert.match(page, /function RecordTopList/);
  assert.match(page, /function RecordCard/);
  assert.match(playerArea, /<div className=\{styles\.topGrid\}><section className=\{styles\.topCard\}/);
  assert.match(page, /where: \{ status: GameStatus\.CONFIRMED, deletedAt: null \}/);
  const css = readFileSync("app/statistik/page.module.css", "utf8");
  assert.match(css, /\.topGrid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:760px\).*\.topGrid,\.cardGrid\{grid-template-columns:1fr\}/s);
});
