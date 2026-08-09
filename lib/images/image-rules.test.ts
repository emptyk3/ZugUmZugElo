import assert from "node:assert/strict";
import test from "node:test";
import { CLIENT_IMAGE_OPTIONS, compressionLongEdges, containedImageDimensions, validateClientImageSelection } from "./image-rules.ts";

test("kleine erlaubte Bildtypen bleiben auswählbar", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) assert.doesNotThrow(() => validateClientImageSelection({ type, size: 100 }, "game"));
});
test("ungültige, leere und zu große Originale werden abgelehnt", () => {
  assert.throws(() => validateClientImageSelection({ type: "image/gif", size: 100 }, "game"), /JPEG/);
  assert.throws(() => validateClientImageSelection({ type: "image/jpeg", size: 0 }, "game"), /leer oder beschädigt/);
  assert.throws(() => validateClientImageSelection({ type: "image/jpeg", size: 16 * 1024 * 1024 }, "game"), /15 MB/);
  assert.throws(() => validateClientImageSelection({ type: "image/jpeg", size: 11 * 1024 * 1024 }, "profile"), /10 MB/);
});
test("Skalierung erhält Seitenverhältnis und skaliert niemals hoch", () => {
  assert.deepEqual(containedImageDimensions(4000, 3000, 2200), { width: 2200, height: 1650 });
  assert.deepEqual(containedImageDimensions(800, 600, 2200), { width: 800, height: 600 });
});
test("Partie und Profil verwenden ihre maximalen langen Kanten und kleinere Fallbacks", () => {
  assert.equal(compressionLongEdges("game", 4000, 3000)[0], 2200);
  assert.equal(compressionLongEdges("profile", 4000, 3000)[0], 1200);
  assert.ok(compressionLongEdges("game", 4000, 3000).includes(1400));
});
test("harte Ausgabegrenzen entsprechen 3,5 MB und 2 MB", () => {
  assert.equal(CLIENT_IMAGE_OPTIONS.game.maxOutputBytes, Math.floor(3.5 * 1024 * 1024));
  assert.equal(CLIENT_IMAGE_OPTIONS.profile.maxOutputBytes, 2 * 1024 * 1024);
});
