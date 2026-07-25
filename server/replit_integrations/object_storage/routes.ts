import type { Express } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { isR2Configured, getUploadUrl, getDownloadUrl } from "../../r2-storage";

/**
 * Register object storage routes for file uploads.
 * Uses Cloudflare R2 if configured, otherwise falls back to Replit Object Storage.
 */
export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();

  /**
   * Request a presigned URL for file upload.
   * Uses Cloudflare R2 if configured.
   * Supports center-specific storage paths via centerId parameter.
   */
  app.post("/api/uploads/request-url", async (req, res) => {
    try {
      const { name, size, contentType, prefix, centerId } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      // Check if R2 is configured (required for production/Railway)
      if (isR2Configured()) {
        // Build storage prefix with optional center isolation
        let storagePrefix = prefix || "homework";
        if (centerId) {
          storagePrefix = `centers/${centerId}/${storagePrefix}`;
        }
        const { uploadUrl, objectKey, publicUrl } = await getUploadUrl(contentType || "image/jpeg", storagePrefix, name);
        console.log(`[ObjectStorage] Generated R2 upload URL - objectKey: ${objectKey}, publicUrl: ${publicUrl}`);
        return res.json({
          uploadURL: uploadUrl,
          objectPath: objectKey,
          publicUrl: publicUrl,
          metadata: { name, size, contentType },
        });
      }

      // Check if Replit Object Storage is available (development only)
      const hasReplitStorage = process.env.PRIVATE_OBJECT_DIR || process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      if (!hasReplitStorage) {
        console.error("Storage not configured. R2 env vars:", {
          R2_ACCOUNT_ID: !!process.env.R2_ACCOUNT_ID,
          R2_ACCESS_KEY_ID: !!process.env.R2_ACCESS_KEY_ID,
          R2_SECRET_ACCESS_KEY: !!process.env.R2_SECRET_ACCESS_KEY,
          R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
        });
        return res.status(500).json({ 
          error: "Storage not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME environment variables." 
        });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  /**
   * Serve uploaded objects (Replit Object Storage only).
   * R2 images are served directly from R2 public URL.
   */
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}

