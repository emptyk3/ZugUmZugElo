export const ALLOWED_CLIENT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type ClientImageKind = "game" | "profile";
export type ClientImageOptions = {
  maxOriginalBytes: number;
  maxOutputBytes: number;
  maxLongEdge: number;
  qualities: readonly number[];
  fallbackLongEdges: readonly number[];
};

export const CLIENT_IMAGE_OPTIONS: Record<ClientImageKind, ClientImageOptions> = {
  game: {
    maxOriginalBytes: 15 * 1024 * 1024,
    maxOutputBytes: Math.floor(3.5 * 1024 * 1024),
    maxLongEdge: 2200,
    qualities: [0.82, 0.75, 0.68, 0.6],
    fallbackLongEdges: [1800, 1600, 1400, 1200, 1000, 800],
  },
  profile: {
    maxOriginalBytes: 10 * 1024 * 1024,
    maxOutputBytes: 2 * 1024 * 1024,
    maxLongEdge: 1200,
    qualities: [0.82, 0.75, 0.68, 0.6],
    fallbackLongEdges: [1000, 800, 600],
  },
};

export function validateClientImageSelection(file: Pick<File, "type" | "size">, kind: ClientImageKind) {
  if (!ALLOWED_CLIENT_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_CLIENT_IMAGE_TYPES)[number])) {
    throw new Error("Bitte wähle ein Bild im Format JPEG, PNG oder WebP aus.");
  }
  if (file.size <= 0) throw new Error("Die ausgewählte Bilddatei ist leer oder beschädigt.");
  if (file.size > CLIENT_IMAGE_OPTIONS[kind].maxOriginalBytes) {
    throw new Error(`Das Originalbild darf höchstens ${kind === "game" ? "15" : "10"} MB groß sein.`);
  }
}

export function containedImageDimensions(width: number, height: number, maxLongEdge: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Das Bild besitzt ungültige Abmessungen.");
  }
  const scale = Math.min(1, maxLongEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function compressionLongEdges(kind: ClientImageKind, originalWidth: number, originalHeight: number) {
  const options = CLIENT_IMAGE_OPTIONS[kind];
  const originalLongEdge = Math.max(originalWidth, originalHeight);
  return [options.maxLongEdge, ...options.fallbackLongEdges]
    .map((edge) => Math.min(edge, originalLongEdge))
    .filter((edge, index, values) => values.indexOf(edge) === index);
}
