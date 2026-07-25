import { useState, useCallback } from "react";
import type { UppyFile } from "@uppy/core";
import imageCompression from "browser-image-compression";

interface UploadMetadata {
  name: string;
  size: number;
  contentType: string;
}

// Image compression options - optimized for homework photos
const compressionOptions = {
  maxSizeMB: 0.8,           // Max 800KB per image
  maxWidthOrHeight: 1600,   // Max 1600px dimension
  useWebWorker: true,       // Use web worker for better performance
  fileType: "image/webp",   // Convert to WebP for smaller size
  initialQuality: 0.8,      // 80% quality
};

/**
 * Compress image file if it's an image
 */
async function compressImage(file: File): Promise<File> {
  // Only compress images
  if (!file.type.startsWith("image/")) {
    return file;
  }

  // Skip if already small enough (< 500KB)
  if (file.size < 500 * 1024) {
    return file;
  }

  try {
    const compressedFile = await imageCompression(file, compressionOptions);
    
    // Create a new File with WebP extension if converted
    const newName = file.name.replace(/\.[^.]+$/, ".webp");
    const newFile = new File([compressedFile], newName, {
      type: "image/webp",
      lastModified: Date.now(),
    });
    
    console.log(`[Image Compression] ${file.name}: ${(file.size / 1024).toFixed(0)}KB -> ${(newFile.size / 1024).toFixed(0)}KB (${((1 - newFile.size / file.size) * 100).toFixed(0)}% reduced)`);
    
    return newFile;
  } catch (error) {
    console.error("[Image Compression] Failed, using original:", error);
    return file;
  }
}

interface UploadResponse {
  uploadURL: string;
  objectPath: string;
  publicUrl?: string;
  metadata: UploadMetadata;
}

interface UseUploadOptions {
  onSuccess?: (response: UploadResponse) => void;
  onError?: (error: Error) => void;
  centerId?: string; // Optional center ID for center-specific storage
  prefix?: string; // Optional storage prefix (e.g., 'homework', 'clinic')
}

/**
 * React hook for handling file uploads with presigned URLs.
 *
 * This hook implements the two-step presigned URL upload flow:
 * 1. Request a presigned URL from your backend (sends JSON metadata, NOT the file)
 * 2. Upload the file directly to the presigned URL
 *
 * @example
 * ```tsx
 * function FileUploader() {
 *   const { uploadFile, isUploading, error } = useUpload({
 *     onSuccess: (response) => {
 *       console.log("Uploaded to:", response.objectPath);
 *     },
 *   });
 *
 *   const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
 *     const file = e.target.files?.[0];
 *     if (file) {
 *       await uploadFile(file);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <input type="file" onChange={handleFileChange} disabled={isUploading} />
 *       {isUploading && <p>Uploading...</p>}
 *       {error && <p>Error: {error.message}</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useUpload(options: UseUploadOptions = {}) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  /**
   * Request a presigned URL from the backend.
   * IMPORTANT: Send JSON metadata, NOT the file itself.
   */
  const requestUploadUrl = useCallback(
    async (file: File): Promise<UploadResponse> => {
      const response = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
          centerId: options.centerId,
          prefix: options.prefix,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get upload URL");
      }

      return response.json();
    },
    [options.centerId, options.prefix]
  );

  /**
   * Upload a file directly to the presigned URL.
   */
  const uploadToPresignedUrl = useCallback(
    async (file: File, uploadURL: string): Promise<void> => {
      const response = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to upload file to storage");
      }
    },
    []
  );

  /**
   * Upload a file using the presigned URL flow.
   *
   * @param file - The file to upload
   * @returns The upload response containing the object path
   */
  const uploadFile = useCallback(
    async (file: File): Promise<UploadResponse | null> => {
      setIsUploading(true);
      setError(null);
      setProgress(0);

      try {
        // Step 0: Compress image if needed
        setProgress(5);
        const processedFile = await compressImage(file);

        // Step 1: Request presigned URL (send metadata as JSON)
        setProgress(20);
        const uploadResponse = await requestUploadUrl(processedFile);

        // Step 2: Upload file directly to presigned URL
        setProgress(40);
        await uploadToPresignedUrl(processedFile, uploadResponse.uploadURL);

        setProgress(100);
        options.onSuccess?.(uploadResponse);
        return uploadResponse;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Upload failed");
        setError(error);
        options.onError?.(error);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [requestUploadUrl, uploadToPresignedUrl, options]
  );

  /**
   * Get upload parameters for Uppy's AWS S3 plugin.
   *
   * IMPORTANT: This function receives the UppyFile object from Uppy.
   * Use file.name, file.size, file.type to request per-file presigned URLs.
   *
   * Use this with the ObjectUploader component:
   * ```tsx
   * <ObjectUploader onGetUploadParameters={getUploadParameters}>
   *   Upload
   * </ObjectUploader>
   * ```
   */
  const getUploadParameters = useCallback(
    async (
      file: UppyFile<Record<string, unknown>, Record<string, unknown>>
    ): Promise<{
      method: "PUT";
      url: string;
      headers?: Record<string, string>;
    }> => {
      // Use the actual file properties to request a per-file presigned URL
      const response = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
          centerId: options.centerId,
          prefix: options.prefix,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get upload URL");
      }

      const data = await response.json();
      return {
        method: "PUT",
        url: data.uploadURL,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      };
    },
    [options.centerId, options.prefix]
  );

  return {
    uploadFile,
    getUploadParameters,
    isUploading,
    error,
    progress,
  };
}

