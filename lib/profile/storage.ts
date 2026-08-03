const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 2 * 1024 * 1024;
export async function storeProfileImage(file: File) {
  if (!ALLOWED_TYPES.has(file.type)) throw new Error("Profilbilder müssen JPEG, PNG oder WebP sein.");
  if (file.size <= 0 || file.size > MAX_BYTES) throw new Error("Das Profilbild darf höchstens 2 MB groß sein.");
  const mode=process.env.PROFILE_IMAGE_STORAGE_MODE;
  if (process.env.NODE_ENV==="production" || mode!=="development-data-url") throw new Error("Ein sicherer Profilbild-Speicher ist noch nicht konfiguriert.");
  const bytes=Buffer.from(await file.arrayBuffer());
  return { url:`data:${file.type};base64,${bytes.toString("base64")}`, storageId:`dev-data-${crypto.randomUUID()}` };
}
