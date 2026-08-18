/**
 * Utilitas kompresi foto berbasis browser HTML5 Canvas.
 * Mengompres foto berukuran besar hingga max 1600px dengan kualitas JPEG 80%
 * untuk menghemat penyimpanan tanpa menurunkan kejelasan fisik foto.
 */

export interface CompressOptions {
  maxDimension?: number; // Default: 1600px
  quality?: number;      // Default: 0.8 (80%)
  maxSizeBytes?: number; // Default: 5MB (5 * 1024 * 1024)
}

export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const maxDimension = options.maxDimension || 1600;
  const quality = options.quality !== undefined ? options.quality : 0.8;
  const maxSizeBytes = options.maxSizeBytes || 5 * 1024 * 1024; // 5 MB

  // 1. Validasi Batas Ukuran File Asli (Maksimal 5 MB)
  if (file.size > maxSizeBytes) {
    throw new Error(
      `Ukuran gambar "${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)} MB) melebihi batas maksimal 5 MB.`
    );
  }

  // Jika file bukan tipe gambar, kembalikan langsung
  if (!file.type.startsWith("image/")) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Hitung skala jika dimensi melebihi maxDimension (1600px)
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return resolve(file); // Fallback ke file asli jika context canvas gagal
        }

        // Gambar ulang di atas canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Export ke Blob JPEG dengan kualitas 80%
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve(file);
            }

            // Ganti ekstensi filename menjadi .jpg
            const originalName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
            const compressedFileName = `${originalName}_compressed.jpg`;

            const compressedFile = new File([blob], compressedFileName, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });

            resolve(compressedFile);
          },
          "image/jpeg",
          quality
        );
      };

      img.onerror = () => reject(new Error("Gagal membaca berkas gambar."));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error("Gagal membaca berkas."));
    reader.readAsDataURL(file);
  });
}
