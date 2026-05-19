// ─── Image compression + validation for camera captures ──────────────────────

const MAX_DIMENSION   = 1920;       // px — longest edge
const MAX_SIZE_BYTES  = 4_000_000;  // 4 MB decoded
const JPEG_QUALITY    = 0.82;
const JPEG_AGGRESSIVE = 0.62;

export const SUPPORTED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export type  SupportedMime  = (typeof SUPPORTED_MIME)[number];

export interface ImageValidationResult {
  valid:               boolean;
  error?:              string;
  compressedDataUrl?:  string;
  compressedBase64?:   string;
  mimeType?:           SupportedMime;
  width?:              number;
  height?:             number;
  sizeKB?:             number;
}

/** Resize + compress a dataURL.  Returns compressed JPEG (always). */
export function compressAndValidateImage(
  dataUrl: string,
  mimeType = "image/jpeg",
): Promise<ImageValidationResult> {
  if (!SUPPORTED_MIME.includes(mimeType as SupportedMime)) {
    return Promise.resolve({
      valid: false,
      error: `Unsupported format "${mimeType}". Use JPEG, PNG, or WebP.`,
    });
  }

  return new Promise((resolve) => {
    const img = new Image();

    img.onerror = () =>
      resolve({ valid: false, error: "Could not load image for processing." });

    img.onload = () => {
      // 1. Compute output dimensions
      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / w, MAX_DIMENSION / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      // 2. Draw on canvas
      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve({ valid: false, error: "Canvas context unavailable." }); return; }
      ctx.drawImage(img, 0, 0, w, h);

      // 3. Encode at standard quality
      const tryEncode = (quality: number): string => canvas.toDataURL("image/jpeg", quality);

      let dataUrlOut = tryEncode(JPEG_QUALITY);
      let b64Out     = dataUrlOut.split(",")[1] ?? "";
      let sizeBytes  = Math.round((b64Out.length * 3) / 4);

      // 4. If still too large, try aggressive quality
      if (sizeBytes > MAX_SIZE_BYTES) {
        dataUrlOut = tryEncode(JPEG_AGGRESSIVE);
        b64Out     = dataUrlOut.split(",")[1] ?? "";
        sizeBytes  = Math.round((b64Out.length * 3) / 4);
      }

      // 5. If still too large, reject
      if (sizeBytes > MAX_SIZE_BYTES) {
        resolve({
          valid: false,
          error: `Image is too large (${Math.round(sizeBytes / 1024)} KB). Maximum is 4 MB.`,
        });
        return;
      }

      resolve({
        valid:               true,
        compressedDataUrl:   dataUrlOut,
        compressedBase64:    b64Out,
        mimeType:            "image/jpeg",
        width:               w,
        height:              h,
        sizeKB:              Math.round(sizeBytes / 1024),
      });
    };

    img.src = dataUrl;
  });
}

/** Validate a raw base64 string before sending to the server. */
export function validateBase64(base64: string): { valid: boolean; error?: string } {
  if (!base64 || typeof base64 !== "string") {
    return { valid: false, error: "No image data." };
  }
  // Must be a valid base64 string (only A-Z a-z 0-9 + / = )
  if (!/^[A-Za-z0-9+/=]+$/.test(base64)) {
    return { valid: false, error: "Malformed image data." };
  }
  // Rough size check: base64 length * 0.75 ≈ bytes
  const estimatedBytes = (base64.length * 3) / 4;
  if (estimatedBytes > MAX_SIZE_BYTES * 1.1) {
    return { valid: false, error: "Image payload exceeds 4 MB limit." };
  }
  return { valid: true };
}

/** Convert a base64 dataURL to a File for the upload pipeline. */
export function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, b64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const byteChars = atob(b64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}
