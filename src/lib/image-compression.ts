/**
 * Client-Side Image Compression Utility
 * Resizes large camera photos to max dimensions and converts them to optimized JPEG format
 * Fully compatible with @react-pdf/renderer and web browsers!
 */

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  savedPercent: number;
  previewUrl: string;
}

export async function compressImageToWebP(
  file: File,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  } = {},
): Promise<CompressionResult> {
  const { maxWidth = 1600, maxHeight = 1600, quality = 0.82 } = options;

  return new Promise((resolve, reject) => {
    // If not an image, return original
    if (!file.type.startsWith("image/")) {
      resolve({
        file,
        originalSize: file.size,
        compressedSize: file.size,
        savedPercent: 0,
        previewUrl: URL.createObjectURL(file),
      });
      return;
    }

    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    reader.onerror = (err) => reject(err);

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Scale down keeping aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve({
          file,
          originalSize: file.size,
          compressedSize: file.size,
          savedPercent: 0,
          previewUrl: URL.createObjectURL(file),
        });
        return;
      }

      // Smooth rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      // Export as standard JPEG (supported natively by @react-pdf/renderer)
      const exportType = "image/jpeg";
      const fileName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve({
              file,
              originalSize: file.size,
              compressedSize: file.size,
              savedPercent: 0,
              previewUrl: URL.createObjectURL(file),
            });
            return;
          }

          const compressedFile = new File([blob], fileName, {
            type: exportType,
            lastModified: Date.now(),
          });

          const savedPercent = Math.max(
            0,
            Math.round(((file.size - compressedFile.size) / file.size) * 100),
          );

          resolve({
            file: compressedFile,
            originalSize: file.size,
            compressedSize: compressedFile.size,
            savedPercent,
            previewUrl: URL.createObjectURL(compressedFile),
          });
        },
        exportType,
        quality,
      );
    };

    img.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Converts any image URL (including signed URLs with query params, WebP, etc.)
 * into a clean Base64 JPEG data URL for @react-pdf/renderer.
 */
export async function convertImageUrlToJpegDataUrl(url: string): Promise<string> {
  if (!url) return "";
  if (url.startsWith("data:image/jpeg") || url.startsWith("data:image/png")) {
    return url;
  }

  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result as string;
        // If already jpeg or png data url, return it
        if (base64Data.startsWith("data:image/jpeg") || base64Data.startsWith("data:image/png")) {
          resolve(base64Data);
          return;
        }

        // Otherwise convert to JPEG via canvas
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/jpeg", 0.85));
          } else {
            resolve(base64Data);
          }
        };
        img.onerror = () => resolve(base64Data);
        img.src = base64Data;
      };
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    // If fetch failed (e.g. CORS), fallback to HTML Image Element
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/jpeg", 0.85));
          } else {
            resolve(url);
          }
        } catch {
          resolve(url);
        }
      };
      img.onerror = () => resolve(url);
      img.src = url;
    });
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
