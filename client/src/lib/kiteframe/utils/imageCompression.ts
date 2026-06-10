export const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const IMAGE_MAX_BYTES_LABEL = '5 MB';

const COMPRESS_MAX_DIM = 1200;
const COMPRESS_QUALITY = 0.85;

/**
 * Compresses a raster image to at most 1200 px on its longest side at JPEG 0.85 quality.
 * SVGs are returned unchanged (they are vector — compression doesn't apply).
 * Falls back to the original file if anything goes wrong.
 */
export async function compressImage(file: File): Promise<File> {
  if (file.type === 'image/svg+xml') return file;

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      if (width > COMPRESS_MAX_DIM || height > COMPRESS_MAX_DIM) {
        if (width >= height) {
          height = Math.round((height * COMPRESS_MAX_DIM) / width);
          width = COMPRESS_MAX_DIM;
        } else {
          width = Math.round((width * COMPRESS_MAX_DIM) / height);
          height = COMPRESS_MAX_DIM;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          const outName = file.name.replace(/\.[^.]+$/, '.jpg');
          resolve(new File([blob], outName, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        COMPRESS_QUALITY,
      );
    };

    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}
