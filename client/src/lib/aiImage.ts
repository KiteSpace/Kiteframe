/** Long-edge limit for images sent to Claude; larger images are downscaled by the API anyway. */
export const AI_IMAGE_MAX_EDGE = 1568;

export async function resizeImageDataUrl(
  dataUrl: string,
  maxPx: number,
  type: "image/jpeg" | "image/png" = "image/jpeg",
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Guard against onload/onerror never firing (corrupt data URL, browser quirk)
    const timer = setTimeout(() => reject(new Error("Image resize timed out")), 8000);

    const img = new Image();
    img.onload = () => {
      clearTimeout(timer);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL(type, 0.85));
    };
    img.onerror = () => { clearTimeout(timer); reject(new Error("Failed to load image for resize")); };
    img.src = dataUrl;
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Reads an image file, downscales it to AI_IMAGE_MAX_EDGE and re-encodes it as PNG (PNG input) or JPEG. */
export async function prepareImageForAi(file: File): Promise<{ base64: string; mimeType: string; dataUrl: string }> {
  const original = await readAsDataUrl(file);
  let dataUrl = original;
  try {
    dataUrl = await resizeImageDataUrl(original, AI_IMAGE_MAX_EDGE, file.type === "image/png" ? "image/png" : "image/jpeg");
  } catch {
    // Send the original; the server still enforces type and size limits.
  }
  const mimeType = dataUrl.slice(5, dataUrl.indexOf(";")) || file.type || "image/png";
  return { base64: dataUrl.split(",")[1] ?? "", mimeType, dataUrl };
}
