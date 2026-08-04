import assert from "node:assert/strict";
import test from "node:test";
import { formatElo, formatEloChange } from "./elo.ts";

test("Elo-Werte werden ausschließlich für die Anzeige ganzzahlig gerundet", () => {
  assert.equal(formatElo(1499.6).replace(/\s/g, ""), "1500");
  assert.equal(formatEloChange(12.7), "+13");
  assert.equal(formatEloChange(-8.4), "−8");
  assert.equal(formatEloChange(0.2), "0");
});
