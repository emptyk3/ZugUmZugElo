import { del, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";

const ALLOWED = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);
export const MAX_PROFILE_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_GAME_IMAGE_BYTES = Math.floor(3.5 * 1024 * 1024);

export function validateImageFile(file: Pick<File, "type" | "size">, area: "profiles" | "games" = "profiles") {
  const extension = ALLOWED.get(file.type);
  if (!extension) throw new Error("Bilder müssen JPEG, PNG oder WebP sein.");
  const maximum = area === "games" ? MAX_GAME_IMAGE_BYTES : MAX_PROFILE_IMAGE_BYTES;
  if (file.size <= 0 || file.size > maximum) {
    throw new Error(`Das Bild darf höchstens ${area === "games" ? "3,5" : "2"} MB groß sein.`);
  }
  return extension;
}

export type StoredImage = { url: string; storageId: string };
export async function storeImage(file: File, area: "profiles" | "games"): Promise<StoredImage> {
  const extension = validateImageFile(file, area);
  const mode = process.env.PROFILE_IMAGE_STORAGE_MODE;
  if (mode === "development-data-url") {
    if (process.env.NODE_ENV === "production") throw new Error("development-data-url ist in Production nicht erlaubt.");
    return { url: `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`, storageId: `dev-data-${randomUUID()}` };
  }
  if (mode !== "vercel-blob") throw new Error("Kein sicherer Bildspeicher ist konfiguriert.");
  const blob = await put(`${area}/${randomUUID()}.${extension}`, file, { access: "public", addRandomSuffix: false, contentType: file.type });
  return { url: blob.url, storageId: blob.pathname };
}
export async function deleteStoredImage(image: { url?: string | null; storageId?: string | null }) {
  if (!image.url && !image.storageId) return;
  if (image.storageId?.startsWith("dev-data-") || image.url?.startsWith("data:")) return;
  if (process.env.PROFILE_IMAGE_STORAGE_MODE !== "vercel-blob") throw new Error("Vercel-Blob-Löschung ist nicht konfiguriert.");
  await del(image.url ?? image.storageId!);
}
export async function withStoredImageLifecycle<T>(file: File, area: "profiles" | "games", operation: (image: StoredImage) => Promise<T>, dependencies = { store: storeImage, remove: deleteStoredImage }) {
  const image = await dependencies.store(file, area);
  try { return await operation(image); } catch (error) { await dependencies.remove(image).catch(() => undefined); throw error; }
}
