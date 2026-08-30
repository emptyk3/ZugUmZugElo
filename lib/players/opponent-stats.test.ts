import assert from "node:assert/strict";
import test from "node:test";
import { calculateOpponentStats, type OpponentGame } from "./opponent-stats.ts";

const games = (id: string, count: number, ownPlacement: number, opponentPlacement: number, ownPoints = 100, opponentPoints = 90, alias = `Alias ${id}`): OpponentGame[] => Array.from({ length: count }, (_, index) => ({
  gameId: `g-${id}-${index}`, ownPlacement, opponentPlacement, ownPoints, opponentPoints, opponent: { id, alias, imageUrl: null },
}));
const mixedGames = (id: string, wins: boolean[], alias = `Alias ${id}`): OpponentGame[] => wins.map((win, index) => ({
  gameId: `mixed-${id}-${index}`, ownPlacement: win ? 1 : 2, opponentPlacement: win ? 2 : 1, ownPoints: win ? 100 : 90, opponentPoints: win ? 90 : 100,
  opponent: { id, alias, imageUrl: null },
}));

test("Highlights benötigen mindestens zwei Gegner mit jeweils fünf Partien", () => {
  assert.equal(calculateOpponentStats(games("a", 5, 1, 2)).favorite, null);
  const result = calculateOpponentStats([...games("a", 5, 1, 2), ...games("b", 5, 2, 1)]);
  assert.equal(result.favorite?.id, "a"); assert.equal(result.nemesis?.id, "b");
});

test("Mehrspielerpartie zählt je Gegner nur einmal", () => {
  const duplicate = games("stable-id", 1, 1, 2)[0];
  const result = calculateOpponentStats([duplicate, duplicate, ...games("other", 5, 2, 1)]);
  const stable = result.rows.find((row) => row.id === "stable-id")!;
  assert.equal(stable.games, 1);
});

test("Vergleichstabelle enthält Gegner ab einer Partie, Highlights weiterhin erst ab fünf", () => {
  const result = calculateOpponentStats([
    ...games("one", 1, 1, 2),
    ...games("two", 2, 2, 1),
    ...games("four", 4, 1, 3),
    ...games("five", 5, 3, 1),
  ]);
  assert.deepEqual(new Set(result.rows.map((row) => row.id)), new Set(["one", "two", "four", "five"]));
  assert.equal(result.rows.find((row) => row.id === "one")?.games, 1);
  assert.equal(result.rows.find((row) => row.id === "two")?.games, 2);
  assert.equal(result.rows.find((row) => row.id === "four")?.games, 4);
  assert.equal(result.rows.find((row) => row.id === "five")?.games, 5);
  assert.equal(result.favorite, null);
  assert.equal(result.nemesis, null);
  assert.equal(result.rows.some((row) => row.id === "zero"), false);
});

test("100 Prozent aus einer Partie erscheinen nur in der Tabelle und verdrängen kein Highlight", () => {
  const result = calculateOpponentStats([
    ...games("single-perfect", 1, 1, 5),
    ...games("qualified-good", 5, 1, 2),
    ...games("qualified-bad", 5, 3, 1),
  ]);
  assert.equal(result.rows.find((row) => row.id === "single-perfect")?.winRate, 1);
  assert.equal(result.favorite?.id, "qualified-good");
  assert.equal(result.nemesis?.id, "qualified-bad");
});

test("Platzierungs- und Punktedifferenz werden aus Sicht des Profilspielers berechnet", () => {
  const result = calculateOpponentStats([...games("a", 5, 2, 4, 110, 90), ...games("b", 5, 3, 1)]).rows.find((row) => row.id === "a")!;
  assert.equal(result.averagePlacementDifference, 2);
  assert.equal(result.averagePointDifference, 20);
  assert.deepEqual({ wins: result.wins, losses: result.losses }, { wins: 5, losses: 0 });
});

test("Vergleichstabelle sortiert Gegner mit mehr gemeinsamen Partien immer weiter oben", () => {
  const result = calculateOpponentStats([...mixedGames("many", [false, false, false]), ...mixedGames("few", [true, true])]);
  assert.deepEqual(result.rows.map((row) => row.id), ["many", "few"]);
});

test("bei gleicher Spielanzahl entscheidet in der Vergleichstabelle die höhere Winrate", () => {
  const result = calculateOpponentStats([...mixedGames("lower", [true, false, false]), ...mixedGames("higher", [true, true, false])]);
  assert.deepEqual(result.rows.map((row) => row.id), ["higher", "lower"]);
});

test("bei gleicher Spielanzahl und Winrate sortiert die Vergleichstabelle den Alias alphabetisch", () => {
  const result = calculateOpponentStats([...mixedGames("z", [true, false], "Zeta"), ...mixedGames("a", [false, true], "Alpha")]);
  assert.deepEqual(result.rows.map((row) => row.alias), ["Alpha", "Zeta"]);
});

test("Highlight-Tiebreak verwendet weiterhin Winrate, danach Platzierungsdifferenz und Alias", () => {
  const result = calculateOpponentStats([...games("a", 5, 1, 3, 100, 90, "Zeta"), ...games("b", 5, 1, 2, 100, 90, "Alpha")]);
  assert.equal(result.favorite?.id, "a");
  assert.equal(result.nemesis?.id, "b");
  assert.deepEqual(result.rows.map((row) => row.id), ["b", "a"]);
});
