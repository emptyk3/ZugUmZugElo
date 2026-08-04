import assert from "node:assert/strict";
import test from "node:test";
import { calculateOpponentStats, type OpponentGame } from "./opponent-stats.ts";

const games = (id: string, count: number, ownPlacement: number, opponentPlacement: number, ownPoints = 100, opponentPoints = 90, alias = `Alias ${id}`): OpponentGame[] => Array.from({ length: count }, (_, index) => ({
  gameId: `g-${id}-${index}`, ownPlacement, opponentPlacement, ownPoints, opponentPoints, opponent: { id, alias, imageUrl: null },
}));

test("Highlights benötigen mindestens zwei Gegner mit jeweils fünf Partien", () => {
  assert.equal(calculateOpponentStats(games("a", 5, 1, 2)).favorite, null);
  const result = calculateOpponentStats([...games("a", 5, 1, 2), ...games("b", 5, 2, 1)]);
  assert.equal(result.favorite?.id, "a"); assert.equal(result.nemesis?.id, "b");
});

test("Mehrspielerpartie zählt je Gegner nur einmal", () => {
  const duplicate = games("stable-id", 1, 1, 2)[0];
  const result = calculateOpponentStats([duplicate, duplicate, ...games("other", 5, 2, 1)]);
  assert.equal(result.rows.some((row) => row.id === "stable-id"), false);
});

test("Platzierungs- und Punktedifferenz werden aus Sicht des Profilspielers berechnet", () => {
  const result = calculateOpponentStats([...games("a", 5, 2, 4, 110, 90), ...games("b", 5, 3, 1)]).rows.find((row) => row.id === "a")!;
  assert.equal(result.averagePlacementDifference, 2);
  assert.equal(result.averagePointDifference, 20);
  assert.deepEqual({ wins: result.wins, losses: result.losses }, { wins: 5, losses: 0 });
});

test("Tiebreak verwendet Winrate, danach Platzierungsdifferenz und Alias", () => {
  const result = calculateOpponentStats([...games("a", 5, 1, 3, 100, 90, "Zeta"), ...games("b", 5, 1, 2, 100, 90, "Alpha")]);
  assert.equal(result.favorite?.id, "a");
  assert.equal(result.nemesis?.id, "b");
  assert.deepEqual(result.rows.map((row) => row.id), ["a", "b"]);
});
