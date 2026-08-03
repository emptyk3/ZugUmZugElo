import assert from "node:assert/strict";
import test from "node:test";
import { calculateOpponentStats, type OpponentGame } from "./opponent-stats.ts";

const games = (id: string, count: number, ownPlacement: number, opponentPlacement: number): OpponentGame[] => Array.from({ length: count }, (_, index) => ({ gameId: `g-${id}-${index}`, ownPlacement, opponentPlacement, opponent: { id, alias: `Alias ${id}`, imageUrl: null } }));
test("Lieblingsgegner und Erzfeind werden erst ab fünf Partien bestimmt", () => { assert.equal(calculateOpponentStats(games("a", 4, 1, 2)).favorite, null); const result = calculateOpponentStats([...games("a", 5, 1, 2), ...games("b", 5, 2, 1)]); assert.equal(result.favorite?.id, "a"); assert.equal(result.nemesis?.id, "b"); });
test("Mehrspielerpartie zählt je Gegner nur einmal und Links nutzen stabile Player.id", () => { const duplicate = games("stable-id", 1, 1, 2)[0]; const result = calculateOpponentStats([duplicate, duplicate]); assert.equal(result.rows[0].games, 1); assert.equal(result.rows[0].id, "stable-id"); const page = readFileSync("app/spieler/[id]/page.tsx", "utf8"); assert.match(page, /playerId=\{row\.id\}/); });

import { readFileSync } from "node:fs";
