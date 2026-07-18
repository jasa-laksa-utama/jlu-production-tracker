import { createAdminClient } from "./server";

const BUCKET_NAME = "project-documents";

export async function ensureBucketExists() {
  const supabase = createAdminClient();

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error("Error listing buckets:", listError);
    return { success: false, error: listError.message };
  }

  const exists = buckets.some((b) => b.id === BUCKET_NAME);

  if (!exists) {
    console.log(`Bucket "${BUCKET_NAME}" does not exist. Creating...`);
    const { data, error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: false, // Private bucket as requested for security
      allowedMimeTypes: [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "image/jpeg",
        "image/png",
        "application/zip",
      ],
      fileSizeLimit: 26214400, // 25MB
    });

    if (error) {
      console.error("Error creating bucket:", error);
      return { success: false, error: error.message };
    }
    console.log(`Bucket "${BUCKET_NAME}" created successfully.`);
    return { success: true, created: true };
  }

  console.log(`Bucket "${BUCKET_NAME}" already exists.`);
  return { success: true, created: false };
}
