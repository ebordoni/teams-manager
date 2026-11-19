const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_PIXELS = 20 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 80 * 1024;

// Legge le dimensioni dall'intestazione PRIMA di decodificare la foto in memoria.
function dimensions(data: Uint8Array): [number, number] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (
    data.length >= 24 &&
    view.getUint32(0) === 0x89504e47 &&
    view.getUint32(4) === 0x0d0a1a0a
  )
    return [view.getUint32(16), view.getUint32(20)];
  if (data[0] === 0xff && data[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < data.length) {
      if (data[offset] !== 0xff) break;
      const marker = data[offset + 1]!;
      if (marker === 0xff) {
        offset++;
        continue;
      }
      const length = view.getUint16(offset + 2);
      if (length < 2 || offset + 2 + length > data.length) break;
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        ![0xc4, 0xc8, 0xcc].includes(marker)
      )
        return [view.getUint16(offset + 7), view.getUint16(offset + 5)];
      offset += length + 2;
    }
  }
  if (
    data.length >= 30 &&
    String.fromCharCode(...data.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...data.slice(8, 12)) === "WEBP"
  ) {
    const kind = String.fromCharCode(...data.slice(12, 16));
    if (kind === "VP8X")
      return [
        1 + data[24]! + (data[25]! << 8) + (data[26]! << 16),
        1 + data[27]! + (data[28]! << 8) + (data[29]! << 16),
      ];
    if (kind === "VP8 ")
      return [
        view.getUint16(26, true) & 0x3fff,
        view.getUint16(28, true) & 0x3fff,
      ];
    if (kind === "VP8L" && data[20] === 0x2f)
      return [
        1 + data[21]! + ((data[22]! & 0x3f) << 8),
        1 + (data[22]! >> 6) + (data[23]! << 2) + ((data[24]! & 0x0f) << 10),
      ];
  }
  throw new Error(
    "Foto non valida. Usa un file JPG, PNG o WebP, non SVG, GIF o HEIC.",
  );
}

export async function preparePlayerPhoto(file: File): Promise<string> {
  if (file.size > MAX_SOURCE_BYTES)
    throw new Error("La foto supera 8 MB. Scegli un'immagine più piccola.");
  const [width, height] = dimensions(new Uint8Array(await file.arrayBuffer()));
  if (!width || !height || width * height > MAX_PIXELS)
    throw new Error(
      "La foto supera 20 megapixel. Usa una versione a risoluzione più bassa.",
    );
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  }).catch(() => {
    throw new Error(
      "Impossibile leggere la foto. Prova un'altra immagine JPG, PNG o WebP.",
    );
  });
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Il browser non riesce a preparare la foto.");
    const side = Math.min(bitmap.width, bitmap.height);
    for (const [edge, quality] of [
      [512, 0.82],
      [512, 0.65],
      [512, 0.48],
      [320, 0.65],
    ]) {
      canvas.width = edge!;
      canvas.height = edge!;
      context.fillStyle = "#fff";
      context.fillRect(0, 0, edge!, edge!);
      context.drawImage(
        bitmap,
        (bitmap.width - side) / 2,
        (bitmap.height - side) / 2,
        side,
        side,
        0,
        0,
        edge!,
        edge!,
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (!blob || blob.size > MAX_OUTPUT_BYTES) continue;
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () =>
          reject(new Error("Lettura della foto non riuscita."));
        reader.readAsDataURL(blob);
      });
    }
    throw new Error("Foto troppo complessa. Scegli un'immagine più piccola.");
  } finally {
    bitmap.close();
  }
}
