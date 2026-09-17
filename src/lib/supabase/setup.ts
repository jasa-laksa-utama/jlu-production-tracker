import { createAdminClient } from "./server";

const DOCS_BUCKET_NAME = "project-documents";
const QC_BUCKET_NAME = "qc-attachments";

export async function ensureBucketExists() {
  const supabase = createAdminClient();

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error("Error listing buckets:", listError);
    return { success: false, error: listError.message };
  }

  // 1. Check & Create project-documents bucket (Private)
  const docsExists = buckets.some((b) => b.id === DOCS_BUCKET_NAME);
  if (!docsExists) {
    console.log(`Bucket "${DOCS_BUCKET_NAME}" does not exist. Creating...`);
    await supabase.storage.createBucket(DOCS_BUCKET_NAME, {
      public: false,
      allowedMimeTypes: [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
        "application/zip",
      ],
      fileSizeLimit: 26214400, // 25MB
    });
  }

  // 2. Check & Create qc-attachments bucket (Public)
  const qcExists = buckets.some((b) => b.id === QC_BUCKET_NAME);
  if (!qcExists) {
    console.log(`Bucket "${QC_BUCKET_NAME}" does not exist. Creating...`);
    const { error: qcError } = await supabase.storage.createBucket(QC_BUCKET_NAME, {
      public: true, // Public bucket as requested
      allowedMimeTypes: [
        "image/jpeg",
        "image/png",
        "image/webp",
      ],
      fileSizeLimit: 5242880, // 5MB limit
    });
    if (qcError) {
      console.error("Error creating qc-attachments bucket:", qcError);
    } else {
      console.log(`Bucket "${QC_BUCKET_NAME}" created successfully.`);
    }
  }

  return { success: true };
}
