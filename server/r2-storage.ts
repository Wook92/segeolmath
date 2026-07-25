import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "homework-images";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

console.log(`[R2] Config loaded - ACCOUNT_ID: ${R2_ACCOUNT_ID ? 'set' : 'NOT SET'}, PUBLIC_URL: ${R2_PUBLIC_URL || 'NOT SET'}, BUCKET: ${R2_BUCKET_NAME}`);

let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!r2Client) {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      throw new Error("R2 credentials not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY");
    }
    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
      // Disable checksum for R2 compatibility
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return r2Client;
}

export function isR2Configured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
}

function getExtFromContentType(contentType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png",
    "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg",
    "application/pdf": "pdf", "video/mp4": "mp4",
  };
  return map[contentType] || "bin";
}

export async function getUploadUrl(contentType: string = "image/jpeg", prefix: string = "homework", originalFileName?: string): Promise<{ uploadUrl: string; objectKey: string; publicUrl: string }> {
  const client = getR2Client();
  const ext = originalFileName 
    ? (originalFileName.split('.').pop()?.toLowerCase() || getExtFromContentType(contentType))
    : getExtFromContentType(contentType);
  const objectKey = `${prefix}/${randomUUID()}.${ext}`;
  
  // Don't include ContentType in the command - let the client set it freely
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: objectKey,
  });

  // Generate presigned URL with minimal signed headers for R2 compatibility
  const uploadUrl = await getSignedUrl(client, command, { 
    expiresIn: 900,
    // Only sign the essential headers - let content-type be unsigned
    signableHeaders: new Set(['host']),
    // Exclude checksum-related headers from signature
    unhoistableHeaders: new Set([
      'content-type',
      'x-amz-checksum-crc32',
      'x-amz-checksum-crc32c', 
      'x-amz-checksum-sha1',
      'x-amz-checksum-sha256',
      'x-amz-sdk-checksum-algorithm',
    ]),
  });
  
  const publicUrl = R2_PUBLIC_URL 
    ? `${R2_PUBLIC_URL}/${objectKey}`
    : uploadUrl.split("?")[0];

  return { uploadUrl, objectKey, publicUrl };
}

export async function getPresignedUploadUrl(objectKey: string): Promise<{ uploadUrl: string; publicUrl: string; objectKey: string }> {
  const client = getR2Client();
  
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: objectKey,
  });

  const uploadUrl = await getSignedUrl(client, command, { 
    expiresIn: 900,
    signableHeaders: new Set(['host']),
    unhoistableHeaders: new Set([
      'content-type',
      'x-amz-checksum-crc32',
      'x-amz-checksum-crc32c', 
      'x-amz-checksum-sha1',
      'x-amz-checksum-sha256',
      'x-amz-sdk-checksum-algorithm',
    ]),
  });
  
  // Use R2_PUBLIC_URL if configured, otherwise use proxy URL for same-origin serving
  const publicUrl = R2_PUBLIC_URL 
    ? `${R2_PUBLIC_URL}/${objectKey}`
    : `/api/r2-proxy/${objectKey}`;

  return { uploadUrl, publicUrl, objectKey };
}

export function getPublicUrl(objectKey: string): string {
  return R2_PUBLIC_URL
    ? `${R2_PUBLIC_URL}/${objectKey}`
    : `/api/r2-proxy/${objectKey}`;
}

export async function getDownloadUrl(objectKey: string): Promise<string> {
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/${objectKey}`;
  }
  
  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: objectKey,
  });

  return await getSignedUrl(client, command, { expiresIn: 3600 });
}

export async function downloadBuffer(objectKey: string): Promise<Buffer> {
  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: objectKey,
  });
  const response = await client.send(command);
  if (!response.Body) throw new Error("Empty response body");
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as any) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function deleteObject(objectKey: string): Promise<void> {
  const client = getR2Client();
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: objectKey,
  });
  await client.send(command);
}

export async function uploadBuffer(buffer: Buffer, objectKey: string, contentType: string): Promise<string> {
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: objectKey,
    Body: buffer,
    ContentType: contentType,
  });
  await client.send(command);
  
  return R2_PUBLIC_URL 
    ? `${R2_PUBLIC_URL}/${objectKey}`
    : objectKey;
}

export async function listAllObjectsWithPrefix(prefix: string): Promise<string[]> {
  if (!isR2Configured()) {
    return [];
  }
  
  const client = getR2Client();
  const keys: string[] = [];
  let continuationToken: string | undefined;
  
  do {
    const listCommand = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    
    const response = await client.send(listCommand);
    
    if (response.Contents) {
      for (const object of response.Contents) {
        if (object.Key) {
          keys.push(object.Key);
        }
      }
    }
    
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);
  
  return keys;
}

export async function deleteAllObjectsWithPrefix(prefix: string): Promise<number> {
  if (!isR2Configured()) {
    return 0;
  }
  
  const client = getR2Client();
  let deletedCount = 0;
  let continuationToken: string | undefined;
  
  do {
    const listCommand = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    
    const response = await client.send(listCommand);
    
    if (response.Contents) {
      for (const object of response.Contents) {
        if (object.Key) {
          try {
            await deleteObject(object.Key);
            deletedCount++;
          } catch (error) {
            console.error(`[R2] Failed to delete ${object.Key}:`, error);
          }
        }
      }
    }
    
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);
  
  return deletedCount;
}

export async function deleteExpiredObjects(maxAgeDays: number = 10): Promise<number> {
  const client = getR2Client();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
  
  let deletedCount = 0;
  let continuationToken: string | undefined;
  
  do {
    const listCommand = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: "homework/",
      ContinuationToken: continuationToken,
    });
    
    const response = await client.send(listCommand);
    
    if (response.Contents) {
      for (const object of response.Contents) {
        if (object.LastModified && object.LastModified < cutoffDate && object.Key) {
          try {
            await deleteObject(object.Key);
            deletedCount++;
          } catch (error) {
            console.error(`[R2 Cleanup] Failed to delete ${object.Key}:`, error);
          }
        }
      }
    }
    
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);
  
  return deletedCount;
}

export async function startCleanupScheduler(intervalHours: number = 24): Promise<void> {
  const runCleanup = async () => {
    if (!isR2Configured()) {
      return;
    }
    
    try {
      await deleteExpiredObjects(10);
    } catch (error: any) {
      // Only log if not an auth error (auth errors are expected when R2 not properly configured)
      if (error?.Code !== 'Unauthorized') {
        console.error("[R2] Cleanup error:", error?.message || error);
      }
    }
    
    // Process scheduled deletions from deleted_objects table
    await processScheduledDeletions();
  };

  await runCleanup();
  setInterval(runCleanup, intervalHours * 60 * 60 * 1000);
}

// Process scheduled deletions from deleted_objects table
async function processScheduledDeletions(): Promise<void> {
  try {
    const { storage } = await import("./storage");
    const expiredObjects = await storage.getExpiredDeletedObjects();
    
    if (expiredObjects.length === 0) {
      return;
    }
    
    for (const obj of expiredObjects) {
      try {
        if (isR2Configured()) {
          await deleteObject(obj.objectKey);
        }
        await storage.removeDeletedObject(obj.id);
      } catch (error) {
        console.error(`[R2] Failed to delete ${obj.objectKey}:`, error);
      }
    }
  } catch (error) {
    console.error("[R2] Scheduled deletion error:", error);
  }
}
