"use client";

import { CLIENT_IMAGE_OPTIONS, compressionLongEdges, containedImageDimensions, validateClientImageSelection, type ClientImageKind } from "./image-rules";

const PREPARATION_ERROR = "Das Bild konnte nicht verarbeitet werden. Bitte prüfe die Datei oder wähle ein anderes Bild.";
const SIZE_ERROR = "Das Bild konnte nicht ausreichend verkleinert werden. Bitte wähle ein anderes Bild.";

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error(PREPARATION_ERROR)),
    "image/jpeg",
    quality,
  ));
}

export async function compressClientImage(file: File, kind: ClientImageKind): Promise<File> {
  validateClientImageSelection(file, kind);
  if (typeof window === "undefined" || typeof document === "undefined" || typeof createImageBitmap !== "function") {
    throw new Error("Die Bildvorbereitung wird von diesem Browser nicht unterstützt.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(PREPARATION_ERROR);
  }

  try {
    const options = CLIENT_IMAGE_OPTIONS[kind];
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error(PREPARATION_ERROR);

    for (const longEdge of compressionLongEdges(kind, bitmap.width, bitmap.height)) {
      const dimensions = containedImageDimensions(bitmap.width, bitmap.height, longEdge);
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      // JPEG besitzt keine Transparenz. Ein heller Hintergrund verhindert schwarze Flächen bei transparenten PNGs/WebPs.
      context.fillStyle = "#f7f4ec";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of options.qualities) {
        const blob = await canvasBlob(canvas, quality);
        if (blob.size <= options.maxOutputBytes) {
          const baseName = file.name.replace(/\.[^.]+$/, "") || "bild";
          return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
        }
      }
    }
    throw new Error(SIZE_ERROR);
  } finally {
    bitmap.close();
  }
}
