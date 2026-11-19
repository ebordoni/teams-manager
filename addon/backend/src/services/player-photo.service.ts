import sharp from "sharp";
import { z } from "zod";

export const MAX_PHOTO_BYTES = 80 * 1024;
const MAX_UPLOAD_BYTES = 256 * 1024;
const DATA_URL = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
export const photoInputSchema = z
  .string()
  .max(
    Math.ceil(MAX_UPLOAD_BYTES / 3) * 4 + 64,
    "Foto troppo pesante: carica l'immagine dal selettore dell'app",
  )
  .regex(DATA_URL, "Formato foto non valido: usa JPG, PNG o WebP");
export const storedPhotoSchema = photoInputSchema.refine(
  (value) =>
    value.startsWith("data:image/jpeg;base64,") &&
    Buffer.from(value.slice(value.indexOf(",") + 1), "base64").length <=
      MAX_PHOTO_BYTES,
  "La foto nel backup supera il limite di 80 KB o non è nel formato previsto",
);
export class PlayerPhotoError extends Error {}

function decodePhoto(value: string, maxBytes: number) {
  const match = DATA_URL.exec(value);
  if (!match || match[2]!.length % 4 !== 0)
    throw new PlayerPhotoError("Immagine non valida.");
  const bytes = Buffer.from(match[2]!, "base64");
  if (!bytes.length || bytes.length > maxBytes)
    throw new PlayerPhotoError(
      "Immagine troppo pesante. Usa il caricamento foto dell'app per ridimensionarla.",
    );
  return { bytes, format: match[1] === "jpeg" ? "jpeg" : match[1] };
}

export async function normalisePlayerPhoto(
  value: string | null,
): Promise<string | null> {
  if (value === null) return null;
  const { bytes, format } = decodePhoto(value, MAX_UPLOAD_BYTES);
  try {
    const image = sharp(bytes, {
      limitInputPixels: 4 * 1024 * 1024,
      failOn: "warning",
      animated: false,
    });
    const metadata = await image.metadata();
    if (metadata.format !== format || (metadata.pages ?? 1) > 1)
      throw new Error("Formato non supportato");
    for (const quality of [78, 60, 42]) {
      const output = await image
        .clone()
        .rotate()
        .resize(512, 512, { fit: "cover", withoutEnlargement: true })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality })
        .toBuffer();
      if (output.length <= MAX_PHOTO_BYTES)
        return `data:image/jpeg;base64,${output.toString("base64")}`;
    }
    const output = await image
      .clone()
      .rotate()
      .resize(320, 320, { fit: "cover", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 55 })
      .toBuffer();
    if (output.length <= MAX_PHOTO_BYTES)
      return `data:image/jpeg;base64,${output.toString("base64")}`;
  } catch {
    throw new PlayerPhotoError(
      "Impossibile leggere la foto, oppure dimensioni eccessive. Seleziona un'immagine JPG, PNG o WebP valida.",
    );
  }
  throw new PlayerPhotoError(
    "Immagine troppo complessa. Seleziona una foto più piccola.",
  );
}

/** Valida il backup senza ricomprimere: l'export/import conserva i byte della foto. */
export async function validateStoredPhoto(value: string) {
  if (!storedPhotoSchema.safeParse(value).success)
    throw new PlayerPhotoError("Foto nel backup non valida.");
  const { bytes } = decodePhoto(value, MAX_PHOTO_BYTES);
  try {
    const image = sharp(bytes, {
      limitInputPixels: 512 * 512,
      failOn: "warning",
    });
    const metadata = await image.metadata();
    if (
      metadata.format !== "jpeg" ||
      !metadata.width ||
      !metadata.height ||
      metadata.width > 512 ||
      metadata.height > 512 ||
      metadata.exif ||
      metadata.xmp ||
      metadata.iptc ||
      metadata.icc
    )
      throw new Error("Foto non normalizzata");
    await image.raw().toBuffer();
  } catch {
    throw new PlayerPhotoError(
      "Foto nel backup danneggiata o non normalizzata.",
    );
  }
}
