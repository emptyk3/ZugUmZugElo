import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { comparePlayerSearchMatches, normalizePlayerSearch, playerMatchesSearch, type PlayerSearchCandidate } from "./public-player-search.ts";

const player = (id: string, alias: string, firstName: string | null, lastName: string | null): PlayerSearchCandidate => ({ id, alias, firstName, lastName });

test("Suchbegriffe werden case-insensitive und mit einfachen Leerzeichen normalisiert", () => {
  assert.equal(normalizePlayerSearch("  MICHAEL   Tieber  "), "michael tieber");
});

test("Alias, Alias-Teil, Vorname, Nachname und vollständiger Name finden denselben Spieler", () => {
  const row = player("p1", "Mshö", "Michael", "Tieber");
  for (const query of ["Mshö", "shö", "michael", "TIEBER", "  Michael   Tieber  "]) {
    assert.equal(playerMatchesSearch(row, query), true, query);
  }
});

test("Alias-Treffer werden vor exakten und teilweisen Namen priorisiert", () => {
  const rows = [
    player("name", "Zulu", "Michael", "Tieber"),
    player("part", "Alpha", "Michaela", "Anders"),
    player("alias-part", "Super Michael", null, null),
    player("alias-start", "Michael Zug", null, null),
    player("alias-exact", "Michael", null, null),
  ];
  assert.deepEqual(rows.sort(comparePlayerSearchMatches("michael")).map(({ id }) => id), ["alias-exact", "alias-start", "alias-part", "name", "part"]);
});

test("Spieler ohne Namen bleiben über Alias stabil auffindbar", () => {
  const rows = [player("b", "Mshö", null, null), player("a", "Mshö", null, null)];
  assert.equal(playerMatchesSearch(rows[0], "msh"), true);
  assert.deepEqual(rows.sort(comparePlayerSearchMatches("mshö")).map(({ id }) => id), ["a", "b"]);
});

test("Server sucht Namen, gibt aber ausschließlich öffentliche Ergebnisfelder zurück", () => {
  const action = readFileSync("app/partie-eintragen/actions.ts", "utf8");
  assert.match(action, /firstName: \{ contains: query, mode: "insensitive" \}/);
  assert.match(action, /lastName: \{ contains: query, mode: "insensitive" \}/);
  assert.match(action, /firstName: \{ contains: firstNameQuery/);
  assert.match(action, /lastName: \{ contains: lastNameQuery/);
  assert.match(action, /\.map\(\(\{ id, alias, user \}\) => \(\{ id, alias, user: user \? \{ profileImageUrl: user\.profileImageUrl \} : null \}\)\)/);
  assert.doesNotMatch(action.slice(action.indexOf("return players"), action.indexOf("export async function createPlayer")), /email/);
});
