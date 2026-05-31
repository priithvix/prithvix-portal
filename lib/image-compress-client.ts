/** Client-side JPEG resize/compression for vision APIs (Groq base64 limit ~4MB). */

export async function compressImageToJpegDataUrl(
  file: File,
  opts?: { maxEdge?: number; maxBase64Chars?: number },
): Promise<string> {
  const maxEdge = opts?.maxEdge ?? 1600;
  const maxBase64Chars = opts?.maxBase64Chars ?? 3_800_000;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Could not read this image. Try JPG or PNG from gallery.');
  }

  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process image');

    ctx.drawImage(bitmap, 0, 0, w, h);

    let quality = 0.85;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (dataUrl.length > maxBase64Chars && quality > 0.45) {
      quality -= 0.07;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    if (dataUrl.length > maxBase64Chars) {
      throw new Error('Photo is still too large. Try another image or lower resolution.');
    }
    return dataUrl;
  } finally {
    bitmap.close();
  }
}
