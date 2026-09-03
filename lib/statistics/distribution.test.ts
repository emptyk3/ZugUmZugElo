import assert from "node:assert/strict";
import test from "node:test";
import { median, quartiles } from "./distribution.ts";

test("Median behandelt ungerade, gerade, leere und ungerundete Daten", () => {
  assert.equal(median([110, 90, 100]), 100);
  assert.equal(median([120, 90, 110, 100]), 105);
  assert.equal(median([1.1, 1.2]), 1.15);
  assert.equal(median([]), null);
});

test("Quartile schließen bei ungerader Anzahl den Gesamtmedian aus", () => {
  assert.deepEqual(quartiles([1, 2, 3, 4, 5]), { q1: 1.5, q3: 4.5 });
  assert.deepEqual(quartiles([1, 2, 3, 4]), { q1: 1.5, q3: 3.5 });
  assert.deepEqual(quartiles([125]), { q1: 125, q3: 125 });
  assert.equal(quartiles([]), null);
});
