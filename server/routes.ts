import type { Express } from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { UserRole, type User, type AttendanceRecord, type Class, homework, centers, classes, users, enrollments, userCenters, bugReports, attendanceRecords, classTextbooks, studentTextbookPurchases, supplementaryStudents, counselingRecords, newConsultations, assessments, homeworkSubmissions, schoolGrades, schoolSubjects, notifications, todos, todoAssignees, textbookProgress, exams, examParticipants, classNotes, studentClassNotes, userActivityLogs, isAssistantTeacher, getAssistantTeacherIds } from "@shared/schema";
import { format } from "date-fns";
import multer from "multer";
import path from "path";
import fs from "fs";
// XLSX loaded dynamically to reduce startup memory
import iconv from "iconv-lite";
import { sendAttendanceNotification, sendLateNotification, isSolapiConfigured, sendSms, sendSystemSms, clearCredentialsCache, getPlatformRegisteredSenderNumbers } from "./services/solapi";
import { sendBulkSmsToStudents } from "./services/scheduled-sms";
import { encrypt, decrypt } from "./crypto";
// reportGeneration loaded dynamically to reduce startup memory (uses OpenAI)
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { db } from "./db";
import { sql, eq, and, inArray, desc, isNull, gte, lte } from "drizzle-orm";
import { isR2Configured, getUploadUrl, deleteObject, uploadBuffer, getPresignedUploadUrl } from "./r2-storage";
import { confirmPayment, confirmPaymentWithKey, getClientKey, getDecryptedClientKey, isTossPaymentsConfigured, isTossPaymentsConfiguredForCenter, getPaymentByOrderId, getPaymentByOrderIdWithKey } from "./toss-payments";
import { registerMathWrongNoteRoutes } from "./routes/math-wrong-notes";

function getKoreanToday(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(null, true);
    }
  },
});

const clinicUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for clinic files
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("PDF, 이미지 파일만 업로드 가능합니다"));
    }
  },
});

// Memory storage for logo uploads (to R2)
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit for logos
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".ico", ".svg"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("이미지 파일만 업로드 가능합니다"));
    }
  },
});

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".xlsx", ".xls", ".csv", ".tsv"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("엑셀 파일(.xlsx, .xls) 또는 CSV/TSV 파일만 업로드 가능합니다"));
    }
  },
});

// Generate PIN from phone number (last 4 digits, or middle 4 if collision)
function generatePinFromPhone(phone: string, existingPins: string[]): string {
  // Remove non-digit characters
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return "";
  
  // Try last 4 digits first
  const last4 = digits.slice(-4);
  if (!existingPins.includes(last4)) {
    return last4;
  }
  
  // If collision, try middle 4 digits
  const middle4 = digits.slice(3, 7);
  if (!existingPins.includes(middle4)) {
    return middle4;
  }
  
  return "";
}

// Image processing utility for logo uploads (PNG conversion + resize to 512px max)
async function processLogoImage(buffer: Buffer, targetSize: number = 512): Promise<{ buffer: Buffer; contentType: string }> {
  try {
    const sharp = (await import('sharp')).default;
    
    // Get image metadata first
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    
    // Only resize if larger than target
    let pipeline = sharp(buffer);
    if (width > targetSize || height > targetSize) {
      pipeline = pipeline.resize(targetSize, targetSize, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }
    
    // Convert to PNG for maximum compatibility (especially iOS)
    const processedBuffer = await pipeline
      .png({ quality: 90, compressionLevel: 6 })
      .toBuffer();
    
    return { buffer: processedBuffer, contentType: 'image/png' };
  } catch (error) {
    console.error('[Logo Processing] Sharp error, returning original:', error);
    // Return original buffer if processing fails
    return { buffer, contentType: 'image/png' };
  }
}

// Generate specific icon sizes for PWA/iOS with padding to prevent logo from being too tight
async function generateIconSize(buffer: Buffer, size: number): Promise<Buffer> {
  try {
    const sharp = (await import('sharp')).default;
    
    // Add 15% padding on each side (so logo takes up 70% of the icon)
    const padding = Math.round(size * 0.15);
    const innerSize = size - (padding * 2);
    
    // Resize the logo to fit within the inner area, maintaining aspect ratio (fit: 'contain')
    const resizedLogo = await sharp(buffer)
      .resize(innerSize, innerSize, { 
        fit: 'contain',  // Maintain aspect ratio, don't crop or stretch
        background: { r: 255, g: 255, b: 255, alpha: 1 }  // White background for any gaps
      })
      .png()
      .toBuffer();
    
    // Create final icon with white background and centered logo
    return await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }  // White background
      }
    })
      .composite([{
        input: resizedLogo,
        gravity: 'center'  // Center the logo
      }])
      .png({ quality: 90 })
      .toBuffer();
  } catch (error) {
    console.error(`[Icon Generation] Failed to generate ${size}x${size}:`, error);
    return buffer;
  }
}

// 한 학생 기준으로 "현재 연결된 선생님"(담임 + 수강 중 수업의 담당 선생님) 집합을 구한다.
async function getConnectedTeacherIdsForStudent(centerId: string, studentId: string): Promise<{
  homeroomTeacherId: string | null;
  classTeacherIds: string[];
  connected: Set<string>;
}> {
  const student = await storage.getUser(studentId);
  const enrollments = await storage.getStudentEnrollments(studentId);
  const allClasses = await storage.getClasses(centerId);
  const enrolledClassIds = new Set(enrollments.map(e => e.classId));
  const classTeacherIds = Array.from(new Set(
    allClasses
      .filter(c => enrolledClassIds.has(c.id) && c.teacherId)
      .map(c => c.teacherId as string)
  ));
  const connected = new Set<string>(classTeacherIds);
  const homeroomTeacherId = student?.homeroomTeacherId ?? null;
  if (homeroomTeacherId) connected.add(homeroomTeacherId);
  return { homeroomTeacherId, classTeacherIds, connected };
}

// 수업 담당 선생님이 A→B로 바뀌면, 해당 수업 수강생들의 교사소통 대화를 B에게 인수인계한다.
// 단, A가 그 학생과 여전히 연결되어 있으면(담임이거나 다른 수강 수업의 담당) 이관하지 않는다(대화 도난 방지).
async function handoverTeacherCommunicationOnTeacherChange(
  centerId: string,
  classId: string,
  oldTeacherId: string | null | undefined,
  newTeacherId: string | null | undefined
): Promise<void> {
  if (!oldTeacherId || !newTeacherId || oldTeacherId === newTeacherId) return;
  const students = await storage.getClassStudents(classId);
  const allClasses = await storage.getClasses(centerId);
  for (const student of students) {
    const enrollments = await storage.getStudentEnrollments(student.id);
    const enrolledClassIds = new Set(enrollments.map(e => e.classId));
    const stillConnected =
      student.homeroomTeacherId === oldTeacherId ||
      allClasses.some(c => c.id !== classId && enrolledClassIds.has(c.id) && c.teacherId === oldTeacherId);
    if (stillConnected) continue;
    const moved = await storage.reassignTeacherStudentMessages(centerId, oldTeacherId, newTeacherId, student.id);
    if (moved > 0) {
      console.log(`[TeacherComm] 인수인계: 학생 ${student.id} 대화 ${moved}건을 ${oldTeacherId} → ${newTeacherId} 이관 (class ${classId})`);
    }
  }
}

// 시간표(정규 수업) 담당교사가 바뀌면, 해당 수업을 '반(classGroup)'으로 지정한
// 중등/고등 클리닉 학생들의 담당선생님(regularTeacherId)도 함께 변경한다.
// classGroup은 실제 수업을 "수업명 (반이름)" 문자열로 가리키며(과거 데이터는 "수업명"만 저장된 경우도 있음),
// 두 형식 모두 매칭한다.
async function syncClinicTeacherOnClassTeacherChange(
  centerId: string,
  cls: { name: string; subject?: string | null },
  oldTeacherId: string | null | undefined,
  newTeacherId: string | null | undefined
): Promise<void> {
  if (!newTeacherId || oldTeacherId === newTeacherId) return;
  const fullKey = cls.subject ? `${cls.name} (${cls.subject})` : cls.name;
  const nameKey = cls.name;
  const clinicStudentsList = await storage.getClinicStudents(centerId);
  let updated = 0;
  for (const cs of clinicStudentsList) {
    const group = cs.classGroup;
    if (!group || group === "미등록") continue;
    if (group !== fullKey && group !== nameKey) continue;
    if (cs.regularTeacherId === newTeacherId) continue;
    await storage.updateClinicStudent(cs.id, { regularTeacherId: newTeacherId });
    updated++;
  }
  if (updated > 0) {
    console.log(`[ClinicSync] 시간표 담당교사 변경 반영: 반="${fullKey}" 클리닉 학생 ${updated}명 담당선생님 → ${newTeacherId}`);
  }
}

// 이미 담당이 바뀌어 고아가 된 기존 대화를 복구한다.
// 학생이 단일 수업만 수강 중이고 고아 대화가 하나뿐인 명확한 경우에만 현재 담당 선생님에게 자동 이관한다.
// 모호한 경우(여러 수업/여러 고아)는 이관하지 않고, 목록 노출(이력)로 숨김만 방지한다.
async function reconcileStudentOrphanConversations(centerId: string, studentId: string): Promise<void> {
  const msgs = await storage.getStudentAllMessages(centerId, studentId);
  if (msgs.length === 0) return;
  const { classTeacherIds, connected } = await getConnectedTeacherIdsForStudent(centerId, studentId);
  const messageTeacherIds = Array.from(new Set(msgs.map(m => m.teacherId)));
  const orphanIds = messageTeacherIds.filter(t => !connected.has(t));
  if (orphanIds.length === 0) return;
  if (orphanIds.length === 1 && classTeacherIds.length === 1) {
    const moved = await storage.reassignTeacherStudentMessages(centerId, orphanIds[0], classTeacherIds[0], studentId);
    if (moved > 0) {
      console.log(`[TeacherComm] 고아 대화 복구: 학생 ${studentId} 대화 ${moved}건을 ${orphanIds[0]} → ${classTeacherIds[0]} 이관`);
    }
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // R2 Upload URL endpoint - generates presigned URL for direct R2 upload
  app.get("/api/r2/upload-url", async (req, res) => {
    try {
      const { prefix, actorId } = req.query;
      console.log(`[R2 Upload URL] Request - prefix: ${prefix}, actorId: ${actorId}`);
      
      if (!isR2Configured()) {
        console.error("[R2 Upload URL] R2 not configured");
        return res.status(503).json({ error: "R2 storage not configured" });
      }
      
      // Generate unique object key
      const timestamp = Date.now();
      const randomId = Math.round(Math.random() * 1e6);
      const objectKey = `${prefix || 'uploads'}/${timestamp}-${randomId}.png`;
      
      // Get presigned upload URL from r2-storage
      const { uploadUrl, publicUrl } = await getPresignedUploadUrl(objectKey);
      
      console.log(`[R2 Upload URL] Generated - objectKey: ${objectKey}, publicUrl: ${publicUrl}`);
      res.json({ uploadUrl, publicUrl, objectKey });
    } catch (error: any) {
      console.error("[R2 Upload URL] Failed:", error?.message || error);
      res.status(500).json({ error: `Failed to generate upload URL: ${error?.message || 'Unknown error'}` });
    }
  });

  // R2 Image Proxy - serves R2 images through same-origin to avoid mixed content issues
  app.get("/api/r2-proxy/*", async (req: any, res) => {
    try {
      const objectPath = req.params[0];
      if (!objectPath) {
        return res.status(400).json({ error: "Missing object path" });
      }
      
      const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;
      if (!R2_PUBLIC_URL) {
        return res.status(503).json({ error: "R2 not configured" });
      }
      
      const r2Url = `${R2_PUBLIC_URL}/${objectPath}`;
      
      // Fetch from R2 and proxy
      const response = await fetch(r2Url);
      if (!response.ok) {
        console.error(`[R2 Proxy] Failed to fetch ${objectPath}: ${response.status}`);
        return res.status(response.status).json({ 
          error: "Failed to fetch from R2", 
          status: response.status,
          objectPath 
        });
      }
      
      // Set cache headers - immutable for timestamped files
      const isTimestamped = /\d{13}/.test(objectPath); // Check for timestamp in filename
      if (isTimestamped) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else {
        res.setHeader("Cache-Control", "public, max-age=3600");
      }
      
      // CORS headers for same-origin compatibility
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      
      // Security headers for cross-origin image loading
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
      
      // Forward content type, with fallback for extensionless files
      let contentType = response.headers.get("content-type");
      if (!contentType || contentType === "application/octet-stream") {
        const ext = objectPath.split('.').pop()?.toLowerCase();
        const mimeMap: Record<string, string> = {
          jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
          gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
          pdf: "application/pdf", mp4: "video/mp4",
        };
        contentType = (ext && mimeMap[ext]) || "image/jpeg";
      }
      res.setHeader("Content-Type", contentType);
      
      // Forward content length if available
      const contentLength = response.headers.get("content-length");
      if (contentLength) {
        res.setHeader("Content-Length", contentLength);
      }
      
      // Stream the response
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error("[R2 Proxy] Error:", error);
      res.status(500).json({ error: "Proxy error" });
    }
  });

  // Helper to convert R2 URLs to proxy URLs for same-origin serving
  const toProxyUrl = (r2Url: string | null | undefined): string | null => {
    if (!r2Url) return null;
    const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;
    if (!R2_PUBLIC_URL) return r2Url;
    if (r2Url.startsWith(R2_PUBLIC_URL)) {
      const objectPath = r2Url.replace(R2_PUBLIC_URL + "/", "");
      return `/api/r2-proxy/${objectPath}`;
    }
    return r2Url;
  };

  // Diagnostic endpoint for logo URL status (helps debug caching issues)
  app.get("/api/logo-diagnostics", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      const diagnostics: any = {
        timestamp: new Date().toISOString(),
        r2Configured: isR2Configured(),
        r2PublicUrl: process.env.R2_PUBLIC_URL ? 'configured' : 'missing',
        center: null,
        logoUrls: {},
        proxyUrls: {},
        fetchResults: {},
      };
      
      if (centerId) {
        const center = await storage.getCenter(centerId);
        if (center) {
          diagnostics.center = {
            id: center.id,
            name: center.name,
            updatedAt: center.updatedAt,
          };
          
          const logoFields = ['loginLogoUrl', 'sidebarLogoUrl', 'faviconUrl', 'attendancePadLogoUrl', 'shortcutIconUrl'] as const;
          
          for (const field of logoFields) {
            const url = (center as any)[field];
            if (url) {
              diagnostics.logoUrls[field] = url;
              diagnostics.proxyUrls[field] = toProxyUrl(url);
              
              // Test fetch the URL
              try {
                const testUrl = url.startsWith('http') ? url : `${process.env.R2_PUBLIC_URL}/${url}`;
                const response = await fetch(testUrl, { method: 'HEAD' });
                diagnostics.fetchResults[field] = {
                  status: response.status,
                  ok: response.ok,
                  contentType: response.headers.get('content-type'),
                  contentLength: response.headers.get('content-length'),
                  cacheControl: response.headers.get('cache-control'),
                };
              } catch (fetchError: any) {
                diagnostics.fetchResults[field] = {
                  error: fetchError.message,
                };
              }
            }
          }
        }
      }
      
      res.json(diagnostics);
    } catch (error) {
      console.error("[Logo Diagnostics] Error:", error);
      res.status(500).json({ error: "Failed to get diagnostics" });
    }
  });

  // Apple-touch-icon endpoint - serves properly sized icon for iOS home screen
  app.get("/apple-touch-icon.png", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;
      
      let iconUrl: string | null = null;
      
      if (centerId) {
        const center = await storage.getCenter(centerId);
        if (center?.shortcutIconUrl) {
          iconUrl = center.shortcutIconUrl;
        } else if (center?.faviconUrl) {
          iconUrl = center.faviconUrl;
        }
      }
      
      // If we have a center icon URL, fetch and resize to 180x180 for iOS
      if (iconUrl && R2_PUBLIC_URL) {
        const fullUrl = iconUrl.startsWith('http') ? iconUrl : `${R2_PUBLIC_URL}/${iconUrl}`;
        const response = await fetch(fullUrl);
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          const resizedBuffer = await generateIconSize(buffer, 180);
          
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'public, max-age=3600');
          return res.send(resizedBuffer);
        }
      }
      
      // Fallback to default logo
      const defaultLogoPath = path.join(process.cwd(), 'client', 'public', 'default-favicon.png');
      if (fs.existsSync(defaultLogoPath)) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.sendFile(defaultLogoPath);
      }
      
      res.status(404).json({ error: "Icon not found" });
    } catch (error) {
      console.error("[Apple Touch Icon] Error:", error);
      res.status(500).json({ error: "Failed to serve icon" });
    }
  });

  // PWA Icon endpoint - serves properly sized icons (192x192 or 512x512) for manifest
  app.get("/api/pwa-icon/:size", async (req, res) => {
    try {
      const size = parseInt(req.params.size) || 512;
      const centerId = req.query.centerId as string;
      const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;
      
      let iconUrl: string | null = null;
      
      if (centerId) {
        const center = await storage.getCenter(centerId);
        if (center?.shortcutIconUrl) {
          iconUrl = center.shortcutIconUrl;
        } else if (center?.faviconUrl) {
          iconUrl = center.faviconUrl;
        }
      }
      
      // Fetch and resize icon
      if (iconUrl && R2_PUBLIC_URL) {
        const fullUrl = iconUrl.startsWith('http') ? iconUrl : `${R2_PUBLIC_URL}/${iconUrl}`;
        const response = await fetch(fullUrl);
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          const resizedBuffer = await generateIconSize(buffer, size);
          
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'public, max-age=3600');
          return res.send(resizedBuffer);
        }
      }
      
      // Fallback to default logo
      const defaultLogoPath = path.join(process.cwd(), 'client', 'public', 'logo.png');
      if (fs.existsSync(defaultLogoPath)) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.sendFile(defaultLogoPath);
      }
      
      res.status(404).json({ error: "Icon not found" });
    } catch (error) {
      console.error("[PWA Icon] Error:", error);
      res.status(500).json({ error: "Failed to serve icon" });
    }
  });

  // Dynamic manifest for PWA - center-specific icons and name with cache busting
  app.get("/api/manifest", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      const version = req.query.v as string || Date.now().toString();
      
      // Base manifest with version query for cache busting
      // Use dedicated PWA icon endpoints that properly resize images
      const manifest: any = {
        name: "이음위더스 - 학원 통합관리 시스템",
        short_name: "이음위더스",
        description: "학원 통합관리 시스템 - 수업 운영, 시간표, 숙제 관리, 평가 관리, 영상 제공",
        start_url: "/",
        display: "standalone",
        background_color: "#FFFFFF",
        theme_color: "#1E3A5F",
        orientation: "any",
        icons: [
          {
            src: `/api/pwa-icon/512?v=${version}`,
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: `/api/pwa-icon/192?v=${version}`,
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: `/api/pwa-icon/180?v=${version}`,
            sizes: "180x180",
            type: "image/png",
            purpose: "any"
          }
        ]
      };
      
      // If centerId is provided, customize manifest with center info
      if (centerId) {
        const center = await storage.getCenter(centerId);
        if (center) {
          manifest.name = `${center.name} - 학원 관리`;
          manifest.short_name = center.name;
          
          // Use center's shortcut icon if available - serve through PWA icon endpoint for proper sizing
          if (center.shortcutIconUrl || center.faviconUrl) {
            const versionParam = center.updatedAt ? new Date(center.updatedAt).getTime() : version;
            // Use the dedicated pwa-icon endpoint which properly resizes images
            manifest.icons = [
              {
                src: `/api/pwa-icon/512?centerId=${centerId}&v=${versionParam}`,
                sizes: "512x512",
                type: "image/png",
                purpose: "any maskable"
              },
              {
                src: `/api/pwa-icon/192?centerId=${centerId}&v=${versionParam}`,
                sizes: "192x192",
                type: "image/png",
                purpose: "any maskable"
              },
              {
                src: `/api/pwa-icon/180?centerId=${centerId}&v=${versionParam}`,
                sizes: "180x180",
                type: "image/png",
                purpose: "any"
              }
            ];
          }
        }
      }
      
      // No cache for manifest to always get latest
      res.setHeader('Content-Type', 'application/manifest+json');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.json(manifest);
    } catch (error) {
      console.error("[Manifest] Error:", error);
      // Return default manifest on error
      res.setHeader('Content-Type', 'application/manifest+json');
      res.setHeader('Cache-Control', 'no-cache');
      res.json({
        name: "이음위더스 - 학원 통합관리 시스템",
        short_name: "이음위더스",
        start_url: "/",
        display: "standalone",
        icons: [{ src: "/logo.png", sizes: "192x192", type: "image/png" }]
      });
    }
  });

  // Database health check endpoint
  app.get("/api/db-health", async (req, res) => {
    try {
      const result = await db.execute(sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`);
      const tables = Array.isArray(result) ? result.map((r: any) => r.table_name) : [];
      res.json({ 
        status: "connected", 
        tableCount: tables.length,
        tables: tables
      });
    } catch (error: any) {
      console.error("DB health check error:", error);
      res.status(500).json({ 
        status: "error", 
        message: error?.message || "Unknown error",
        stack: error?.stack
      });
    }
  });
  
  // Debug endpoint to test specific queries
  app.get("/api/debug-homework", async (req, res) => {
    try {
      const centerId = req.query.centerId as string || "5aa83006-0a61-4a19-a8fd-0bc6da175706";
      
      // Test 1: Check classes table columns
      const classesColumns = await db.execute(sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'classes' 
        ORDER BY ordinal_position
      `);
      
      // Test 2: Try to get classes by center
      let centerClasses: any[] = [];
      let classError = null;
      try {
        centerClasses = await db.select().from(classes).where(eq(classes.centerId, centerId));
      } catch (e: any) {
        classError = e?.message;
      }
      
      // Test 3: Get homework if we have classes
      let homeworkResult: any[] = [];
      let homeworkError = null;
      if (centerClasses.length > 0 && !classError) {
        try {
          const classIds = centerClasses.map((c) => c.id);
          homeworkResult = await db.select().from(homework).where(inArray(homework.classId, classIds));
        } catch (e: any) {
          homeworkError = e?.message;
        }
      }
      
      // Test 4: Check centers table
      const centersResult = await db.select().from(centers).limit(5);
      
      res.json({
        status: "ok",
        centerId,
        classesColumns: Array.isArray(classesColumns) ? classesColumns : [],
        centerClasses,
        classError,
        homeworkResult,
        homeworkError,
        centersSample: centersResult
      });
    } catch (error: any) {
      console.error("Debug homework error:", error);
      res.status(500).json({
        status: "error",
        message: error?.message || "Unknown error",
        stack: error?.stack,
        code: error?.code
      });
    }
  });
  
  // Endpoint to seed missing data in production
  app.post("/api/seed-missing-data", async (req, res) => {
    try {
      
      // Check if classes exist
      const existingClasses = await db.select().from(classes);
      if (existingClasses.length > 0) {
        return res.json({ status: "skipped", message: "Classes already exist", classCount: existingClasses.length });
      }
      
      // Get existing centers
      const allCenters = await db.select().from(centers);
      if (allCenters.length === 0) {
        return res.status(400).json({ status: "error", message: "No centers found" });
      }
      
      const dmcCenter = allCenters.find(c => c.name === "DMC센터") || allCenters[0];
      const mokdongCenter = allCenters.find(c => c.name === "목동센터") || allCenters[1] || allCenters[0];
      
      // Get existing teachers
      const allUsers = await db.select().from(users);
      const teachers = allUsers.filter(u => u.role === UserRole.TEACHER);
      const students = allUsers.filter(u => u.role === UserRole.STUDENT);
      
      if (teachers.length === 0) {
        return res.status(400).json({ status: "error", message: "No teachers found" });
      }
      
      // Create classes for DMC center
      const teacher1 = teachers[0];
      const [mathClass] = await db.insert(classes).values({
        name: "수학 A반",
        subject: "수학",
        classType: "regular",
        teacherId: teacher1.id,
        centerId: dmcCenter.id,
        classroom: "A101",
        days: ["mon", "wed", "fri"],
        startTime: "14:00",
        endTime: "16:00",
        color: "#3B82F6",
      }).returning();

      const [englishClass] = await db.insert(classes).values({
        name: "영어 기초반",
        subject: "영어",
        classType: "regular",
        teacherId: teacher1.id,
        centerId: dmcCenter.id,
        classroom: "B202",
        days: ["tue", "thu"],
        startTime: "16:00",
        endTime: "18:00",
        color: "#10B981",
      }).returning();

      const [testClass] = await db.insert(classes).values({
        name: "수학 평가",
        subject: "수학",
        classType: "assessment",
        teacherId: teacher1.id,
        centerId: dmcCenter.id,
        classroom: "A101",
        days: ["sat"],
        startTime: "10:00",
        endTime: "12:00",
        color: "#EF4444",
      }).returning();

      // Create classes for Mokdong center if we have more teachers
      let mokClasses: any[] = [];
      if (teachers.length > 1 && mokdongCenter.id !== dmcCenter.id) {
        const teacher2 = teachers[1];
        const [mokMathClass] = await db.insert(classes).values({
          name: "수학 심화반",
          subject: "심화반",
          classType: "regular",
          teacherId: teacher2.id,
          centerId: mokdongCenter.id,
          classroom: "101호",
          days: ["mon", "wed"],
          startTime: "15:00",
          endTime: "17:00",
          color: "#1E3A5F",
        }).returning();
        mokClasses.push(mokMathClass);
      }

      // Enroll students
      const dmcStudents = students.slice(0, Math.min(3, students.length));
      for (const student of dmcStudents) {
        await db.insert(enrollments).values({ studentId: student.id, classId: mathClass.id }).onConflictDoNothing();
      }

      // Create homework
      await db.insert(homework).values({
        classId: mathClass.id,
        title: "교과서 32~35페이지 풀어오세요",
        dueDate: new Date().toISOString().split("T")[0],
      });

      await db.insert(homework).values({
        classId: englishClass.id,
        title: "단어 암기 Day 5 테스트 준비하세요",
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      });

      res.json({ 
        status: "success", 
        message: "Missing data seeded",
        dmcCenterId: dmcCenter.id,
        mokdongCenterId: mokdongCenter.id,
        classesCreated: 3 + mokClasses.length
      });
    } catch (error: any) {
      console.error("Seed missing data error:", error);
      res.status(500).json({ status: "error", message: error?.message, stack: error?.stack });
    }
  });
  
  // Register Object Storage routes for persistent file storage
  registerObjectStorageRoutes(app);
  
  // Serve uploaded files (legacy - for backward compatibility)
  app.use("/uploads", (req, res, next) => {
    const filePath = path.join(uploadDir, req.path);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: "File not found" });
    }
  });

  // File upload endpoint - uploads to Cloudflare R2 with PNG conversion and resizing for logos
  app.post("/api/upload", logoUpload.single("file"), async (req, res) => {
    try {
      console.log(`[Upload] Request received - file: ${req.file?.originalname}, folder: ${req.body?.folder}`);
      
      if (!req.file) {
        console.error("[Upload] No file in request");
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const folder = (req.body.folder as string) || "logos";
      const isLogoUpload = folder.includes('logo') || folder.includes('icon') || folder.includes('favicon') || folder === 'centers';
      
      // Process logo images - convert to PNG and resize to 512px max for iOS/PWA compatibility
      let fileBuffer = req.file.buffer;
      let contentType = req.file.mimetype || "image/jpeg";
      
      if (isLogoUpload && !req.file.originalname.endsWith('.ico') && !req.file.originalname.endsWith('.svg')) {
        try {
          const processed = await processLogoImage(req.file.buffer, 512);
          fileBuffer = processed.buffer;
          contentType = processed.contentType;
          console.log(`[Upload] Processed logo: ${req.file.originalname} -> PNG ${fileBuffer.length} bytes`);
        } catch (processError) {
          console.error('[Upload] Logo processing failed, using original:', processError);
        }
      }
      
      // Check if R2 is configured
      const r2Configured = isR2Configured();
      console.log(`[Upload] R2 configured: ${r2Configured}`);
      
      if (!r2Configured) {
        // Fallback to local storage if R2 is not configured
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = isLogoUpload ? '.png' : path.extname(req.file.originalname);
        const filename = uniqueSuffix + ext;
        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, fileBuffer);
        console.log(`[Upload] Saved to local: ${filename}`);
        return res.json({ url: `/uploads/${filename}` });
      }
      
      // Upload to R2 with unique timestamp-based filename (always PNG for logos)
      const timestamp = Date.now();
      const ext = isLogoUpload ? '.png' : path.extname(req.file.originalname).toLowerCase();
      const objectKey = `${folder}/${timestamp}-${Math.round(Math.random() * 1e6)}${ext}`;
      
      console.log(`[Upload] Uploading to R2: ${objectKey}`);
      const publicUrl = await uploadBuffer(fileBuffer, objectKey, contentType);
      console.log(`[Upload] Success - publicUrl: ${publicUrl}`);
      res.json({ url: publicUrl });
    } catch (error: any) {
      console.error("[Upload] Failed:", error?.message || error);
      res.status(500).json({ error: `Upload failed: ${error?.message || 'Unknown error'}` });
    }
  });

  // Auth
  app.post("/api/auth/login", async (req, res) => {
    console.log("[LOGIN] Login attempt received");
    try {
      const { username, password } = req.body;
      console.log(`[LOGIN] Username: ${username}`);
      const user = await storage.getUserByUsername(username);
      console.log(`[LOGIN] User found: ${!!user}`);
      
      if (!user || user.password !== password) {
        console.log("[LOGIN] Invalid credentials");
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const centers = await storage.getUserCenters(user.id);
      console.log(`[LOGIN] Success, centers: ${centers.length}`);
      res.json({ user, centers });
    } catch (error: any) {
      console.error("[LOGIN] Error:", error?.message || error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Users - Excel export
  app.get("/api/users/export-excel", async (req, res) => {
    try {
      const centerId = req.query.centerId as string | undefined;
      const accountType = req.query.accountType as string || "student";
      
      if (!centerId) {
        return res.status(400).json({ error: "센터 ID가 필요합니다" });
      }
      
      const allUsers = await storage.getUsers(centerId);
      
      let filteredUsers = allUsers;
      if (accountType === "student") {
        filteredUsers = allUsers.filter(u => u.role === 1);
      } else if (accountType === "parent") {
        filteredUsers = allUsers.filter(u => u.role === 0);
      } else if (accountType === "teacher") {
        filteredUsers = allUsers.filter(u => u.role === 2 || u.role === 3);
      }
      
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      
      const data = filteredUsers.map(user => ({
        "이름": user.name,
        "학생 핸드폰번호(아이디)": user.username,
        "학부모1 전화번호": (user as any).motherPhone || "",
        "학부모2 전화번호(선택)": (user as any).fatherPhone || "",
        "학교": user.school || "",
        "학년": user.grade || "",
      }));
      
      const ws = XLSX.utils.json_to_sheet(data);
      
      const colWidths = [
        { wch: 12 },
        { wch: 20 },
        { wch: 18 },
        { wch: 20 },
        { wch: 15 },
        { wch: 8 },
      ];
      ws["!cols"] = colWidths;
      
      XLSX.utils.book_append_sheet(wb, ws, "사용자목록");
      
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      
      const typeLabel = accountType === "student" ? "학생" : accountType === "parent" ? "학부모" : "선생님";
      const filename = encodeURIComponent(`${typeLabel}목록_${new Date().toISOString().split("T")[0]}.xlsx`);
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${filename}`);
      res.send(buffer);
    } catch (error) {
      console.error("Excel export error:", error);
      res.status(500).json({ error: "엑셀 파일 생성에 실패했습니다" });
    }
  });

  // Users
  app.get("/api/users/:id/centers", async (req, res) => {
    try {
      const centers = await storage.getUserCenters(req.params.id);
      res.json(centers);
    } catch (error) {
      res.status(500).json({ error: "Failed to get centers" });
    }
  });

  app.get("/api/users", async (req, res) => {
    try {
      const rawCenterId = req.query.centerId as string | undefined;
      // Handle "undefined" and "null" strings as no filter
      const centerId = (rawCenterId && rawCenterId !== "undefined" && rawCenterId !== "null") 
        ? rawCenterId 
        : undefined;
      const includeWithdrawn = req.query.includeWithdrawn === "true";
      const users = await storage.getUsers(centerId, includeWithdrawn);
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const { centerId, centerIds, attendancePin, ...userData } = req.body;
      
      // Normalize phone numbers (remove all non-digit characters)
      const normalizePhone = (phone: string | null | undefined) => 
        phone ? phone.replace(/\D/g, "") : null;
      
      const normalizedPhone = normalizePhone(userData.phone);
      const normalizedUsername = normalizePhone(userData.username) || userData.username;
      
      // Efficient DB query instead of loading all users into memory
      const existingUser = await storage.checkUserExists(normalizedPhone, normalizedUsername);
      
      if (existingUser) {
        return res.status(400).json({ error: "이미 등록된 전화번호입니다" });
      }
      
      // Store normalized phone numbers
      const normalizedUserData = {
        ...userData,
        phone: normalizedPhone,
        username: normalizedPhone || userData.username,
        motherPhone: normalizePhone(userData.motherPhone),
        fatherPhone: normalizePhone(userData.fatherPhone),
      };
      
      const user = await storage.createUser(normalizedUserData);
      
      // Support both single centerId and multiple centerIds
      const centersToAdd = centerIds || (centerId ? [centerId] : []);
      for (const cId of centersToAdd) {
        await storage.addUserToCenter({ userId: user.id, centerId: cId });
      }
      
      // Create attendance PIN for students
      // Use loose equality to guard against string "1" from form payloads
      const isStudentRole = Number(userData.role) === 1;
      console.log(`[PIN-AUTO] POST /api/users userId=${user.id} role=${userData.role}(student=${isStudentRole}) centersToAdd=${JSON.stringify(centersToAdd)} attendancePinInput=${attendancePin ?? "null"} phone=${userData.phone ?? "null"}`);
      if (isStudentRole && centersToAdd.length > 0) {
        const primaryCenterId = centersToAdd[0];
        const existingPins = await storage.getAttendancePins(primaryCenterId);
        // Only active PINs occupy a slot; deactivated PINs can be re-used
        const usedPins = existingPins.filter((p: any) => p.isActive !== false).map((p: any) => p.pin);
        console.log(`[PIN-AUTO] center=${primaryCenterId} existingPins=${existingPins.length} activePins=${usedPins.length}`);
        
        let pin = attendancePin;
        
        // If user provided a PIN, validate it's not already taken
        if (pin && usedPins.includes(pin)) {
          console.log(`[PIN-AUTO] manual PIN ${pin} already in use → reject + delete user ${user.id}`);
          // Delete the user we just created since PIN is invalid
          await storage.deleteUser(user.id);
          return res.status(400).json({ error: "이미 사용 중인 출결번호입니다" });
        }
        
        // If no PIN provided, auto-generate from phone number
        if (!pin && userData.phone) {
          pin = generatePinFromPhone(userData.phone, usedPins);
          console.log(`[PIN-AUTO] auto-generate from phone=${userData.phone} → pin=${pin || "(empty - collision or short phone)"}`);
        }
        
        if (pin) {
          try {
            await storage.createAttendancePin({ studentId: user.id, centerId: primaryCenterId, pin });
            console.log(`[PIN-AUTO] created PIN ${pin} for student ${user.id} in center ${primaryCenterId}`);
          } catch (pinErr: any) {
            console.error(`[PIN-AUTO] FAILED to create PIN for student ${user.id}:`, pinErr?.message || pinErr);
          }
        } else {
          console.log(`[PIN-AUTO] no PIN created (no input, no phone, or collision) — student ${user.id} has NO attendance PIN`);
        }
      } else if (isStudentRole) {
        console.log(`[PIN-AUTO] SKIP: student role but centersToAdd is empty — student ${user.id} not linked to any center`);
      }
      
      // Create teacher check-in settings if provided (for teacher roles)
      const teacherCheckInSettings = req.body.teacherCheckInSettings;
      if (teacherCheckInSettings && Array.isArray(teacherCheckInSettings) && (userData.role === 2 || userData.role === 3)) {
        for (const setting of teacherCheckInSettings) {
          const { centerId, checkInCode, smsRecipient1, smsRecipient2 } = setting;
          if (centerId && checkInCode) {
            // Validate check-in code uniqueness (against student PINs and other teacher codes)
            const existingPins = await storage.getAttendancePins(centerId);
            if (existingPins.some((p: any) => p.pin === checkInCode)) {
              await storage.deleteUser(user.id);
              return res.status(400).json({ error: `출근코드 ${checkInCode}가 학생 출결번호와 중복됩니다` });
            }
            
            const existingTeacherSettings = await storage.getAllTeacherCheckInSettings(centerId);
            if (existingTeacherSettings.some((s: any) => s.checkInCode === checkInCode)) {
              await storage.deleteUser(user.id);
              return res.status(400).json({ error: `출근코드 ${checkInCode}가 다른 선생님과 중복됩니다` });
            }
            
            await storage.createTeacherCheckInSettings({
              teacherId: user.id,
              centerId,
              checkInCode,
              smsRecipient1: smsRecipient1 || null,
              smsRecipient2: smsRecipient2 || null,
              isActive: true,
            });
          }
        }
      }
      
      // Create teacher salary settings if provided (for regular/part-time teachers)
      const salarySettings = req.body.salarySettings;
      if (salarySettings && (userData.role === 2 || userData.role === 3) && centersToAdd.length > 0) {
        const primaryCenterId = centersToAdd[0];
        await storage.createTeacherSalarySettings({
          teacherId: user.id,
          centerId: primaryCenterId,
          baseSalary: salarySettings.baseSalary ?? 0,
          classBasePay: 0, // legacy field
          classBasePayMiddle: salarySettings.classBasePayMiddle ?? 0,
          classBasePayHigh: salarySettings.classBasePayHigh ?? 0,
          studentThreshold: 0, // legacy field
          studentThresholdMiddle: salarySettings.studentThresholdMiddle ?? 0,
          studentThresholdHigh: salarySettings.studentThresholdHigh ?? 0,
          perStudentBonus: 0, // legacy field
          perStudentBonusMiddle: salarySettings.perStudentBonusMiddle ?? 0,
          perStudentBonusHigh: salarySettings.perStudentBonusHigh ?? 0,
        });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const { centerIds, attendancePin, teacherCheckInSettings: teacherCheckInSettingsData, classRates: classRatesData, classRateMode, actorId: extractedActorId, ...userData } = req.body;
      const userId = req.params.id;
      console.log("[PATCH-USER] userId:", userId, "employmentType:", userData.employmentType, "wageType:", userData.wageType, "hourlyRate:", userData.hourlyRate, "classRateMode:", classRateMode, "classRatesCount:", classRatesData?.length);

      const wageFields = ["hourlyRate", "dailyRate", "wageType", "fixedWorkStart", "fixedWorkEnd", "fixedWorkDays", "employmentType"];
      const hasWageFields = wageFields.some(f => userData[f] !== undefined);
      if (hasWageFields) {
        const actorId = extractedActorId;
        if (actorId) {
          const actor = await storage.getUser(actorId);
          if (!actor || (actor.role !== 4 && actor.role !== 3)) {
            return res.status(403).json({ error: "급여 설정은 관리자 또는 원장만 변경할 수 있습니다" });
          }
        }
        if (userData.wageType && !["hourly", "monthly"].includes(userData.wageType)) {
          return res.status(400).json({ error: "급여 유형은 hourly, monthly만 가능합니다" });
        }
        if (userData.hourlyRate !== undefined && userData.hourlyRate < 0) {
          return res.status(400).json({ error: "시급은 0 이상이어야 합니다" });
        }
        if (userData.fixedWorkStart && userData.fixedWorkEnd) {
          const [sh, sm] = userData.fixedWorkStart.split(":").map(Number);
          const [eh, em] = userData.fixedWorkEnd.split(":").map(Number);
          if (eh * 60 + em <= sh * 60 + sm) {
            return res.status(400).json({ error: "근무 종료 시간은 시작 시간보다 늦어야 합니다" });
          }
        }
      }
      
      // Update basic user info
      const updatedUser = await storage.updateUser(userId, userData);
      
      // Update center associations if provided
      if (centerIds && Array.isArray(centerIds)) {
        // Remove existing center associations
        const existingCenters = await storage.getUserCenters(userId);
        for (const center of existingCenters) {
          await storage.removeUserFromCenter(userId, center.id);
        }
        // Add new center associations
        for (const centerId of centerIds) {
          await storage.addUserToCenter({ userId, centerId });
        }
      }
      
      // Update attendance PIN if provided (for students)
      // Check the updated user's role, not the request body role
      if (attendancePin && updatedUser.role === 1) {
        const userCenters = await storage.getUserCenters(userId);
        if (userCenters.length > 0) {
          const primaryCenterId = userCenters[0].id;
          // Check if PIN is unique (only active PINs of OTHER students occupy a slot)
          const existingPins = await storage.getAttendancePins(primaryCenterId);
          const usedPins = existingPins
            .filter((p: any) => p.studentId !== userId && p.isActive !== false)
            .map((p: any) => p.pin);
          
          if (usedPins.includes(attendancePin)) {
            return res.status(400).json({ error: "이미 사용 중인 출결번호입니다" });
          }
          
          // Delete existing PIN and create new one
          const existingStudentPin = await storage.getAttendancePinByStudent(userId, primaryCenterId);
          if (existingStudentPin) {
            await storage.deleteAttendancePin(existingStudentPin.id);
          }
          await storage.createAttendancePin({ studentId: userId, centerId: primaryCenterId, pin: attendancePin });
        }
      }
      
      // Update teacher check-in settings if provided (for teachers)
      if (teacherCheckInSettingsData && Array.isArray(teacherCheckInSettingsData) && 
          (updatedUser.role === 2 || updatedUser.role === 3 || updatedUser.role === 4)) {
        for (const setting of teacherCheckInSettingsData) {
          const { centerId, checkInCode, smsRecipient1, smsRecipient2 } = setting;
          
          if (!centerId || !checkInCode) {
            continue;
          }
          
          // Validate checkInCode format
          if (!/^\d{4}$/.test(checkInCode)) {
            return res.status(400).json({ error: "출근코드는 4자리 숫자여야 합니다" });
          }
          
          // Check if code is already used by another teacher
          const existingSettings = await storage.getTeacherCheckInSettingsByCode(centerId, checkInCode);
          if (existingSettings && existingSettings.teacherId !== userId) {
            return res.status(400).json({ error: `출근코드 ${checkInCode}가 다른 선생님과 중복됩니다` });
          }
          
          // Check if this teacher already has settings for this center
          const currentSettings = await storage.getTeacherCheckInSettings(userId, centerId);
          if (currentSettings) {
            // Update existing settings
            await storage.updateTeacherCheckInSettings(currentSettings.id, {
              checkInCode,
              smsRecipient1: smsRecipient1 || null,
              smsRecipient2: smsRecipient2 || null,
            });
          } else {
            // Create new settings
            await storage.createTeacherCheckInSettings({
              teacherId: userId,
              centerId,
              checkInCode,
              smsRecipient1: smsRecipient1 || null,
              smsRecipient2: smsRecipient2 || null,
              isActive: true,
            });
          }
        }
      }
      
      if (classRatesData && Array.isArray(classRatesData) && classRatesData.length > 0) {
        console.log("[PATCH-USER] Processing classRates:", JSON.stringify(classRatesData));
        for (const { classId, hourlyRate } of classRatesData) {
          if (classId) {
            await db.update(classes).set({ hourlyRate: hourlyRate === null || hourlyRate === undefined ? null : parseInt(hourlyRate) }).where(eq(classes.id, classId));
          }
        }
        console.log(`[PATCH-USER] Updated ${classRatesData.length} class hourly rates`);
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      await storage.deleteUser(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // 학생 퇴원 처리 (soft delete): 데이터 보존, 수강 정보 스냅샷 후 제거
  app.post("/api/users/:id/withdraw", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }
      if (user.role !== UserRole.STUDENT) {
        return res.status(400).json({ error: "학생만 퇴원 처리할 수 있습니다" });
      }
      if (user.withdrawnAt) {
        return res.status(400).json({ error: "이미 퇴원 처리된 학생입니다" });
      }
      await storage.withdrawStudent(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to withdraw student:", error);
      res.status(500).json({ error: "퇴원 처리에 실패했습니다" });
    }
  });

  // 퇴원생 재원 복구: 퇴원 상태 해제 + 수강 정보 복원
  app.post("/api/users/:id/reinstate", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }
      if (!user.withdrawnAt) {
        return res.status(400).json({ error: "퇴원 상태가 아닌 학생입니다" });
      }
      const result = await storage.reinstateStudent(req.params.id);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Failed to reinstate student:", error);
      res.status(500).json({ error: "재원 복구에 실패했습니다" });
    }
  });

  // Admin force delete orphan user by phone (for cleanup)
  app.delete("/api/admin/users/by-phone/:phone", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 접근 가능합니다" });
      }

      const phone = req.params.phone.replace(/[^0-9]/g, "");
      const user = await storage.getUserByPhone(phone);
      if (!user) {
        return res.status(404).json({ error: "해당 전화번호의 사용자를 찾을 수 없습니다" });
      }

      await storage.deleteUser(user.id);
      res.json({ success: true, deletedUser: { id: user.id, name: user.name, phone: user.phone } });
    } catch (error) {
      console.error("Error deleting user by phone:", error);
      res.status(500).json({ error: "사용자 삭제에 실패했습니다" });
    }
  });

  // Get children of a parent account
  app.get("/api/parents/:parentId/children", async (req, res) => {
    try {
      const parentId = req.params.parentId;
      const actorId = req.query.actorId as string;
      
      // Verify actor has permission (must be the parent themselves or admin/principal/teacher)
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      
      const actor = await storage.getUser(actorId);
      if (!actor) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }
      
      // Only the parent themselves or staff can access
      if (actor.id !== parentId && actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }
      
      const parent = await storage.getUser(parentId);
      if (!parent || (parent.accountType !== "parent" && parent.role !== UserRole.PARENT)) {
        return res.status(404).json({ error: "학부모 계정을 찾을 수 없습니다" });
      }
      
      // Get all students linked to this parent
      const allUsers = await storage.getUsers();
      const children = allUsers.filter(u => u.parentId === parentId && u.role === UserRole.STUDENT);
      
      // Get enrollments and password status for each child
      const allClasses = await storage.getClasses();
      
      const childDataList = await Promise.all(children.map(async (child) => {
        const childEnrollments = await storage.getStudentEnrollments(child.id);
        const enrollmentsWithClass = childEnrollments.map(e => ({
          ...e,
          class: allClasses.find(c => c.id === e.classId)
        }));
        const passwordRecord = await storage.getTuitionAccessPassword(child.id);
        const hasPassword = !!passwordRecord;
        
        return {
          child,
          enrollments: enrollmentsWithClass,
          hasPassword
        };
      }));
      
      res.json(childDataList);
    } catch (error) {
      console.error("Failed to get parent's children:", error);
      res.status(500).json({ error: "자녀 목록을 불러오는데 실패했습니다" });
    }
  });
  
  // Add or link a child to a parent account
  // If studentId is provided: link existing student
  // If name/childData is provided: create new child
  app.post("/api/parents/:parentId/children", async (req, res) => {
    try {
      const parentId = req.params.parentId;
      const { actorId, studentId, centerId, ...childData } = req.body;
      
      // Verify actor has permission
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }
      
      const parent = await storage.getUser(parentId);
      if (!parent || (parent.accountType !== "parent" && parent.role !== UserRole.PARENT)) {
        return res.status(404).json({ error: "학부모 계정을 찾을 수 없습니다" });
      }
      
      // Case 1: Link existing student
      if (studentId) {
        const student = await storage.getUser(studentId);
        if (!student || student.role !== UserRole.STUDENT) {
          return res.status(404).json({ error: "학생을 찾을 수 없습니다" });
        }
        
        if (student.parentId) {
          return res.status(400).json({ error: "이미 다른 학부모와 연결되어 있습니다" });
        }
        
        // Link student to parent
        await storage.updateUser(studentId, { parentId });
        
        return res.json({ success: true });
      }
      
      // Case 2: Create new child (no phone required)
      if (childData.name) {
        // 전화번호가 없으면 자동으로 username 생성 (학부모ID 기반 + 랜덤)
        const autoUsername = childData.phone || `child_${parentId.slice(0, 8)}_${Date.now().toString(36)}`;
        
        const child = await storage.createUser({
          ...childData,
          username: autoUsername, // username 필수
          phone: childData.phone || null,
          motherPhone: childData.motherPhone || parent.phone || null, // 학부모 전화번호 저장
          role: UserRole.STUDENT,
          accountType: null, // Child account doesn't have its own account type (managed by parent)
          parentId: parentId,
        });
        
        // Add child to the same center as parent (or specified center)
        if (centerId) {
          await storage.addUserToCenter({ userId: child.id, centerId });
          
          // Generate attendance PIN for the child (only if phone provided)
          if (childData.phone) {
            const existingPins = await storage.getAttendancePins(centerId);
            // Only active PINs occupy a slot; deactivated PINs can be re-used
            const usedPins = existingPins.filter((p: any) => p.isActive !== false).map((p: any) => p.pin);
            const pin = generatePinFromPhone(childData.phone, usedPins);
            if (pin) {
              await storage.createAttendancePin({ studentId: child.id, centerId, pin });
            }
          }
        }
        
        return res.json(child);
      }
      
      return res.status(400).json({ error: "studentId 또는 자녀 정보가 필요합니다" });
    } catch (error) {
      console.error("Failed to add/link child to parent:", error);
      res.status(500).json({ error: "자녀 추가/연결에 실패했습니다" });
    }
  });
  
  // Unlink child from parent (자녀 연결 해제)
  app.delete("/api/parents/:parentId/children/:studentId", async (req, res) => {
    try {
      const { parentId, studentId } = req.params;
      const actorId = req.query.actorId as string;
      
      // Verify actor has permission
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }
      
      const student = await storage.getUser(studentId);
      if (!student || student.parentId !== parentId) {
        return res.status(404).json({ error: "연결된 자녀를 찾을 수 없습니다" });
      }
      
      // Unlink student from parent
      await storage.updateUser(studentId, { parentId: null });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to unlink child from parent:", error);
      res.status(500).json({ error: "연결 해제에 실패했습니다" });
    }
  });

  app.post("/api/users/change-password", async (req, res) => {
    try {
      const { userId, currentPassword, newPassword } = req.body;
      const user = await storage.getUser(userId);
      
      if (!user || user.password !== currentPassword) {
        return res.status(400).json({ error: "Invalid current password" });
      }

      await storage.updateUserPassword(userId, newPassword);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // Admin/Principal password reset - resets to "1234"
  app.post("/api/users/:id/reset-password", async (req, res) => {
    try {
      const { actorId } = req.body;
      const targetUserId = req.params.id;
      
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }
      
      // Verify actor exists and has permission
      const actor = await storage.getUser(actorId);
      if (!actor) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }
      
      // Only admin (4) and principal (3) can reset passwords
      if (actor.role !== 3 && actor.role !== 4) {
        return res.status(403).json({ error: "관리자 또는 원장만 비밀번호를 초기화할 수 있습니다" });
      }
      
      // Check target user exists
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }
      
      // Principal can only reset users with lower role (student, parent)
      // Admin can reset anyone except themselves
      if (actor.role === 3 && targetUser.role >= 3) {
        return res.status(403).json({ error: "원장은 다른 원장이나 관리자의 비밀번호를 초기화할 수 없습니다" });
      }
      
      if (actor.id === targetUserId) {
        return res.status(400).json({ error: "본인의 비밀번호는 설정에서 변경해주세요" });
      }
      
      // Reset password to "1234"
      await storage.updateUserPassword(targetUserId, "1234");
      
      // Also fix username if it has dashes (normalize phone number format)
      if (targetUser.phone && targetUser.username.includes("-")) {
        const normalizedUsername = targetUser.phone.replace(/-/g, "");
        await storage.updateUser(targetUserId, { username: normalizedUsername });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "비밀번호 초기화에 실패했습니다" });
    }
  });

  // Assign homeroom teacher - for admin/principal
  app.patch("/api/users/:studentId/homeroom-teacher", async (req, res) => {
    try {
      const { actorId, teacherId } = req.body;
      const studentId = req.params.studentId;
      
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }
      
      // Verify actor exists and is admin or principal
      const actor = await storage.getUser(actorId);
      if (!actor) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }
      if (actor.role !== 3 && actor.role !== 4) {
        return res.status(403).json({ error: "관리자 또는 원장만 담임 선생님을 지정할 수 있습니다" });
      }
      
      // Verify student exists and is a student
      const student = await storage.getUser(studentId);
      if (!student || student.role !== 1) {
        return res.status(400).json({ error: "학생을 찾을 수 없습니다" });
      }
      
      // If teacherId is provided, verify teacher exists and is a teacher
      if (teacherId) {
        const teacher = await storage.getUser(teacherId);
        if (!teacher || teacher.role !== 2) {
          return res.status(400).json({ error: "선생님을 찾을 수 없습니다" });
        }
      }
      
      const updatedUser = await storage.updateUser(studentId, { homeroomTeacherId: teacherId || null });
      res.json(updatedUser);
    } catch (error) {
      console.error("Assign homeroom teacher error:", error);
      res.status(500).json({ error: "담임 선생님 지정에 실패했습니다" });
    }
  });

  // Claim student as homeroom - for teachers only
  app.post("/api/homeroom/claim", async (req, res) => {
    try {
      const { teacherId, studentId } = req.body;
      
      if (!teacherId || !studentId) {
        return res.status(400).json({ error: "teacherId and studentId are required" });
      }
      
      // Verify teacher exists and is a teacher (role=2)
      const teacher = await storage.getUser(teacherId);
      if (!teacher) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }
      if (teacher.role !== 2) {
        return res.status(403).json({ error: "선생님만 내 학생을 지정할 수 있습니다" });
      }
      
      // Verify student exists and is a student
      const student = await storage.getUser(studentId);
      if (!student || student.role !== 1) {
        return res.status(400).json({ error: "학생을 찾을 수 없습니다" });
      }
      
      // Only allow claiming if student has no homeroom teacher
      if (student.homeroomTeacherId) {
        return res.status(400).json({ error: "이미 담임 선생님이 지정된 학생입니다" });
      }
      
      const updatedUser = await storage.updateUser(studentId, { homeroomTeacherId: teacherId });
      res.json(updatedUser);
    } catch (error) {
      console.error("Claim student error:", error);
      res.status(500).json({ error: "내 학생 지정에 실패했습니다" });
    }
  });

  // Unclaim student - for teachers to remove themselves as homeroom
  app.post("/api/homeroom/unclaim", async (req, res) => {
    try {
      const { teacherId, studentId } = req.body;
      
      if (!teacherId || !studentId) {
        return res.status(400).json({ error: "teacherId and studentId are required" });
      }
      
      // Verify teacher exists and is a teacher
      const teacher = await storage.getUser(teacherId);
      if (!teacher) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }
      if (teacher.role !== 2) {
        return res.status(403).json({ error: "선생님만 해제할 수 있습니다" });
      }
      
      // Verify student exists and has this teacher as homeroom
      const student = await storage.getUser(studentId);
      if (!student || student.role !== 1) {
        return res.status(400).json({ error: "학생을 찾을 수 없습니다" });
      }
      
      // Only the current homeroom teacher can unclaim
      if (student.homeroomTeacherId !== teacherId) {
        return res.status(403).json({ error: "본인이 담임인 학생만 해제할 수 있습니다" });
      }
      
      const updatedUser = await storage.updateUser(studentId, { homeroomTeacherId: null });
      res.json(updatedUser);
    } catch (error) {
      console.error("Unclaim student error:", error);
      res.status(500).json({ error: "내 학생 해제에 실패했습니다" });
    }
  });

  // Promote all students to next grade (Admin/Principal only)
  app.post("/api/users/promote-grades", async (req, res) => {
    try {
      const { actorId } = req.body;
      
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }
      
      const actor = await storage.getUser(actorId);
      if (!actor || (actor.role !== 4 && actor.role !== 3)) {
        return res.status(403).json({ error: "관리자 또는 원장만 학년 진급을 실행할 수 있습니다" });
      }
      
      const gradeMap: Record<string, string> = {
        "초1": "초2",
        "초2": "초3",
        "초3": "초4",
        "초4": "초5",
        "초5": "초6",
        "초6": "중1",
        "중1": "중2",
        "중2": "중3",
        "중3": "고1",
        "고1": "고2",
        "고2": "고3",
        "고3": "고3",
      };
      
      const allUsers = await storage.getUsers();
      const students = allUsers.filter(u => u.role === 1 && u.grade);
      
      let promotedCount = 0;
      for (const student of students) {
        const currentGrade = student.grade;
        const nextGrade = currentGrade ? gradeMap[currentGrade] : null;
        
        if (nextGrade && nextGrade !== currentGrade) {
          await storage.updateUser(student.id, { grade: nextGrade });
          promotedCount++;
        }
      }
      
      res.json({ success: true, promotedCount, message: `${promotedCount}명의 학생이 진급되었습니다` });
    } catch (error) {
      console.error("Promote grades error:", error);
      res.status(500).json({ error: "학년 진급에 실패했습니다" });
    }
  });

  app.post("/api/users/bulk-upload", excelUpload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "파일이 업로드되지 않았습니다" });
      }

      // Dynamic import of XLSX to reduce startup memory
      const XLSX = await import("xlsx");

      const defaultCenterIds = JSON.parse(req.body.centerIds || "[]");
      const ext = path.extname(req.file.originalname).toLowerCase();

      let workbook: any;
      
      // For CSV files, try different encodings
      if (ext === ".csv") {
        const encodings = ["utf-8", "euc-kr", "cp949"];
        let parsed = false;
        
        for (const encoding of encodings) {
          try {
            const decoded = iconv.decode(req.file.buffer, encoding);
            workbook = XLSX.read(decoded, { type: "string" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const testRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);
            
            // Check if Korean columns are correctly parsed
            if (testRows.length > 0) {
              const firstRowKeys = Object.keys(testRows[0]);
              const hasKorean = firstRowKeys.some(k => /[가-힣]/.test(k));
              if (hasKorean) {
                parsed = true;
                break;
              }
            }
          } catch (e) {
            // Try next encoding
          }
        }
        
        if (!parsed) {
          // Fallback to default
          const decoded = iconv.decode(req.file.buffer, "euc-kr");
          workbook = XLSX.read(decoded, { type: "string" });
        }
      } else {
        // For Excel files, XLSX handles encoding automatically
        workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      }

      const sheetName = workbook!.SheetNames[0];
      const worksheet = workbook!.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

      if (rows.length === 0) {
        return res.status(400).json({ error: "엑셀 파일에 데이터가 없습니다" });
      }

      const allCenters = await storage.getCenters();
      const centerNameToId = new Map<string, string>();
      for (const center of allCenters) {
        centerNameToId.set(center.name, center.id);
      }

      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[],
      };

      const parseCell = (value: any): string | null => {
        if (value === undefined || value === null) return null;
        const str = value.toString().trim();
        if (str === "" || str === "-") return null;
        return str;
      };

      const parsePhone = (value: any): string | null => {
        const str = parseCell(value);
        if (!str) return null;
        let digits = str.replace(/[^0-9]/g, "");
        if (!digits) return null;
        // Excel often strips leading 0 from phone numbers like 01012345678 -> 1012345678
        if (digits.length >= 9 && digits.length <= 11 && !digits.startsWith("0")) {
          digits = "0" + digits;
        }
        return digits;
      };

      // Helper to get value by normalized key (trim whitespace from both key and value)
      const getRowValue = (row: Record<string, any>, ...keys: string[]): any => {
        for (const key of keys) {
          // Check exact match first
          if (row[key] !== undefined) return row[key];
          // Check trimmed keys
          for (const rowKey of Object.keys(row)) {
            if (rowKey.trim() === key) return row[rowKey];
          }
        }
        return undefined;
      };

      for (const row of rows) {
        try {
          const name = parseCell(getRowValue(row, "이름", "이름 ", " 이름", "성명", "학생명", "학생이름"));
          const school = parseCell(getRowValue(row, "학교", "학교명", "학교 ", " 학교"));
          const grade = parseCell(getRowValue(row, "학년", "학년 ", " 학년"));
          const motherPhone = parsePhone(getRowValue(row, "학부모1 전화번호", "학부모1전화번호", "어머니 전화번호", "어머니전화번호", "어머니연락처", "엄마연락처", "어머니 연락처"));
          const fatherPhone = parsePhone(getRowValue(row, "학부모2 전화번호(선택)", "학부모2 전화번호", "학부모2전화번호", "아버지 전화번호", "아버지전화번호", "아버지연락처", "아빠연락처", "아버지 연락처"));
          const studentPhone = parsePhone(getRowValue(row, "학생 핸드폰번호(아이디)", "학생 핸드폰번호", "학생핸드폰번호", "학생 전화번호", "학생전화번호", "학생연락처", "전화번호", "연락처", "휴대폰"));
          const centerName = parseCell(getRowValue(row, "센터명", "센터", "지점", "지점명", "센터 "));

          if (!name) {
            // Debug: show what columns were found
            const foundColumns = Object.keys(row).map(k => `"${k}"`).join(", ");
            results.failed++;
            results.errors.push(`이름이 없는 행이 있습니다 (발견된 열: ${foundColumns})`);
            continue;
          }

          // Skip sample data row
          if (name.startsWith("(예시") || name === "홍길동") {
            continue;
          }

          // 학부모 전화번호는 선택사항 (없어도 등록 가능)

          const username = studentPhone || motherPhone || fatherPhone;
          if (!username) {
            results.failed++;
            results.errors.push(`${name}: 전화번호가 없습니다`);
            continue;
          }

          let rowCenterIds: string[] = [];
          if (centerName) {
            const centerId = centerNameToId.get(centerName);
            if (centerId) {
              rowCenterIds = [centerId];
            } else {
              results.failed++;
              results.errors.push(`${name}: 존재하지 않는 센터입니다 (${centerName})`);
              continue;
            }
          } else {
            rowCenterIds = defaultCenterIds;
          }

          if (rowCenterIds.length === 0) {
            results.failed++;
            results.errors.push(`${name}: 센터가 지정되지 않았습니다`);
            continue;
          }

          const existingUser = await storage.getUserByUsername(username);
          if (existingUser) {
            results.failed++;
            results.errors.push(`${name}: 이미 등록된 전화번호입니다 (${username})`);
            continue;
          }

          const user = await storage.createUser({
            username,
            password: "1234",
            name,
            phone: studentPhone || username,
            motherPhone,
            fatherPhone,
            school,
            grade,
            role: UserRole.STUDENT,
          });

          for (const centerId of rowCenterIds) {
            await storage.addUserToCenter({ userId: user.id, centerId });
          }

          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push(`처리 중 오류 발생: ${error.message}`);
        }
      }

      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: `엑셀 파일 처리 실패: ${error.message}` });
    }
  });

  app.post("/api/users/vcf-parse", excelUpload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "파일이 업로드되지 않았습니다" });
      }

      const raw = req.file.buffer.toString("utf-8");
      const vcards = raw.split("BEGIN:VCARD").filter(s => s.trim());
      const contacts: Array<{ name: string; phone: string }> = [];

      for (const vcard of vcards) {
        let name = "";
        let phone = "";

        const lines = vcard.split(/\r?\n/);
        for (const line of lines) {
          if (line.startsWith("FN:") || line.startsWith("FN;")) {
            name = line.replace(/^FN[;:]/, "").replace(/CHARSET=[^:]+:/i, "").trim();
          }
          if (!name && line.startsWith("N:")) {
            const parts = line.substring(2).split(";").map(s => s.trim()).filter(Boolean);
            if (parts.length >= 2) {
              name = parts[1] + parts[0];
            } else if (parts.length === 1) {
              name = parts[0];
            }
          }
          if (line.startsWith("TEL") && !phone) {
            const match = line.match(/:([\d\s\-+()]+)/);
            if (match) {
              let digits = match[1].replace(/[^0-9]/g, "");
              if (digits.startsWith("82") && digits.length >= 10) {
                digits = "0" + digits.substring(2);
              }
              if (digits.length >= 9 && digits.length <= 11 && !digits.startsWith("0")) {
                digits = "0" + digits;
              }
              if (digits.length >= 10) {
                phone = digits;
              }
            }
          }
        }

        if (name && phone) {
          contacts.push({ name, phone });
        }
      }

      res.json({ contacts, total: contacts.length });
    } catch (error: any) {
      res.status(500).json({ error: `VCF 파일 파싱 실패: ${error.message}` });
    }
  });

  app.post("/api/users/vcf-register", async (req, res) => {
    try {
      const { contacts, centerIds } = req.body;
      if (!contacts || !Array.isArray(contacts) || !centerIds || !Array.isArray(centerIds)) {
        return res.status(400).json({ error: "잘못된 요청입니다" });
      }

      const results = { success: 0, failed: 0, errors: [] as string[] };

      for (const contact of contacts) {
        try {
          const { name, phone, role, grade, school } = contact;
          if (!name || !phone) {
            results.failed++;
            results.errors.push(`이름 또는 전화번호가 없습니다`);
            continue;
          }

          const existingUser = await storage.getUserByUsername(phone);
          if (existingUser) {
            results.failed++;
            results.errors.push(`${name}: 이미 등록된 전화번호입니다 (${phone})`);
            continue;
          }

          const userRole = role === "parent" ? UserRole.PARENT : UserRole.STUDENT;
          const user = await storage.createUser({
            username: phone,
            password: "1234",
            name,
            phone,
            school: school || null,
            grade: grade || null,
            role: userRole,
          });

          for (const centerId of centerIds) {
            await storage.addUserToCenter({ userId: user.id, centerId });
          }

          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push(`${contact.name}: ${error.message}`);
        }
      }

      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: `등록 실패: ${error.message}` });
    }
  });

  // Parent bulk upload - creates parent accounts with linked children
  app.post("/api/users/parent-bulk-upload", excelUpload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "파일이 업로드되지 않았습니다" });
      }

      const XLSX = await import("xlsx");

      const defaultCenterIds = JSON.parse(req.body.centerIds || "[]");
      const ext = path.extname(req.file.originalname).toLowerCase();

      let workbook: any;
      
      if (ext === ".csv") {
        const encodings = ["utf-8", "euc-kr", "cp949"];
        let parsed = false;
        
        for (const encoding of encodings) {
          try {
            const decoded = iconv.decode(req.file.buffer, encoding);
            workbook = XLSX.read(decoded, { type: "string" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const testRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);
            
            if (testRows.length > 0) {
              const firstRowKeys = Object.keys(testRows[0]);
              const hasKorean = firstRowKeys.some(k => /[가-힣]/.test(k));
              if (hasKorean) {
                parsed = true;
                break;
              }
            }
          } catch (e) {
            // Try next encoding
          }
        }
        
        if (!parsed) {
          const decoded = iconv.decode(req.file.buffer, "euc-kr");
          workbook = XLSX.read(decoded, { type: "string" });
        }
      } else {
        workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      }

      const sheetName = workbook!.SheetNames[0];
      const worksheet = workbook!.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

      if (rows.length === 0) {
        return res.status(400).json({ error: "엑셀 파일에 데이터가 없습니다" });
      }

      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[],
      };

      const parseCell = (value: any): string | null => {
        if (value === undefined || value === null) return null;
        const str = value.toString().trim();
        if (str === "" || str === "-") return null;
        return str;
      };

      const parsePhone = (value: any): string | null => {
        const str = parseCell(value);
        if (!str) return null;
        let digits = str.replace(/[^0-9]/g, "");
        if (!digits) return null;
        if (digits.length >= 9 && digits.length <= 11 && !digits.startsWith("0")) {
          digits = "0" + digits;
        }
        return digits;
      };

      const getRowValue = (row: Record<string, any>, ...keys: string[]): any => {
        for (const key of keys) {
          if (row[key] !== undefined) return row[key];
          for (const rowKey of Object.keys(row)) {
            if (rowKey.trim() === key) return row[rowKey];
          }
        }
        return undefined;
      };

      for (const row of rows) {
        try {
          const childName = parseCell(getRowValue(row, "원생이름", "이름", "학생이름", "학생명", "자녀이름", "자녀명"));
          const parentPhone = parsePhone(getRowValue(row, "학부모 휴대폰번호", "학부모휴대폰번호", "학부모전화번호", "학부모 전화번호", "휴대폰번호", "전화번호"));
          const school = parseCell(getRowValue(row, "학교", "학교명"));
          const grade = parseCell(getRowValue(row, "학년"));
          const attendancePin = parseCell(getRowValue(row, "출결번호", "출결 번호", "PIN", "핀번호", "핀"));

          if (!childName) {
            const foundColumns = Object.keys(row).map(k => `"${k}"`).join(", ");
            results.failed++;
            results.errors.push(`원생이름이 없는 행이 있습니다 (발견된 열: ${foundColumns})`);
            continue;
          }

          // Skip sample data row
          if (childName.startsWith("(예시") || childName === "홍길동") {
            continue;
          }

          if (!parentPhone) {
            results.failed++;
            results.errors.push(`${childName}: 학부모 휴대폰번호가 필요합니다`);
            continue;
          }

          if (defaultCenterIds.length === 0) {
            results.failed++;
            results.errors.push(`${childName}: 센터가 지정되지 않았습니다`);
            continue;
          }

          // Check if parent account already exists
          let parentUser = await storage.getUserByUsername(parentPhone);
          
          if (parentUser) {
            // Parent account exists - check if it's actually a parent account
            if (parentUser.role !== UserRole.PARENT && parentUser.accountType !== "parent") {
              results.failed++;
              results.errors.push(`${childName}: 해당 전화번호(${parentPhone})가 이미 다른 용도로 등록되어 있습니다`);
              continue;
            }
            
            // Add existing parent to centers if not already added
            for (const centerId of defaultCenterIds) {
              try {
                await storage.addUserToCenter({ userId: parentUser.id, centerId });
              } catch (e: any) {
                // Ignore if already exists
              }
            }
          } else {
            // Create parent account
            parentUser = await storage.createUser({
              username: parentPhone,
              password: "1234",
              name: `${childName} 학부모`,
              phone: parentPhone,
              role: UserRole.PARENT,
              accountType: "parent",
            });

            // Add parent to centers
            for (const centerId of defaultCenterIds) {
              await storage.addUserToCenter({ userId: parentUser.id, centerId });
            }
          }

          // Create child (student) account linked to parent
          // Child username = parent phone + child name + grade (to ensure uniqueness for siblings)
          const gradeStr = grade || "";
          const childUsername = `${parentPhone}_${childName}${gradeStr ? "_" + gradeStr : ""}`;
          
          // Check if this child already exists
          const existingChild = await storage.getUserByUsername(childUsername);
          if (existingChild) {
            results.failed++;
            results.errors.push(`${childName}(${gradeStr}): 이미 등록된 자녀입니다 (${parentPhone})`);
            continue;
          }

          const childUser = await storage.createUser({
            username: childUsername,
            password: "1234",
            name: childName,
            phone: parentPhone,
            school,
            grade,
            role: UserRole.STUDENT,
            accountType: "student",
            parentId: parentUser.id,
          });

          // Add child to centers
          for (const centerId of defaultCenterIds) {
            await storage.addUserToCenter({ userId: childUser.id, centerId });
            
            // Create attendance PIN if provided
            if (attendancePin) {
              try {
                // Reject if another student in this center already holds the same active PIN
                const existingPins = await storage.getAttendancePins(centerId);
                const conflict = existingPins.find((p: any) =>
                  p.studentId !== childUser.id && p.pin === attendancePin && p.isActive !== false
                );
                if (conflict) {
                  results.errors.push(`${childName}: 출결번호 ${attendancePin} 중복 (다른 학생이 사용 중)`);
                } else {
                  // Check if PIN already exists for this student in this center
                  const existingPin = await storage.getAttendancePinByStudent(childUser.id, centerId);
                  if (existingPin) {
                    await storage.updateAttendancePin(existingPin.id, { pin: attendancePin });
                  } else {
                    await storage.createAttendancePin({
                      studentId: childUser.id,
                      centerId,
                      pin: attendancePin,
                    });
                  }
                }
              } catch (pinError: any) {
                // PIN 설정 실패해도 계정 생성은 성공으로 처리
                results.errors.push(`${childName}: 출결번호 설정 실패 - ${pinError.message}`);
              }
            }
          }

          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push(`처리 중 오류 발생: ${error.message}`);
        }
      }

      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: `엑셀 파일 처리 실패: ${error.message}` });
    }
  });

  // Centers
  app.get("/api/centers", async (req, res) => {
    try {
      // Prevent caching to ensure fresh data for attendance pad logos
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      const centers = await storage.getCenters();
      res.json(centers);
    } catch (error) {
      res.status(500).json({ error: "Failed to get centers" });
    }
  });

  app.get("/api/centers/stats", async (req, res) => {
    try {
      const stats = await storage.getCenterStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get center stats" });
    }
  });

  // Public endpoint to get center data (for login page logo, etc.)
  app.get("/api/centers/:id/public", async (req, res) => {
    try {
      const centerId = req.params.id;
      if (!centerId) {
        console.warn("[Center Public] Missing centerId");
        return res.status(400).json({ error: "Invalid center ID" });
      }
      
      // Prevent caching to ensure fresh logo data
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      const centers = await storage.getCenters();
      const center = centers.find(c => c.id === centerId);
      
      if (!center) {
        console.warn(`[Center Public] Center not found: ${centerId}`);
        return res.status(404).json({ error: "Center not found" });
      }
      
      console.log(`[Center Public] Returning center ${center.name} (${centerId}) - loginLogoUrl: ${center.loginLogoUrl ? center.loginLogoUrl.substring(0, 80) + '...' : 'null'}, updatedAt: ${center.updatedAt}`);
      
      // Return only public-safe fields (no sensitive data)
      res.json({
        id: center.id,
        name: center.name,
        loginLogoUrl: center.loginLogoUrl,
        sidebarLogoUrl: center.sidebarLogoUrl,
        attendancePadLogoUrl: center.attendancePadLogoUrl,
        faviconUrl: center.faviconUrl,
        shortcutIconUrl: (center as any).shortcutIconUrl,
        updatedAt: center.updatedAt,
      });
    } catch (error) {
      console.error("[Center Public] Error:", error);
      res.status(500).json({ error: "Failed to get center" });
    }
  });

  app.post("/api/centers", async (req, res) => {
    try {
      const { principalPhone, ...centerData } = req.body;
      const center = await storage.createCenter(centerData);
      
      // If principalPhone is provided, create a principal account for this center
      if (principalPhone) {
        try {
          // Check if user with this phone already exists
          const existingUser = await storage.getUserByPhone(principalPhone);
          if (existingUser) {
            // If exists, add this center to the user
            await storage.addUserToCenter({ userId: existingUser.id, centerId: center.id });
          } else {
            // Create new principal account with phone as username
            const principalUser = await storage.createUser({
              phone: principalPhone,
              username: principalPhone,
              password: "1234",
              name: `${center.name} 원장`,
              role: UserRole.PRINCIPAL,
            });
            // Link user to this center
            await storage.addUserToCenter({ userId: principalUser.id, centerId: center.id });
          }
        } catch (userError) {
          console.error(`[Center Create] Failed to create principal account:`, userError);
          // Don't fail center creation if principal account creation fails
        }
      }
      
      res.json(center);
    } catch (error) {
      res.status(500).json({ error: "Failed to create center" });
    }
  });

  app.patch("/api/centers/:id", async (req, res) => {
    try {
      
      // Get current center to check for logo changes
      const currentCenter = await storage.getCenter(req.params.id);
      if (!currentCenter) {
        return res.status(404).json({ error: "Center not found" });
      }
      
      // Helper function to extract R2 object key from URL (handles various URL formats)
      const extractR2Key = (url: string | null | undefined): string | null => {
        if (!url) return null;
        // Skip local uploads and data URLs
        if (url.startsWith('/uploads/') || url.startsWith('data:')) return null;
        
        try {
          const parsedUrl = new URL(url);
          // Check if it's an R2 URL (r2.dev domain or pub- subdomain)
          if (parsedUrl.hostname.includes('r2.dev') || parsedUrl.hostname.startsWith('pub-')) {
            // Return pathname without leading slash
            return parsedUrl.pathname.substring(1);
          }
        } catch {
          // Not a valid URL, skip
        }
        return null;
      };
      
      // Check each logo field for changes and schedule old R2 objects for deletion (10 days delay)
      // Only schedule deletion if R2 is configured (otherwise there's nothing to delete)
      const logoFields = ['loginLogoUrl', 'sidebarLogoUrl', 'faviconUrl', 'attendancePadLogoUrl', 'shortcutIconUrl'] as const;
      
      if (isR2Configured()) {
        for (const field of logoFields) {
          const oldUrl = (currentCenter as any)[field];
          const newUrl = req.body[field];
          
          // If the field is being updated and the old URL was an R2 URL
          if (field in req.body && oldUrl !== newUrl) {
            const oldKey = extractR2Key(oldUrl);
            if (oldKey) {
              try {
                await storage.scheduleObjectDeletion(oldKey, 'center-logo', req.params.id);
              } catch (scheduleError) {
                console.error(`[Center Update] Failed to schedule ${field} for deletion:`, scheduleError);
                // Continue with update even if scheduling fails
              }
            }
          }
        }
      }
      
      // Always set updatedAt on any update for cache busting
      const updateData = { ...req.body, updatedAt: new Date() };
      const center = await storage.updateCenter(req.params.id, updateData);
      const changedLogoFields = logoFields.filter(f => f in req.body);
      if (changedLogoFields.length > 0) {
        console.log(`[Center Update] Center ${center.name} (${req.params.id}) logo updated - fields: [${changedLogoFields.join(', ')}], new loginLogoUrl: ${(center as any).loginLogoUrl ? String((center as any).loginLogoUrl).substring(0, 80) + '...' : 'null'}, updatedAt: ${center.updatedAt}`);
      }
      res.json(center);
    } catch (error) {
      console.error("[Center Update] Error:", error);
      res.status(500).json({ error: "Failed to update center" });
    }
  });

  app.delete("/api/centers/:id", async (req, res) => {
    try {
      const centerId = req.params.id;
      
      // Get center info to delete logo files
      const center = await storage.getCenter(centerId);
      
      // Helper function to extract R2 object key from URL (handles various URL formats)
      const extractR2Key = (url: string | null | undefined): string | null => {
        if (!url) return null;
        if (url.startsWith('/uploads/') || url.startsWith('data:')) return null;
        
        try {
          const parsedUrl = new URL(url);
          if (parsedUrl.hostname.includes('r2.dev') || parsedUrl.hostname.startsWith('pub-')) {
            return parsedUrl.pathname.substring(1);
          }
        } catch {
          // Not a valid URL, skip
        }
        return null;
      };
      
      // Schedule center logo files for deletion (10 days delay)
      // Only schedule if R2 is configured
      if (center && isR2Configured()) {
        const logoFields = ['loginLogoUrl', 'sidebarLogoUrl', 'faviconUrl', 'attendancePadLogoUrl', 'shortcutIconUrl'] as const;
        for (const field of logoFields) {
          const url = (center as any)[field];
          const key = extractR2Key(url);
          if (key) {
            try {
              await storage.scheduleObjectDeletion(key, 'center-logo', centerId);
            } catch (scheduleError) {
              console.error(`[Center Delete] Failed to schedule ${field} for deletion:`, scheduleError);
            }
          }
        }
        
        // Schedule all R2 storage files for this center for deletion
        try {
          const { listAllObjectsWithPrefix } = await import("./r2-storage");
          const objects = await listAllObjectsWithPrefix(`centers/${centerId}/`);
          for (const objectKey of objects) {
            try {
              await storage.scheduleObjectDeletion(objectKey, 'center-file', centerId);
            } catch (e) {
              console.error(`[Center Delete] Failed to schedule ${objectKey} for deletion:`, e);
            }
          }
        } catch (r2Error) {
          console.error(`[Center Delete] Failed to list R2 storage for center ${centerId}:`, r2Error);
          // Continue with DB deletion - R2 files will remain but won't be tracked
          // This is acceptable since the center data is being deleted anyway
        }
      }
      
      // Delete all DB data for this center
      await storage.deleteCenter(centerId);

      res.json({ success: true });
    } catch (error: any) {
      console.error("[Center Delete] Error:", {
        message: error?.message,
        code: error?.code,
        detail: error?.detail,
      });
      res.status(500).json({ error: "Failed to delete center" });
    }
  });

  // Center Registrations (학원 등록 신청) - 공개 API (로그인 불필요)
  const registrationLogoUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
  }).fields([
    { name: "loginLogo", maxCount: 1 },
    { name: "sidebarLogo", maxCount: 1 },
    { name: "favicon", maxCount: 1 },
    { name: "attendancePadLogo", maxCount: 1 },
    { name: "shortcutIcon", maxCount: 1 },
  ]);
  
  app.post("/api/center-registrations", registrationLogoUpload, async (req, res) => {
    try {
      const { name, businessName, representativeName, businessRegistrationNumber, businessAddress, businessPhone, applicantName, applicantPhone, applicantEmail, tossConsentAgreed } = req.body;
      
      if (!name || !applicantName || !applicantPhone) {
        return res.status(400).json({ error: "필수 정보를 입력해주세요" });
      }
      
      // Upload logos to R2 if provided
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      let loginLogoUrl: string | undefined;
      let sidebarLogoUrl: string | undefined;
      let faviconUrl: string | undefined;
      let attendancePadLogoUrl: string | undefined;
      let shortcutIconUrl: string | undefined;
      
      if (files && isR2Configured()) {
        const tempId = `pending-${Date.now()}`;
        
        if (files.loginLogo?.[0]) {
          const key = `centers/${tempId}/login-logo-${Date.now()}.${files.loginLogo[0].originalname.split('.').pop()}`;
          loginLogoUrl = await uploadBuffer(files.loginLogo[0].buffer, key, files.loginLogo[0].mimetype);
        }
        if (files.sidebarLogo?.[0]) {
          const key = `centers/${tempId}/sidebar-logo-${Date.now()}.${files.sidebarLogo[0].originalname.split('.').pop()}`;
          sidebarLogoUrl = await uploadBuffer(files.sidebarLogo[0].buffer, key, files.sidebarLogo[0].mimetype);
        }
        if (files.favicon?.[0]) {
          const key = `centers/${tempId}/favicon-${Date.now()}.${files.favicon[0].originalname.split('.').pop()}`;
          faviconUrl = await uploadBuffer(files.favicon[0].buffer, key, files.favicon[0].mimetype);
        }
        if (files.attendancePadLogo?.[0]) {
          const key = `centers/${tempId}/attendance-pad-logo-${Date.now()}.${files.attendancePadLogo[0].originalname.split('.').pop()}`;
          attendancePadLogoUrl = await uploadBuffer(files.attendancePadLogo[0].buffer, key, files.attendancePadLogo[0].mimetype);
        }
        if (files.shortcutIcon?.[0]) {
          const key = `centers/${tempId}/shortcut-icon-${Date.now()}.${files.shortcutIcon[0].originalname.split('.').pop()}`;
          shortcutIconUrl = await uploadBuffer(files.shortcutIcon[0].buffer, key, files.shortcutIcon[0].mimetype);
        }
      }

      const registrationData: any = {
        name,
        businessName,
        representativeName,
        businessRegistrationNumber,
        businessAddress,
        businessPhone,
        applicantName,
        applicantPhone,
        applicantEmail,
        loginLogoUrl,
        sidebarLogoUrl,
        faviconUrl,
        attendancePadLogoUrl,
        shortcutIconUrl,
        tossConsentAgreed: tossConsentAgreed === "true",
      };

      const registration = await storage.createCenterRegistration(registrationData);

      res.status(201).json(registration);
    } catch (error: any) {
      console.error("Error creating center registration:", error);
      res.status(500).json({
        error: "학원 등록 신청에 실패했습니다",
        detail: error?.message || String(error),
      });
    }
  });

  // Center Registrations - 관리자 전용 API
  app.get("/api/center-registrations", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      if (!user || user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 접근 가능합니다" });
      }

      const status = req.query.status as string | undefined;
      const registrations = await storage.getCenterRegistrations(status);
      res.json(registrations);
    } catch (error) {
      console.error("Error getting center registrations:", error);
      res.status(500).json({ error: "학원 등록 신청 목록 조회에 실패했습니다" });
    }
  });

  // Get pending registrations count (Admin only)
  app.get("/api/center-registrations-pending-count", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      if (!user || user.role !== UserRole.ADMIN) {
        return res.json({ count: 0 });
      }

      const registrations = await storage.getCenterRegistrations("pending");
      res.json({ count: registrations.length });
    } catch (error) {
      console.error("Error getting pending registrations count:", error);
      res.json({ count: 0 });
    }
  });

  app.get("/api/center-registrations/:id", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      if (!user || user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 접근 가능합니다" });
      }

      const registration = await storage.getCenterRegistration(req.params.id);
      if (!registration) {
        return res.status(404).json({ error: "신청을 찾을 수 없습니다" });
      }
      res.json(registration);
    } catch (error) {
      console.error("Error getting center registration:", error);
      res.status(500).json({ error: "학원 등록 신청 조회에 실패했습니다" });
    }
  });

  // Check if principal already exists for a registration
  app.get("/api/center-registrations/:id/check-existing-principal", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      if (!user || user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 접근 가능합니다" });
      }

      const registration = await storage.getCenterRegistration(req.params.id);
      if (!registration) {
        return res.status(404).json({ error: "신청을 찾을 수 없습니다" });
      }

      // Check if user with this phone already exists.
      // Use checkUserExists which looks up by BOTH phone and username so this
      // stays consistent with approveCenterRegistration's lookup. Otherwise
      // the UI may show "no existing principal" but approval still fails on
      // username UNIQUE constraint.
      const existingUser = await storage.checkUserExists(
        registration.applicantPhone,
        registration.applicantPhone,
      );
      
      if (existingUser) {
        // Get existing user's centers
        const userCentersList = await storage.getUserCenters(existingUser.id);
        const centerNames = userCentersList.map(c => c.name).join(", ");
        
        res.json({ 
          exists: true, 
          existingUser: {
            id: existingUser.id,
            name: existingUser.name,
            phone: existingUser.phone,
          },
          existingCenters: centerNames,
          centerCount: userCentersList.length
        });
      } else {
        res.json({ exists: false });
      }
    } catch (error: any) {
      console.error("[CheckExistingPrincipal] Error:", error.message);
      res.status(500).json({ error: error.message || "확인에 실패했습니다" });
    }
  });

  app.get("/api/system-settings/:key", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      console.log(`[SYSTEM-SETTINGS] GET key=${req.params.key} actorId=${actorId}`);
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const user = await storage.getUser(actorId);
      console.log(`[SYSTEM-SETTINGS] GET user found=${!!user} role=${user?.role}`);
      if (!user || user.role < UserRole.ADMIN) return res.status(403).json({ error: "관리자만 접근 가능합니다" });
      const value = await storage.getSystemSetting(req.params.key);
      console.log(`[SYSTEM-SETTINGS] GET key=${req.params.key} value=${value ? `found(${value.length}chars)` : "null"}`);
      res.json({ key: req.params.key, value });
    } catch (error: any) {
      console.error(`[SYSTEM-SETTINGS] GET error:`, error?.message, error?.stack);
      res.status(500).json({ error: "설정 조회에 실패했습니다" });
    }
  });

  app.put("/api/system-settings/:key", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      console.log(`[SYSTEM-SETTINGS] PUT key=${req.params.key} actorId=${actorId} bodyType=${typeof req.body} hasValue=${req.body?.value !== undefined}`);
      if (!actorId) {
        console.log(`[SYSTEM-SETTINGS] PUT rejected: no actorId`);
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      console.log(`[SYSTEM-SETTINGS] PUT user found=${!!user} role=${user?.role}`);
      if (!user || user.role < UserRole.ADMIN) {
        console.log(`[SYSTEM-SETTINGS] PUT rejected: insufficient role (${user?.role})`);
        return res.status(403).json({ error: "관리자만 접근 가능합니다" });
      }
      const { value } = req.body;
      console.log(`[SYSTEM-SETTINGS] PUT value type=${typeof value} length=${typeof value === "string" ? value.length : "N/A"}`);
      if (typeof value !== "string") {
        console.log(`[SYSTEM-SETTINGS] PUT rejected: value is not string, body=`, JSON.stringify(req.body).substring(0, 200));
        return res.status(400).json({ error: "value는 문자열이어야 합니다" });
      }
      await storage.setSystemSetting(req.params.key, value);
      console.log(`[SYSTEM-SETTINGS] PUT success: key=${req.params.key} valueLen=${value.length}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error(`[SYSTEM-SETTINGS] PUT error:`, error?.message, error?.stack);
      res.status(500).json({ error: "설정 저장에 실패했습니다", detail: error?.message });
    }
  });

  app.post("/api/center-registrations/:id/approve", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      if (!user || user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 접근 가능합니다" });
      }

      const linkExisting = req.query.linkExisting === "true";
      const { center, principalUser } = await storage.approveCenterRegistration(req.params.id, user.id, linkExisting);
      
      // SMS is now sent from the client side with customizable message
      // No automatic SMS here - client handles SMS sending via /api/sms/send endpoint
      
      res.json({ 
        success: true, 
        center, 
        principalUser: { 
          id: principalUser.id, 
          username: principalUser.username, 
          name: principalUser.name 
        } 
      });
    } catch (error: any) {
      console.error("[CenterApproval] Error:", error.message, error.stack);
      res.status(500).json({ error: error.message || "학원 등록 승인에 실패했습니다" });
    }
  });

  app.post("/api/center-registrations/:id/reject", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      if (!user || user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 접근 가능합니다" });
      }

      const { rejectReason } = req.body;
      if (!rejectReason) {
        return res.status(400).json({ error: "거절 사유를 입력해주세요" });
      }

      const registration = await storage.rejectCenterRegistration(req.params.id, user.id, rejectReason);
      res.json(registration);
    } catch (error: any) {
      console.error("Error rejecting center registration:", error);
      res.status(500).json({ error: error.message || "학원 등록 거절에 실패했습니다" });
    }
  });

  app.get("/api/centers/:id/students", async (req, res) => {
    try {
      // Validate center exists
      const center = await storage.getCenter(req.params.id);
      if (!center) {
        return res.json([]); // Return empty array for invalid center
      }
      // Get regular students (role=STUDENT, accountType=student)
      const students = await storage.getCenterUsers(req.params.id, UserRole.STUDENT);
      
      // Also get parent accounts (role=PARENT, accountType=parent) for contact purposes
      // Parent accounts store child info (name, grade, school, motherPhone, fatherPhone)
      const allCenterUsers = await storage.getCenterUsers(req.params.id);
      const parentAccounts = allCenterUsers.filter(u => 
        u.role === UserRole.PARENT && u.accountType === "parent"
      );
      
      // Combine both for the students list (parent accounts also have child contact info)
      const combined = [...students, ...parentAccounts];
      res.json(combined);
    } catch (error) {
      console.error("[GET students] Error:", error);
      res.status(500).json({ error: "Failed to get students" });
    }
  });

  app.get("/api/centers/:id/teachers", async (req, res) => {
    try {
      // Validate center exists
      const center = await storage.getCenter(req.params.id);
      if (!center) {
        return res.json([]); // Return empty array for invalid center
      }
      // Include both teachers and principals as instructors
      const allUsers = await storage.getCenterUsers(req.params.id);
      const instructors = allUsers.filter(u => u.role === UserRole.TEACHER || u.role === UserRole.PRINCIPAL);
      res.json(instructors);
    } catch (error) {
      console.error("[GET teachers] Error:", error);
      res.status(500).json({ error: "Failed to get teachers" });
    }
  });

  // Get all teachers who have classes in this center (regardless of userCenters table)
  app.get("/api/centers/:id/class-teachers", async (req, res) => {
    try {
      const center = await storage.getCenter(req.params.id);
      if (!center) {
        return res.json([]);
      }
      // Get all classes for this center
      const centerClasses = await storage.getClasses(req.params.id);
      // Get unique teacherIds from classes
      const teacherIdSet = new Set<string>();
      centerClasses.forEach(c => { if (c.teacherId) teacherIdSet.add(c.teacherId); });
      const teacherIds = Array.from(teacherIdSet);
      // Fetch all teachers by ID
      const teachers = await Promise.all(teacherIds.map(id => storage.getUser(id)));
      res.json(teachers.filter(Boolean));
    } catch (error) {
      console.error("[GET class-teachers] Error:", error);
      res.status(500).json({ error: "Failed to get class teachers" });
    }
  });

  // SOLAPI Diagnostics - Admin only
  app.get("/api/solapi-diagnostics", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const user = await storage.getUser(actorId);
      if (!user || user.role !== UserRole.ADMIN) return res.status(403).json({ error: "관리자만 접근 가능합니다" });

      const centers = await storage.getCenters();
      const allCreds = await storage.getAllSolapiCredentials();
      
      const diagnostics = centers.map(center => {
        const cred = allCreds.find(c => c.centerId === center.id);
        return {
          centerName: center.name,
          centerId: center.id,
          hasCredentials: !!cred,
          senderNumber: cred?.senderNumber ? cred.senderNumber.slice(0, 3) + '****' + cred.senderNumber.slice(-2) : null,
        };
      });

      const orphanCreds = allCreds.filter(c => !centers.find(center => center.id === c.centerId));

      res.json({ 
        diagnostics, 
        orphanCredentials: orphanCreds.map(c => ({ 
          id: c.id,
          centerId: c.centerId, 
          senderNumber: c.senderNumber ? c.senderNumber.slice(0, 3) + '****' + c.senderNumber.slice(-2) : null,
        })),
        centersWithoutCredentials: diagnostics.filter(d => !d.hasCredentials).map(d => ({ centerName: d.centerName, centerId: d.centerId })),
      });
    } catch (error) {
      console.error("Failed to get SOLAPI diagnostics:", error);
      res.status(500).json({ error: "Failed to get diagnostics" });
    }
  });

  // SOLAPI Reassign orphan credential to a center - Admin only
  app.post("/api/solapi-reassign", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const user = await storage.getUser(actorId);
      if (!user || user.role !== UserRole.ADMIN) return res.status(403).json({ error: "관리자만 접근 가능합니다" });

      const { oldCenterId, newCenterId } = req.body;
      if (!oldCenterId || !newCenterId) return res.status(400).json({ error: "oldCenterId and newCenterId required" });

      const center = await storage.getCenter(newCenterId);
      if (!center) return res.status(404).json({ error: "Target center not found" });

      const oldCred = await storage.getSolapiCredentials(oldCenterId);
      if (!oldCred) return res.status(404).json({ error: "No credentials found for old centerId" });

      const existingNew = await storage.getSolapiCredentials(newCenterId);
      if (existingNew) return res.status(409).json({ error: "Target center already has credentials" });

      await storage.upsertSolapiCredentials({
        centerId: newCenterId,
        apiKey: oldCred.apiKey,
        apiSecret: oldCred.apiSecret,
        senderNumber: oldCred.senderNumber,
      });
      await storage.deleteSolapiCredentials(oldCenterId);
      clearCredentialsCache();

      console.log(`[SOLAPI] Reassigned credentials from ${oldCenterId} to ${newCenterId} (${center.name})`);
      res.json({ success: true, centerName: center.name });
    } catch (error) {
      console.error("Failed to reassign SOLAPI credentials:", error);
      res.status(500).json({ error: "Failed to reassign credentials" });
    }
  });

  // SOLAPI Credentials (센터별 SMS 설정)
  app.get("/api/centers/:centerId/solapi", async (req, res) => {
    try {
      const credentials = await storage.getSolapiCredentials(req.params.centerId);
      if (!credentials) {
        return res.json({ hasCredentials: false });
      }
      // Return metadata only, not the actual secrets
      res.json({
        hasCredentials: true,
        senderNumber: credentials.senderNumber,
        updatedAt: credentials.updatedAt,
        // Mask the API key and secret
        apiKeyMasked: credentials.apiKey ? "****" + decrypt(credentials.apiKey).slice(-4) : null,
        apiSecretMasked: "********",
      });
    } catch (error) {
      console.error("Failed to get SOLAPI credentials:", error);
      res.status(500).json({ error: "Failed to get SOLAPI credentials" });
    }
  });

  // Reveal SOLAPI credentials (for Principal only)
  app.get("/api/centers/:centerId/solapi/reveal", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      
      // Verify the user is a principal for this center
      const user = await storage.getUser(actorId);
      if (!user || (user.role !== UserRole.PRINCIPAL && user.role !== UserRole.ADMIN)) {
        return res.status(403).json({ error: "원장 또는 관리자만 접근 가능합니다" });
      }
      
      const credentials = await storage.getSolapiCredentials(req.params.centerId);
      if (!credentials) {
        return res.status(404).json({ error: "저장된 SOLAPI 설정이 없습니다" });
      }
      
      // Return decrypted credentials
      res.json({
        apiKey: decrypt(credentials.apiKey),
        apiSecret: decrypt(credentials.apiSecret),
        senderNumber: credentials.senderNumber,
      });
    } catch (error) {
      console.error("Failed to reveal SOLAPI credentials:", error);
      res.status(500).json({ error: "Failed to reveal SOLAPI credentials" });
    }
  });

  app.put("/api/centers/:centerId/solapi", async (req, res) => {
    try {
      const { apiKey, apiSecret, senderNumber } = req.body;
      if (!apiKey || !apiSecret || !senderNumber) {
        return res.status(400).json({ error: "API Key, API Secret, and Sender Number are required" });
      }
      
      // Encrypt sensitive data before storing
      const encryptedApiKey = encrypt(apiKey);
      const encryptedApiSecret = encrypt(apiSecret);
      
      const credentials = await storage.upsertSolapiCredentials({
        centerId: req.params.centerId,
        apiKey: encryptedApiKey,
        apiSecret: encryptedApiSecret,
        senderNumber,
      });
      
      // Clear the SOLAPI credentials cache for this center
      const center = await storage.getCenter(req.params.centerId);
      if (center) {
        clearCredentialsCache(center.name);
      }
      // Also clear all caches to be safe
      clearCredentialsCache();
      
      res.json({
        success: true,
        senderNumber: credentials.senderNumber,
        updatedAt: credentials.updatedAt,
      });
    } catch (error) {
      console.error("Failed to save SOLAPI credentials:", error);
      res.status(500).json({ error: "Failed to save SOLAPI credentials" });
    }
  });

  app.delete("/api/centers/:centerId/solapi", async (req, res) => {
    try {
      // Clear cache before deleting
      const center = await storage.getCenter(req.params.centerId);
      if (center) {
        clearCredentialsCache(center.name);
      }
      clearCredentialsCache();
      
      await storage.deleteSolapiCredentials(req.params.centerId);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete SOLAPI credentials:", error);
      res.status(500).json({ error: "Failed to delete SOLAPI credentials" });
    }
  });

  // System default Toss Payments settings (admin-managed, fallback for centers without per-academy keys)
  const DEFAULT_TOSS_CLIENT_KEY_SETTING = "default_toss_client_key";
  const DEFAULT_TOSS_SECRET_KEY_SETTING = "default_toss_secret_key";

  app.get("/api/admin/default-toss-settings", async (req, res) => {
    try {
      const encryptedClientKey = await storage.getSystemSetting(DEFAULT_TOSS_CLIENT_KEY_SETTING);
      const encryptedSecretKey = await storage.getSystemSetting(DEFAULT_TOSS_SECRET_KEY_SETTING);
      let maskedClientKey: string | null = null;
      let maskedSecretKey: string | null = null;
      if (encryptedClientKey) {
        try {
          const dec = decrypt(encryptedClientKey);
          maskedClientKey = dec.substring(0, 12) + "****" + dec.substring(dec.length - 4);
        } catch { maskedClientKey = "****"; }
      }
      if (encryptedSecretKey) {
        try {
          const dec = decrypt(encryptedSecretKey);
          maskedSecretKey = dec.substring(0, 12) + "****" + dec.substring(dec.length - 4);
        } catch { maskedSecretKey = "****"; }
      }
      res.json({
        configured: !!(encryptedClientKey && encryptedSecretKey),
        hasClientKey: !!encryptedClientKey,
        hasSecretKey: !!encryptedSecretKey,
        maskedClientKey,
        maskedSecretKey,
      });
    } catch (error) {
      console.error("Failed to get default Toss settings:", error);
      res.status(500).json({ error: "기본 토스 설정 조회에 실패했습니다" });
    }
  });

  app.get("/api/admin/default-toss-settings/reveal", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 접근 가능합니다" });
      }
      const encryptedClientKey = await storage.getSystemSetting(DEFAULT_TOSS_CLIENT_KEY_SETTING);
      const encryptedSecretKey = await storage.getSystemSetting(DEFAULT_TOSS_SECRET_KEY_SETTING);
      let clientKey: string | null = null;
      let secretKey: string | null = null;
      if (encryptedClientKey) {
        try { clientKey = decrypt(encryptedClientKey); } catch { clientKey = null; }
      }
      if (encryptedSecretKey) {
        try { secretKey = decrypt(encryptedSecretKey); } catch { secretKey = null; }
      }
      res.json({ clientKey, secretKey });
    } catch (error) {
      console.error("Failed to reveal default Toss settings:", error);
      res.status(500).json({ error: "키 조회에 실패했습니다" });
    }
  });

  app.put("/api/admin/default-toss-settings", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 접근 가능합니다" });
      }
      const { clientKey, secretKey } = req.body;
      if (!clientKey || !secretKey) {
        return res.status(400).json({ error: "클라이언트 키와 시크릿 키가 필요합니다" });
      }
      await storage.setSystemSetting(DEFAULT_TOSS_CLIENT_KEY_SETTING, encrypt(clientKey));
      await storage.setSystemSetting(DEFAULT_TOSS_SECRET_KEY_SETTING, encrypt(secretKey));
      res.json({ success: true, message: "기본 토스페이먼츠 설정이 저장되었습니다" });
    } catch (error) {
      console.error("Failed to save default Toss settings:", error);
      res.status(500).json({ error: "기본 토스페이먼츠 설정 저장에 실패했습니다" });
    }
  });

  app.delete("/api/admin/default-toss-settings", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 접근 가능합니다" });
      }
      await storage.setSystemSetting(DEFAULT_TOSS_CLIENT_KEY_SETTING, "");
      await storage.setSystemSetting(DEFAULT_TOSS_SECRET_KEY_SETTING, "");
      res.json({ success: true, message: "기본 토스페이먼츠 설정이 삭제되었습니다" });
    } catch (error) {
      console.error("Failed to delete default Toss settings:", error);
      res.status(500).json({ error: "기본 토스페이먼츠 설정 삭제에 실패했습니다" });
    }
  });

  // Helper: Get encrypted default Toss keys (returns null if not set)
  async function getDefaultTossKeys(): Promise<{ encryptedClientKey: string | null; encryptedSecretKey: string | null }> {
    const encryptedClientKey = await storage.getSystemSetting(DEFAULT_TOSS_CLIENT_KEY_SETTING);
    const encryptedSecretKey = await storage.getSystemSetting(DEFAULT_TOSS_SECRET_KEY_SETTING);
    return {
      encryptedClientKey: encryptedClientKey || null,
      encryptedSecretKey: encryptedSecretKey || null,
    };
  }

  // 한 안내건의 센터에 맞는 시크릿키로 orderId의 토스 결제 상태를 조회한다.
  // 결제가 없거나(미인증) 조회 실패 시 null. (센터키 → 시스템 기본키 → 환경변수 순)
  async function fetchTossOrderForCenter(
    orderId: string,
    centerId: string | null,
  ): Promise<import("./toss-payments").TossPaymentResponse | null> {
    // 각 키 소스를 독립적으로 시도한다. 한 소스가 실패(키 회전/일시 오류 등)해도
    // 다음 소스로 폴백하도록 per-source try/catch로 감싼다. (센터키 → 시스템 기본키 → 환경변수)
    let lastError: any = null;

    try {
      const center = centerId ? await storage.getCenter(centerId) : null;
      if (center && isTossPaymentsConfiguredForCenter(center.tossClientKey, center.tossSecretKey)) {
        try {
          const r = await getPaymentByOrderIdWithKey(orderId, center.tossSecretKey!);
          if (r) return r;
        } catch (e: any) {
          lastError = e;
          console.error(`[PAYMENT] center key lookup failed for order ${orderId}:`, e?.message || e);
        }
      }
    } catch (e: any) {
      lastError = e;
      console.error(`[PAYMENT] center lookup failed for order ${orderId}:`, e?.message || e);
    }

    try {
      const defaults = await getDefaultTossKeys();
      if (defaults.encryptedSecretKey) {
        try {
          const r = await getPaymentByOrderIdWithKey(orderId, defaults.encryptedSecretKey);
          if (r) return r;
        } catch (e: any) {
          lastError = e;
          console.error(`[PAYMENT] default key lookup failed for order ${orderId}:`, e?.message || e);
        }
      }
    } catch (e: any) {
      lastError = e;
      console.error(`[PAYMENT] default key fetch failed for order ${orderId}:`, e?.message || e);
    }

    if (process.env.TOSS_SECRET_KEY) {
      try {
        const r = await getPaymentByOrderId(orderId);
        if (r) return r;
      } catch (e: any) {
        lastError = e;
        console.error(`[PAYMENT] env key lookup failed for order ${orderId}:`, e?.message || e);
      }
    }

    if (lastError) {
      console.error(`[PAYMENT] fetchTossOrderForCenter exhausted all key sources for order ${orderId}`);
    }
    return null;
  }

  // 토스에서 결제가 DONE 으로 확인된 주문을 우리 DB의 올바른 안내건에 결제완료로 기록한다.
  // /confirm, 웹훅, 주기적 대사(reconcile)에서 공통 사용. 멱등(이미 paid면 그대로 성공).
  async function finalizePaidNotificationByOrder(
    orderId: string,
    paymentKey: string,
    amount: number,
    source: string,
  ): Promise<
    | { ok: true; targetId: string; redirectedFrom?: string; alreadyPaid: boolean }
    | { ok: false; reason: "notfound" | "cancelled" | "amount_mismatch" | "lookup_error" }
  > {
    const notification = await storage.getTuitionNotificationByOrderId(orderId);
    if (!notification) return { ok: false, reason: "notfound" };

    // cancel+재발송 경합 대응: 매칭 안내건이 취소/이미결제면 같은 학생/센터/같은 달/동일 금액의
    // 최신 pending 형제 안내건으로 결제완료를 옮긴다. (원래 /confirm 로직과 동일)
    let targetNotification = notification;
    if (notification.paymentStatus === "cancelled" || notification.paymentStatus === "paid") {
      try {
        const allForStudent = await storage.getTuitionNotificationsByStudent(
          notification.studentId,
          notification.centerId || undefined,
        );
        const kstYearMonth = (d: Date) =>
          new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7);
        const baseMonth = notification.createdAt
          ? kstYearMonth(new Date(notification.createdAt))
          : null;
        const candidate = allForStudent
          .filter(n =>
            n.id !== notification.id &&
            n.paymentStatus === "pending" &&
            n.centerId === notification.centerId &&
            ((n.sentAmount || 0) + (n.textbookTotal || 0)) === amount &&
            n.createdAt &&
            (!baseMonth || kstYearMonth(new Date(n.createdAt)) === baseMonth),
          )
          .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())[0];
        if (candidate) {
          targetNotification = candidate;
        } else if (notification.paymentStatus === "cancelled") {
          return { ok: false, reason: "cancelled" };
        }
      } catch (e) {
        console.error("[PAYMENT] Failed to look up sibling notification:", e);
        return { ok: false, reason: "lookup_error" };
      }
    }

    const expectedAmount = (targetNotification.sentAmount || 0) + (targetNotification.textbookTotal || 0);
    if (amount !== expectedAmount) {
      return { ok: false, reason: "amount_mismatch" };
    }

    if (targetNotification.paymentStatus === "paid") {
      return { ok: true, targetId: targetNotification.id, alreadyPaid: true };
    }

    // 원자적 갱신: 현재 pending 인 경우에만 paid 로 전환(동시 처리/취소 덮어쓰기 방지).
    const updated = await storage.markTuitionNotificationPaidIfPending(targetNotification.id, {
      tossPaymentKey: paymentKey,
      paidAt: new Date(),
      paymentMethod: "online",
    });
    if (!updated) {
      // 경합으로 그 사이 상태가 바뀜. 재조회해 이미 결제완료면 멱등 성공, 아니면 취소 처리.
      const fresh = await storage.getTuitionNotificationById(targetNotification.id);
      if (fresh?.paymentStatus === "paid") {
        return { ok: true, targetId: fresh.id, alreadyPaid: true };
      }
      return { ok: false, reason: "cancelled" };
    }
    if (targetNotification.id !== notification.id) {
      try {
        await storage.updateTuitionNotificationTossOrderId(targetNotification.id, orderId);
        await storage.updateTuitionNotificationTossOrderId(notification.id, "");
      } catch (e) {
        console.error("[PAYMENT] Failed to move tossOrderId between notifications:", e);
      }
    }
    console.log(`[PAYMENT][${source}] Marked notification ${targetNotification.id} paid (order ${orderId})`);
    return {
      ok: true,
      targetId: targetNotification.id,
      redirectedFrom: targetNotification.id !== notification.id ? notification.id : undefined,
      alreadyPaid: false,
    };
  }

  // Toss Payments Settings for Center
  app.get("/api/centers/:centerId/toss-settings", async (req, res) => {
    try {
      const center = await storage.getCenter(req.params.centerId);
      if (!center) {
        return res.status(404).json({ error: "센터를 찾을 수 없습니다" });
      }
      
      const configured = isTossPaymentsConfiguredForCenter(center.tossClientKey, center.tossSecretKey);
      let maskedClientKey: string | null = null;
      let maskedSecretKey: string | null = null;
      if (center.tossClientKey) {
        try {
          const decrypted = decrypt(center.tossClientKey);
          maskedClientKey = decrypted.substring(0, 12) + "****" + decrypted.substring(decrypted.length - 4);
        } catch { maskedClientKey = "****"; }
      }
      if (center.tossSecretKey) {
        try {
          const decrypted = decrypt(center.tossSecretKey);
          maskedSecretKey = decrypted.substring(0, 12) + "****" + decrypted.substring(decrypted.length - 4);
        } catch { maskedSecretKey = "****"; }
      }
      res.json({
        configured,
        hasClientKey: !!center.tossClientKey,
        hasSecretKey: !!center.tossSecretKey,
        maskedClientKey,
        maskedSecretKey,
      });
    } catch (error) {
      console.error("Failed to get Toss settings:", error);
      res.status(500).json({ error: "토스페이먼츠 설정 조회에 실패했습니다" });
    }
  });

  app.get("/api/centers/:centerId/toss-settings/reveal", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId);
      if (!actor || (actor.role !== UserRole.ADMIN && actor.role !== UserRole.PRINCIPAL)) {
        return res.status(403).json({ error: "관리자 또는 원장만 접근 가능합니다" });
      }
      const center = await storage.getCenter(req.params.centerId);
      if (!center) {
        return res.status(404).json({ error: "센터를 찾을 수 없습니다" });
      }
      let clientKey: string | null = null;
      let secretKey: string | null = null;
      if (center.tossClientKey) {
        try { clientKey = decrypt(center.tossClientKey); } catch { clientKey = null; }
      }
      if (center.tossSecretKey) {
        try { secretKey = decrypt(center.tossSecretKey); } catch { secretKey = null; }
      }
      res.json({ clientKey, secretKey });
    } catch (error) {
      console.error("Failed to reveal Toss settings:", error);
      res.status(500).json({ error: "키 조회에 실패했습니다" });
    }
  });

  app.put("/api/centers/:centerId/toss-settings", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      
      const actor = await storage.getUser(actorId);
      if (!actor || (actor.role !== UserRole.ADMIN && actor.role !== UserRole.PRINCIPAL)) {
        return res.status(403).json({ error: "관리자 또는 원장만 접근 가능합니다" });
      }
      
      // Check if actor has access to this center
      if (actor.role === UserRole.PRINCIPAL) {
        const actorCenters = await storage.getUserCenters(actorId);
        if (!actorCenters.some(c => c.id === req.params.centerId)) {
          return res.status(403).json({ error: "이 센터에 대한 권한이 없습니다" });
        }
      }
      
      const { clientKey, secretKey } = req.body;
      
      if (!clientKey || !secretKey) {
        return res.status(400).json({ error: "클라이언트 키와 시크릿 키가 필요합니다" });
      }
      
      // Encrypt keys before storing
      const encryptedClientKey = encrypt(clientKey);
      const encryptedSecretKey = encrypt(secretKey);
      
      await storage.updateCenter(req.params.centerId, {
        tossClientKey: encryptedClientKey,
        tossSecretKey: encryptedSecretKey,
      });
      
      res.json({ success: true, message: "토스페이먼츠 설정이 저장되었습니다" });
    } catch (error) {
      console.error("Failed to save Toss settings:", error);
      res.status(500).json({ error: "토스페이먼츠 설정 저장에 실패했습니다" });
    }
  });

  app.delete("/api/centers/:centerId/toss-settings", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      
      const actor = await storage.getUser(actorId);
      if (!actor || (actor.role !== UserRole.ADMIN && actor.role !== UserRole.PRINCIPAL)) {
        return res.status(403).json({ error: "관리자 또는 원장만 접근 가능합니다" });
      }
      
      // Check if actor has access to this center
      if (actor.role === UserRole.PRINCIPAL) {
        const actorCenters = await storage.getUserCenters(actorId);
        if (!actorCenters.some(c => c.id === req.params.centerId)) {
          return res.status(403).json({ error: "이 센터에 대한 권한이 없습니다" });
        }
      }
      
      await storage.updateCenter(req.params.centerId, {
        tossClientKey: null,
        tossSecretKey: null,
      });
      
      res.json({ success: true, message: "토스페이먼츠 설정이 삭제되었습니다" });
    } catch (error) {
      console.error("Failed to delete Toss settings:", error);
      res.status(500).json({ error: "토스페이먼츠 설정 삭제에 실패했습니다" });
    }
  });

  // Toss Payments Consent (원장 동의 요청)
  app.post("/api/centers/:centerId/toss-consent", async (req, res) => {
    try {
      const actorId = req.body.actorId;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role !== UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "원장만 동의할 수 있습니다" });
      }
      const center = await storage.getCenter(req.params.centerId);
      await storage.updateCenter(req.params.centerId, {
        tossConsentStatus: "pending",
        tossConsentAt: new Date(),
      });

      const allUsers = await storage.getUsers();
      const admins = allUsers.filter(u => u.role === UserRole.ADMIN);
      for (const admin of admins) {
        try {
          await storage.createNotification({
            userId: admin.id,
            type: "toss_consent_request",
            title: "토스페이먼츠 연동 신청",
            message: `${center?.name || "센터"}에서 토스페이먼츠 연동을 신청했습니다. 센터 관리에서 확인해주세요.`,
            relatedId: req.params.centerId,
            relatedType: "center",
          });
        } catch {}
      }

      res.json({ success: true, message: "토스페이먼츠 연동 동의가 요청되었습니다" });
    } catch (error) {
      console.error("Failed to submit toss consent:", error);
      res.status(500).json({ error: "동의 요청에 실패했습니다" });
    }
  });

  // Toss Payments Consent dismiss (다음에 연동)
  app.post("/api/centers/:centerId/toss-consent-dismiss", async (req, res) => {
    try {
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "처리에 실패했습니다" });
    }
  });

  // Admin: Approve/Reject Toss Consent
  app.post("/api/centers/:centerId/toss-consent-review", async (req, res) => {
    try {
      const { actorId, action, sendSms: shouldSendSms } = req.body;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 승인/거절할 수 있습니다" });
      }
      if (action === "approve") {
        await storage.updateCenter(req.params.centerId, {
          tossConsentStatus: "approved",
          tossApprovedAt: new Date(),
        });

        let smsSent = false;
        if (shouldSendSms) {
          try {
            const centerUsers = await storage.getCenterUsers(req.params.centerId, UserRole.PRINCIPAL);
            const smsText = `안녕하세요. 학원 통합관리 어플 이음위더스입니다.\n\n교육비 결제 승인이 완료되었습니다.\n이제 교육비 비대면 결제가 가능합니다!\n\n감사합니다`;
            const { sendSystemSms } = await import("./services/solapi");
            for (const principal of centerUsers) {
              if (principal.phone) {
                const result = await sendSystemSms({ to: principal.phone, text: smsText });
                if (result.success) smsSent = true;
              }
            }
          } catch (smsError) {
            console.error("Failed to send toss approval SMS:", smsError);
          }
        }

        await storage.deleteNotificationsByRelated(req.params.centerId, "toss_consent_request");
        res.json({ success: true, message: "토스페이먼츠 연동이 승인되었습니다", smsSent });
      } else if (action === "reject") {
        await storage.updateCenter(req.params.centerId, {
          tossConsentStatus: "rejected",
          tossApprovedAt: null,
        });
        await storage.deleteNotificationsByRelated(req.params.centerId, "toss_consent_request");
        res.json({ success: true, message: "토스페이먼츠 연동이 거절되었습니다" });
      } else if (action === "revoke") {
        const center = await storage.getCenter(req.params.centerId);
        if (!center || center.tossConsentStatus !== "approved") {
          return res.status(400).json({ error: "승인된 상태의 센터만 해제할 수 있습니다" });
        }
        await storage.updateCenter(req.params.centerId, {
          tossConsentStatus: "none",
          tossApprovedAt: null,
        });
        res.json({ success: true, message: "토스페이먼츠 연동이 해제되었습니다" });
      } else {
        res.status(400).json({ error: "잘못된 요청입니다" });
      }
    } catch (error) {
      console.error("Failed to review toss consent:", error);
      res.status(500).json({ error: "처리에 실패했습니다" });
    }
  });

  // Get centers with pending toss consent (Admin)
  app.get("/api/toss-consent-pending", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 접근 가능합니다" });
      }
      const allCenters = await storage.getCenters();
      const pending = allCenters.filter((c: any) => c.tossConsentStatus === "pending");
      res.json(pending);
    } catch (error) {
      res.status(500).json({ error: "조회에 실패했습니다" });
    }
  });

  // Classes
  app.get("/api/classes", async (req, res) => {
    try {
      const centerId = req.query.centerId as string | undefined;
      const teacherId = req.query.teacherId as string | undefined;
      // Validate center exists if centerId provided (check for non-empty string)
      if (centerId && centerId.trim()) {
        const center = await storage.getCenter(centerId);
        if (!center) {
          return res.json([]); // Return empty array for invalid center
        }
        let classes = await storage.getClasses(centerId);
        if (teacherId && teacherId.trim()) {
          classes = classes.filter((c: any) => c.teacherId === teacherId || isAssistantTeacher(c, teacherId));
        }
        return res.json(classes);
      }
      // If no valid centerId provided, return empty array (require center filter for security)
      res.json([]);
    } catch (error) {
      console.error("[GET classes] Error:", error);
      res.status(500).json({ error: "Failed to get classes" });
    }
  });

  app.post("/api/classes", async (req, res) => {
    try {
      // 부담임 다중 지정: assistantTeacherIds 정규화 + 호환용 assistantTeacherId 동기화
      if (Array.isArray(req.body.assistantTeacherIds)) {
        const cleaned = Array.from(new Set(
          (req.body.assistantTeacherIds as unknown[])
            .filter((v): v is string => typeof v === "string" && v.length > 0 && v !== req.body.teacherId)
        ));
        req.body.assistantTeacherIds = cleaned;
        req.body.assistantTeacherId = cleaned[0] ?? null;
      } else if (req.body.assistantTeacherId) {
        req.body.assistantTeacherIds = req.body.assistantTeacherId === req.body.teacherId ? [] : [req.body.assistantTeacherId];
      }
      if (req.body.assistantTeacherId && req.body.assistantTeacherId === req.body.teacherId) {
        return res.status(400).json({ error: "부담임과 담당 선생님은 같을 수 없습니다" });
      }
      if (req.body.startTime && req.body.endTime && req.body.startTime >= req.body.endTime) {
        return res.status(400).json({ error: "종료 시각이 시작 시각보다 빠르거나 같습니다" });
      }
      if (req.body.schedule) {
        const schedule = typeof req.body.schedule === "string" ? JSON.parse(req.body.schedule) : req.body.schedule;
        for (const s of schedule) {
          if (s.startTime >= s.endTime) {
            return res.status(400).json({ error: `${s.day}요일: 종료 시각이 시작 시각보다 빠르거나 같습니다` });
          }
        }
      }
      const cls = await storage.createClass(req.body);
      res.json(cls);
    } catch (error) {
      res.status(500).json({ error: "Failed to create class" });
    }
  });

  app.patch("/api/classes/:id", async (req, res) => {
    try {
      // 부담임 다중 지정: 기존 클래스의 teacherId를 기준으로 정규화 (PATCH에서 teacherId 미포함시 대비)
      const existingClass = await storage.getClass(req.params.id);
      const effectiveTeacherId = req.body.teacherId !== undefined ? req.body.teacherId : existingClass?.teacherId;
      if (Array.isArray(req.body.assistantTeacherIds)) {
        const cleaned = Array.from(new Set(
          (req.body.assistantTeacherIds as unknown[])
            .filter((v): v is string => typeof v === "string" && v.length > 0 && v !== effectiveTeacherId)
        ));
        req.body.assistantTeacherIds = cleaned;
        req.body.assistantTeacherId = cleaned[0] ?? null;
      } else if (req.body.assistantTeacherId !== undefined) {
        if (req.body.assistantTeacherId && req.body.assistantTeacherId !== effectiveTeacherId) {
          req.body.assistantTeacherIds = [req.body.assistantTeacherId];
        } else {
          req.body.assistantTeacherIds = [];
          req.body.assistantTeacherId = null;
        }
      }
      if (req.body.assistantTeacherId && req.body.assistantTeacherId === effectiveTeacherId) {
        return res.status(400).json({ error: "부담임과 담당 선생님은 같을 수 없습니다" });
      }
      if (req.body.startTime && req.body.endTime && req.body.startTime >= req.body.endTime) {
        return res.status(400).json({ error: "종료 시각이 시작 시각보다 빠르거나 같습니다" });
      }
      if (req.body.schedule) {
        const schedule = typeof req.body.schedule === "string" ? JSON.parse(req.body.schedule) : req.body.schedule;
        for (const s of schedule) {
          if (s.startTime >= s.endTime) {
            return res.status(400).json({ error: `${s.day}요일: 종료 시각이 시작 시각보다 빠르거나 같습니다` });
          }
        }
      }
      const oldTeacherId = existingClass?.teacherId ?? null;
      const updated = await storage.updateClass(req.params.id, req.body);

      // 수업 담당 선생님이 바뀌면 이전 선생님의 교사소통 대화를 새 선생님에게 인수인계
      if (req.body.teacherId !== undefined && req.body.teacherId !== oldTeacherId) {
        try {
          await handoverTeacherCommunicationOnTeacherChange(
            updated.centerId,
            updated.id,
            oldTeacherId,
            req.body.teacherId
          );
        } catch (handoverErr) {
          console.error("[TeacherComm] 인수인계 실패:", handoverErr);
        }

        // 시간표 담당교사 변경을 클리닉 담당선생님에 동기화
        try {
          await syncClinicTeacherOnClassTeacherChange(
            updated.centerId,
            { name: updated.name, subject: updated.subject },
            oldTeacherId,
            req.body.teacherId
          );
        } catch (clinicSyncErr) {
          console.error("[ClinicSync] 클리닉 담당선생님 동기화 실패:", clinicSyncErr);
        }
      }

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update class" });
    }
  });

  // 수업 삭제 → 휴지통으로 이동 (soft delete, 4주 보관 후 완전삭제)
  app.delete("/api/classes/:id", async (req, res) => {
    try {
      await storage.softDeleteClass(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete class" });
    }
  });

  // 휴지통 수업 목록
  app.get("/api/classes/deleted", async (req, res) => {
    try {
      const centerId = req.query.centerId as string | undefined;
      if (!centerId || !centerId.trim()) {
        return res.json([]);
      }
      const deleted = await storage.getDeletedClasses(centerId);
      res.json(deleted);
    } catch (error) {
      console.error("[GET deleted classes] Error:", error);
      res.status(500).json({ error: "Failed to get deleted classes" });
    }
  });

  // 휴지통 수업 복구
  app.post("/api/classes/:id/restore", async (req, res) => {
    try {
      const restored = await storage.restoreClass(req.params.id);
      res.json(restored);
    } catch (error) {
      console.error("[Restore class] Error:", error);
      res.status(500).json({ error: "Failed to restore class" });
    }
  });

  // 휴지통 수업 완전삭제 (즉시)
  app.delete("/api/classes/:id/permanent", async (req, res) => {
    try {
      const cls = await storage.getClass(req.params.id);
      if (!cls) {
        return res.status(404).json({ error: "Class not found" });
      }
      if (!cls.deletedAt) {
        return res.status(400).json({ error: "휴지통에 있는 수업만 완전삭제할 수 있습니다" });
      }
      await storage.deleteClass(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("[Permanent delete class] Error:", error);
      res.status(500).json({ error: "Failed to permanently delete class" });
    }
  });

  // Class Pricing (교육비) - principal+ only
  app.patch("/api/classes/:id/pricing", async (req, res) => {
    try {
      const { baseFee, additionalFee, actorId } = req.body;
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }

      // Validate fee values
      const sanitizedBaseFee = typeof baseFee === 'number' && !isNaN(baseFee) && baseFee >= 0 
        ? Math.floor(baseFee) 
        : undefined;
      const sanitizedAdditionalFee = typeof additionalFee === 'number' && !isNaN(additionalFee) && additionalFee >= 0 
        ? Math.floor(additionalFee) 
        : undefined;

      // Verify actor has principal+ role
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "원장 이상만 교육비를 설정할 수 있습니다" });
      }

      // Verify actor belongs to the class's center (admins can access all)
      const cls = await storage.getClass(req.params.id);
      if (!cls) {
        return res.status(404).json({ error: "수업을 찾을 수 없습니다" });
      }

      if (actor.role !== UserRole.ADMIN) {
        const actorCenters = await storage.getUserCenters(actorId);
        if (!actorCenters.some(c => c.id === cls.centerId)) {
          return res.status(403).json({ error: "이 센터에 대한 권한이 없습니다" });
        }
      }

      const updated = await storage.updateClass(req.params.id, {
        baseFee: sanitizedBaseFee !== undefined ? sanitizedBaseFee : cls.baseFee,
        additionalFee: sanitizedAdditionalFee !== undefined ? sanitizedAdditionalFee : cls.additionalFee,
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update class pricing" });
    }
  });

  app.get("/api/classes/:id/students", async (req, res) => {
    try {
      const students = await storage.getClassStudents(req.params.id);
      res.json(students);
    } catch (error) {
      console.error(`[GET class students] Error:`, error);
      res.status(500).json({ error: "Failed to get students" });
    }
  });

  // Enrollments
  app.get("/api/enrollments", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      if (!centerId) {
        return res.status(400).json({ error: "Center ID required" });
      }
      
      // Get all classes for the center
      const allClasses = await storage.getClasses();
      const centerClasses = allClasses.filter((c: any) => c.centerId === centerId);
      const classMap = new Map(centerClasses.map((c: any) => [c.id, c]));
      
      // Get all users for the center to find students
      const centerUsers = await storage.getCenterUsers(centerId);
      const students = centerUsers.filter(u => u.role === UserRole.STUDENT);
      
      // Get enrollments for each student
      const allEnrollments = [];
      for (const student of students) {
        const studentEnrollments = await storage.getStudentEnrollments(student.id);
        for (const enrollment of studentEnrollments) {
          const cls = classMap.get(enrollment.classId);
          if (cls) {
            allEnrollments.push({ ...enrollment, class: cls });
          }
        }
      }
      
      res.json(allEnrollments);
    } catch (error) {
      console.error("Failed to get enrollments:", error);
      res.status(500).json({ error: "Failed to get enrollments" });
    }
  });

  // Get enrollments for a specific class
  app.get("/api/classes/:id/enrollments", async (req, res) => {
    try {
      const classId = req.params.id;
      const enrollments = await storage.getClassEnrollments(classId);
      res.json(enrollments);
    } catch (error) {
      console.error("Failed to get class enrollments:", error);
      res.status(500).json({ error: "Failed to get class enrollments" });
    }
  });

  app.get("/api/students/:id/enrollments", async (req, res) => {
    try {
      const enrollments = await storage.getStudentEnrollments(req.params.id);
      const enrichedEnrollments = await Promise.all(
        enrollments.map(async (e) => {
          const cls = await storage.getClass(e.classId);
          if (cls) {
            const teacher = cls.teacherId ? await storage.getUser(cls.teacherId) : null;
            const center = await storage.getCenter(cls.centerId);
            return { ...e, class: cls, teacher, center };
          }
          return { ...e, class: null, teacher: null, center: null };
        })
      );
      res.json(enrichedEnrollments);
    } catch (error) {
      res.status(500).json({ error: "Failed to get enrollments" });
    }
  });

  app.post("/api/enrollments", async (req, res) => {
    try {
      const { studentId, classId } = req.body;
      
      // Check if already enrolled
      const existing = await storage.getEnrollment(studentId, classId);
      if (existing) {
        return res.status(400).json({ error: "Already enrolled" });
      }

      // Check time conflict
      const cls = await storage.getClass(classId);
      if (!cls) {
        return res.status(404).json({ error: "Class not found" });
      }

      const hasConflict = await storage.checkTimeConflict(studentId, cls);
      if (hasConflict) {
        return res.status(400).json({ error: "이미 같은 시간대에 신청된 수업이 있습니다." });
      }

      const enrollment = await storage.createEnrollment(req.body);
      
      // Auto-register clinic student if class type is a clinic type
      if (cls.classType === "high_clinic" || cls.classType === "middle_clinic") {
        const clinicType = cls.classType === "high_clinic" ? "high" : "middle";
        
        // Check if student already exists for this center AND clinic type
        const existingClinicStudent = await storage.getClinicStudentByStudentCenterAndType(studentId, cls.centerId, clinicType);
        
        if (existingClinicStudent) {
          // Student already registered for this clinic type - just update days if needed
          const existingDays = existingClinicStudent.clinicDays || [];
          const newDays = cls.days || [];
          const mergedDays = Array.from(new Set([...existingDays, ...newDays]));
          
          await storage.updateClinicStudent(existingClinicStudent.id, {
            clinicDays: mergedDays,
            isActive: true, // Reactivate if was inactive
          });
        } else {
          // Get student info to auto-fill grade
          const studentInfo = await storage.getUser(studentId);
          
          // Create new clinic student entry with empty teacher (shows as "미지정")
          await storage.createClinicStudent({
            studentId,
            regularTeacherId: "", // Empty = shows as "미지정"
            clinicTeacherId: null,
            centerId: cls.centerId,
            clinicType: clinicType,
            grade: studentInfo?.grade || null, // Auto-fill grade from student profile
            classGroup: null, // 미등록 (unregistered)
            clinicDays: cls.days || [],
            defaultInstructions: "",
            isActive: true,
          });
        }
      }
      
      res.json(enrollment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create enrollment" });
    }
  });

  app.delete("/api/enrollments/:id", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }
      
      const actor = await storage.getUser(actorId);
      if (!actor) {
        return res.status(403).json({ error: "사용자를 찾을 수 없습니다" });
      }
      
      // Get enrollment to check class center
      const enrollment = await storage.getEnrollmentById(req.params.id);
      if (!enrollment) {
        return res.status(404).json({ error: "등록 정보를 찾을 수 없습니다" });
      }
      
      const cls = await storage.getClass(enrollment.classId);
      if (!cls) {
        return res.status(404).json({ error: "수업을 찾을 수 없습니다" });
      }
      
      // Students can only delete their own enrollments
      if (actor.role === UserRole.STUDENT) {
        if (enrollment.studentId !== actorId) {
          return res.status(403).json({ error: "본인의 수강 신청만 삭제할 수 있습니다" });
        }
      } else if (actor.role < UserRole.TEACHER) {
        // Parents cannot delete enrollments
        return res.status(403).json({ error: "선생님 이상만 수강 삭제가 가능합니다" });
      } else if (actor.role !== UserRole.ADMIN) {
        // Teachers/Principals can only delete within their centers
        const actorCenters = await storage.getUserCenters(actorId);
        if (!actorCenters.some(c => c.id === cls.centerId)) {
          return res.status(403).json({ error: "이 센터에 대한 권한이 없습니다" });
        }
      }
      
      await storage.deleteEnrollment(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete enrollment:", error);
      res.status(500).json({ error: "Failed to delete enrollment" });
    }
  });

  // Student APIs
  app.get("/api/students/:id/classes", async (req, res) => {
    try {
      const centerId = req.query.centerId as string | undefined;
      const enrollments = await storage.getStudentEnrollments(req.params.id);
      const classes = await Promise.all(
        enrollments.map(async (e) => {
          const cls = await storage.getClass(e.classId);
          if (!cls) return null;
          // Filter by center if provided
          if (centerId && cls.centerId !== centerId) return null;
          const teacher = cls.teacherId ? await storage.getUser(cls.teacherId) : null;
          const center = await storage.getCenter(cls.centerId);
          return {
            ...cls,
            enrollmentId: e.id,
            teacher: teacher ? { id: teacher.id, name: teacher.name } : null,
            center: center ? { id: center.id, name: center.name } : null,
          };
        })
      );
      res.json(classes.filter(Boolean));
    } catch (error) {
      res.status(500).json({ error: "Failed to get classes" });
    }
  });

  app.get("/api/students/:id/classes/today", async (req, res) => {
    try {
      const centerId = req.query.centerId as string | undefined;
      const enrollments = await storage.getStudentEnrollments(req.params.id);
      const today = new Date();
      const dayMap: Record<number, string> = {
        0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat"
      };
      const todayDay = dayMap[today.getDay()];

      const classes = await Promise.all(
        enrollments.map((e) => storage.getClass(e.classId))
      );

      // Filter by center if provided
      let todayClasses = classes.filter((c) => c && c.days.includes(todayDay));
      if (centerId) {
        todayClasses = todayClasses.filter((c) => c && c.centerId === centerId);
      }
      res.json(todayClasses);
    } catch (error) {
      res.status(500).json({ error: "Failed to get today's classes" });
    }
  });

  app.get("/api/students/:id/homework/pending", async (req, res) => {
    try {
      const centerId = req.query.centerId as string | undefined;
      const homework = await storage.getStudentHomework(req.params.id, centerId);
      const submissions = await storage.getStudentSubmissions(req.params.id, centerId);
      
      const now = new Date();
      const koreaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
      const year = koreaTime.getFullYear();
      const month = koreaTime.getMonth();

      const firstDayOfMonth = new Date(year, month, 1);
      const lastDayOfMonth = new Date(year, month + 1, 0);

      const firstDayDow = firstDayOfMonth.getDay();
      const rangeStart = new Date(year, month, 1);
      rangeStart.setDate(rangeStart.getDate() - (firstDayDow === 0 ? 6 : firstDayDow - 1));

      const lastDayDow = lastDayOfMonth.getDay();
      const rangeEnd = new Date(year, month + 1, 0);
      if (lastDayDow !== 0) {
        rangeEnd.setDate(rangeEnd.getDate() + (7 - lastDayDow));
      }

      const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const rangeStartStr = toDateStr(rangeStart);
      const rangeEndStr = toDateStr(rangeEnd);

      const pending = homework.filter((hw) => {
        const sub = submissions.find((s) => s.homeworkId === hw.id);
        if (sub && sub.status !== "pending" && sub.status !== "resubmit") return false;

        const dueDateStr = String(hw.dueDate).substring(0, 10);
        return dueDateStr >= rangeStartStr && dueDateStr <= rangeEndStr;
      });

      res.json(pending);
    } catch (error) {
      res.status(500).json({ error: "Failed to get pending homework" });
    }
  });

  app.get("/api/students/:id/homework", async (req, res) => {
    try {
      const centerId = req.query.centerId as string | undefined;
      const homework = await storage.getStudentHomework(req.params.id, centerId);
      res.json(homework);
    } catch (error) {
      res.status(500).json({ error: "Failed to get homework" });
    }
  });

  app.get("/api/students/:id/homework/submissions", async (req, res) => {
    try {
      const centerId = req.query.centerId as string | undefined;
      const submissions = await storage.getStudentSubmissions(req.params.id, centerId);
      res.json(submissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get submissions" });
    }
  });

  // Student face-to-face checks APIs
  app.get("/api/students/:id/face-to-face-checks", async (req, res) => {
    try {
      const centerId = req.query.centerId as string | undefined;
      const checks = await storage.getStudentFaceToFaceChecks(req.params.id, centerId);
      res.json(checks);
    } catch (error) {
      res.status(500).json({ error: "Failed to get face-to-face checks" });
    }
  });

  app.get("/api/students/:id/face-to-face-check-results", async (req, res) => {
    try {
      const centerId = req.query.centerId as string | undefined;
      const results = await storage.getStudentCheckResults(req.params.id, centerId);
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: "Failed to get check results" });
    }
  });

  app.get("/api/students/:id/scores-by-date", async (req, res) => {
    try {
      const studentId = req.params.id;
      const date = req.query.date as string;
      const centerId = req.query.centerId as string;
      if (!date || !centerId) {
        return res.status(400).json({ error: "date and centerId are required" });
      }

      const studentAssessments = await db.select().from(assessments)
        .where(and(eq(assessments.studentId, studentId), eq(assessments.assessmentDate, date)));

      const classIds = [...new Set(studentAssessments.map(a => a.classId))];
      let classMap: Record<string, { name: string; subject: string }> = {};
      if (classIds.length > 0) {
        const classData = await db.select().from(classes).where(inArray(classes.id, classIds));
        classData.forEach(c => { classMap[c.id] = { name: c.name, subject: c.subject || "" }; });
      }
      const filteredAssessments = studentAssessments
        .filter(a => classMap[a.classId])
        .map(a => ({
          id: a.id,
          type: "assessment" as const,
          name: "주간평가",
          score: a.score,
          maxScore: a.maxScore,
          date: a.assessmentDate,
          className: classMap[a.classId]?.name || "",
          classSubject: classMap[a.classId]?.subject || "",
        }));

      const studentExamParticipants = await db.select().from(examParticipants)
        .where(eq(examParticipants.studentId, studentId));

      let examScores: any[] = [];
      if (studentExamParticipants.length > 0) {
        const examIds = [...new Set(studentExamParticipants.map(p => p.examId))];
        const examData = await db.select().from(exams)
          .where(and(inArray(exams.id, examIds), eq(exams.examDate, date), eq(exams.centerId, centerId)));

        const examClassIds = examData.filter(e => e.classId).map(e => e.classId!);
        if (examClassIds.length > 0) {
          const examClassData = await db.select().from(classes).where(inArray(classes.id, examClassIds));
          examClassData.forEach(c => { classMap[c.id] = { name: c.name, subject: c.subject || "" }; });
        }

        examScores = examData.map(exam => {
          const participant = studentExamParticipants.find(p => p.examId === exam.id);
          return {
            id: exam.id,
            type: "exam" as const,
            name: exam.name,
            score: participant?.score ?? null,
            maxScore: exam.maxScore,
            date: exam.examDate,
            scope: exam.scope || "",
            className: exam.classId && classMap[exam.classId] ? classMap[exam.classId].name : "",
            classSubject: exam.classId && classMap[exam.classId] ? classMap[exam.classId].subject : "",
          };
        });
      }

      res.json([...filteredAssessments, ...examScores]);
    } catch (error) {
      console.error("Failed to get scores by date:", error);
      res.status(500).json({ error: "Failed to get scores by date" });
    }
  });

  app.get("/api/students/:id/class-notes-by-date", async (req, res) => {
    try {
      const studentId = req.params.id;
      const date = req.query.date as string;
      const centerId = req.query.centerId as string;
      if (!date || !centerId) {
        return res.status(400).json({ error: "date and centerId are required" });
      }

      const studentEnrollments = await db.select().from(enrollments)
        .where(eq(enrollments.studentId, studentId));
      const enrolledClassIds = studentEnrollments.map(e => e.classId);

      if (enrolledClassIds.length === 0) {
        return res.json({ commonNotes: [], studentNotes: [] });
      }

      const enrolledClasses = await db.select().from(classes)
        .where(and(inArray(classes.id, enrolledClassIds), eq(classes.centerId, centerId), isNull(classes.deletedAt)));
      const classIds = enrolledClasses.map(c => c.id);
      const classMap: Record<string, { name: string; subject: string }> = {};
      enrolledClasses.forEach(c => { classMap[c.id] = { name: c.name, subject: c.subject || "" }; });

      if (classIds.length === 0) {
        return res.json({ commonNotes: [], studentNotes: [] });
      }

      const commonNotesResult = await db.select().from(classNotes)
        .where(and(inArray(classNotes.classId, classIds), eq(classNotes.noteDate, date)));

      const studentNotesResult = await db.select().from(studentClassNotes)
        .where(and(
          eq(studentClassNotes.studentId, studentId),
          inArray(studentClassNotes.classId, classIds),
          eq(studentClassNotes.noteDate, date)
        ));

      const teacherIds = [
        ...new Set([
          ...commonNotesResult.map(n => n.teacherId),
          ...studentNotesResult.map(n => n.teacherId)
        ])
      ];
      let teacherMap: Record<string, string> = {};
      if (teacherIds.length > 0) {
        const teacherData = await db.select().from(users).where(inArray(users.id, teacherIds));
        teacherData.forEach(t => { teacherMap[t.id] = t.name; });
      }

      const commonNotes = commonNotesResult.map(n => ({
        id: n.id,
        classId: n.classId,
        className: classMap[n.classId]?.name || "",
        classSubject: classMap[n.classId]?.subject || "",
        content: n.content,
        teacherName: teacherMap[n.teacherId] || "",
        noteDate: n.noteDate,
      }));

      const studentNotes = studentNotesResult.map(n => ({
        id: n.id,
        classId: n.classId,
        className: classMap[n.classId]?.name || "",
        classSubject: classMap[n.classId]?.subject || "",
        content: n.content,
        attitudeScore: n.attitudeScore,
        teacherName: teacherMap[n.teacherId] || "",
        noteDate: n.noteDate,
      }));

      res.json({ commonNotes, studentNotes });
    } catch (error) {
      console.error("Failed to get class notes by date:", error);
      res.status(500).json({ error: "Failed to get class notes by date" });
    }
  });

  app.get("/api/students/:id/assessments/recent", async (req, res) => {
    try {
      const centerId = req.query.centerId as string | undefined;
      const assessments = await storage.getStudentAssessments(req.params.id, undefined, centerId);
      res.json(assessments.slice(0, 5));
    } catch (error) {
      res.status(500).json({ error: "Failed to get assessments" });
    }
  });

  app.get("/api/students/:id/assessments", async (req, res) => {
    try {
      const month = req.query.month as string | undefined;
      const centerId = req.query.centerId as string | undefined;
      const assessments = await storage.getStudentAssessments(req.params.id, month, centerId);
      res.json(assessments);
    } catch (error) {
      res.status(500).json({ error: "Failed to get assessments" });
    }
  });

  app.patch("/api/students/:id/tuition-visibility", async (req, res) => {
    try {
      const { visible } = req.body;
      if (typeof visible !== "boolean") {
        return res.status(400).json({ error: "visible must be a boolean" });
      }
      const [updated] = await db
        .update(users)
        .set({ tuitionVisibleToStudent: visible })
        .where(eq(users.id, req.params.id))
        .returning();
      if (!updated) {
        return res.status(404).json({ error: "Student not found" });
      }
      res.json({ success: true, tuitionVisibleToStudent: updated.tuitionVisibleToStudent });
    } catch (error) {
      res.status(500).json({ error: "Failed to update tuition visibility" });
    }
  });

  app.get("/api/students/:id/tuition-visibility", async (req, res) => {
    try {
      const [student] = await db
        .select({ tuitionVisibleToStudent: users.tuitionVisibleToStudent })
        .from(users)
        .where(eq(users.id, req.params.id));
      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }
      res.json({ visible: student.tuitionVisibleToStudent });
    } catch (error) {
      res.status(500).json({ error: "Failed to check tuition visibility" });
    }
  });

  app.patch("/api/students/:id/tuition-memo", async (req, res) => {
    try {
      const { memo } = req.body;
      const [updated] = await db
        .update(users)
        .set({ tuitionMemo: memo || null })
        .where(eq(users.id, req.params.id))
        .returning();
      if (!updated) {
        return res.status(404).json({ error: "Student not found" });
      }
      res.json({ success: true, tuitionMemo: updated.tuitionMemo });
    } catch (error) {
      res.status(500).json({ error: "Failed to update tuition memo" });
    }
  });

  // Custom tuition amount per student
  app.patch("/api/students/:id/custom-tuition", async (req, res) => {
    try {
      const { amount } = req.body;
      const [updated] = await db
        .update(users)
        .set({ customTuitionAmount: amount === null || amount === undefined ? null : parseInt(amount, 10) })
        .where(eq(users.id, req.params.id))
        .returning();
      if (!updated) {
        return res.status(404).json({ error: "Student not found" });
      }
      res.json({ success: true, customTuitionAmount: updated.customTuitionAmount });
    } catch (error) {
      res.status(500).json({ error: "Failed to update custom tuition amount" });
    }
  });

  app.patch("/api/students/:id/discount", async (req, res) => {
    try {
      const { discountRate, discountReason, discountTarget, actorId } = req.body;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.PRINCIPAL) return res.status(403).json({ error: "권한이 없습니다" });

      const parsedRate = discountRate === null || discountRate === undefined ? null : parseInt(discountRate, 10);
      if (parsedRate !== null && (isNaN(parsedRate) || parsedRate < 0 || parsedRate > 100)) {
        return res.status(400).json({ error: "할인율은 0~100 사이여야 합니다" });
      }
      const validTargets = ["tuition", "textbook", "both"];
      if (discountTarget && !validTargets.includes(discountTarget)) {
        return res.status(400).json({ error: "유효하지 않은 적용 대상입니다" });
      }

      const [updated] = await db
        .update(users)
        .set({
          discountRate: parsedRate,
          discountReason: discountReason || null,
          discountTarget: parsedRate === null ? null : (discountTarget || null),
        })
        .where(eq(users.id, req.params.id))
        .returning();
      if (!updated) {
        return res.status(404).json({ error: "Student not found" });
      }
      res.json({ success: true, discountRate: updated.discountRate, discountReason: updated.discountReason, discountTarget: updated.discountTarget });
    } catch (error) {
      res.status(500).json({ error: "Failed to update discount" });
    }
  });

  // Tuition Access Password APIs
  // Check if password exists for a student
  app.get("/api/students/:id/tuition-password-status", async (req, res) => {
    try {
      const password = await storage.getTuitionAccessPassword(req.params.id);
      res.json({ hasPassword: !!password });
    } catch (error) {
      res.status(500).json({ error: "Failed to check password status" });
    }
  });

  // Set/update password (parent only - must be linked to student)
  app.post("/api/students/:id/tuition-password", async (req, res) => {
    try {
      const { password, parentId } = req.body;
      if (!password || password.length < 4) {
        return res.status(400).json({ error: "비밀번호는 4자리 이상이어야 합니다" });
      }
      if (!parentId) {
        return res.status(400).json({ error: "parentId is required" });
      }

      // Verify parent is linked to this student
      const parent = await storage.getUser(parentId);
      if (!parent || parent.role !== UserRole.PARENT) {
        return res.status(403).json({ error: "학부모 계정만 비밀번호를 설정할 수 있습니다" });
      }

      const linkedStudentIds = parent.linkedStudentIds || [];
      if (!linkedStudentIds.includes(req.params.id)) {
        return res.status(403).json({ error: "연결된 자녀만 비밀번호를 설정할 수 있습니다" });
      }

      const result = await storage.setTuitionAccessPassword(req.params.id, password);
      res.json({ success: true, hasPassword: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to set password" });
    }
  });

  // Verify password (student) - returns success if password matches
  app.post("/api/students/:id/tuition-password/verify", async (req, res) => {
    try {
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ error: "비밀번호를 입력하세요" });
      }

      const stored = await storage.getTuitionAccessPassword(req.params.id);
      if (!stored) {
        // No password set, allow access
        return res.json({ verified: true, noPasswordRequired: true });
      }

      if (stored.password === password) {
        return res.json({ verified: true });
      } else {
        return res.status(401).json({ error: "비밀번호가 일치하지 않습니다" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to verify password" });
    }
  });

  // Delete password (parent only)
  app.delete("/api/students/:id/tuition-password", async (req, res) => {
    try {
      const { parentId } = req.body;
      if (!parentId) {
        return res.status(400).json({ error: "parentId is required" });
      }

      // Verify parent is linked to this student
      const parent = await storage.getUser(parentId);
      if (!parent || parent.role !== UserRole.PARENT) {
        return res.status(403).json({ error: "학부모 계정만 비밀번호를 삭제할 수 있습니다" });
      }

      const linkedStudentIds = parent.linkedStudentIds || [];
      if (!linkedStudentIds.includes(req.params.id)) {
        return res.status(403).json({ error: "연결된 자녀만 비밀번호를 삭제할 수 있습니다" });
      }

      await storage.deleteTuitionAccessPassword(req.params.id);
      res.json({ success: true, hasPassword: false });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete password" });
    }
  });

  // Tuition Guidance APIs (교육비 안내)
  // Get guidance for a center (anyone with center access)
  app.get("/api/centers/:centerId/tuition-guidance", async (req, res) => {
    try {
      const guidance = await storage.getTuitionGuidance(req.params.centerId);
      res.json(guidance || { centerId: req.params.centerId, guidanceText: null, imageUrls: [] });
    } catch (error) {
      res.status(500).json({ error: "Failed to get tuition guidance" });
    }
  });

  // Update guidance for a center (principal/admin only)
  app.put("/api/centers/:centerId/tuition-guidance", async (req, res) => {
    try {
      const { guidanceText, imageUrls, userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "원장 또는 관리자만 교육비 안내를 수정할 수 있습니다" });
      }

      // For principals, verify they have access to this center
      if (user.role === UserRole.PRINCIPAL) {
        const userCenters = await storage.getUserCenters(userId);
        const hasAccess = userCenters.some(c => c.id === req.params.centerId);
        if (!hasAccess) {
          return res.status(403).json({ error: "해당 센터에 대한 권한이 없습니다" });
        }
      }

      const result = await storage.upsertTuitionGuidance(req.params.centerId, {
        guidanceText,
        imageUrls,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to update tuition guidance" });
    }
  });

  // Tuition Notification APIs (교육비 안내 문자)
  
  // Get notification history for a center
  app.get("/api/centers/:centerId/tuition-notifications", async (req, res) => {
    try {
      const notifications = await storage.getTuitionNotifications(req.params.centerId);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to get tuition notifications" });
    }
  });

  // Send tuition notification SMS to parent
  app.post("/api/tuition-notifications/send", async (req, res) => {
    try {
      const { 
        studentId, 
        parentId, 
        centerId, 
        senderId,
        title,
        calculatedTotal,
        sentAmount,
        feeBreakdown,
        paymentMethod,
        messageContent,
        recipientPhone,
        recipientType,
        textbookTotal,
        skipSms,
        draftOnly,
        scheduledDate
      } = req.body;

      if (!studentId || !centerId || !senderId) {
        return res.status(400).json({ error: "필수 정보가 누락되었습니다" });
      }

      // Verify sender is principal or admin
      const sender = await storage.getUser(senderId);
      if (!sender || sender.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "원장 또는 관리자만 교육비 안내를 할 수 있습니다" });
      }

      // Get student info
      const student = await storage.getUser(studentId);
      if (!student) {
        return res.status(404).json({ error: "학생을 찾을 수 없습니다" });
      }

      // Get center info
      const center = await storage.getCenter(centerId);
      if (!center) {
        return res.status(404).json({ error: "센터를 찾을 수 없습니다" });
      }

      let smsResult: { success: boolean; error?: string } = { success: true };

      // Send SMS only if not skipped (draftOnly implies skipSms)
      const skipSendingSms = !!skipSms || !!draftOnly;
      if (!skipSendingSms) {
        if (!recipientPhone) {
          return res.status(400).json({ error: "수신자 전화번호가 필요합니다" });
        }
        if (!messageContent) {
          return res.status(400).json({ error: "문자 내용이 누락되었습니다" });
        }

        const { sendSms } = await import("./services/solapi");
        smsResult = await sendSms({
          to: recipientPhone.replace(/-/g, ""),
          text: messageContent,
          centerName: center.name,
          centerId: center.id,
          scheduledDate: scheduledDate || undefined,
        });
      }

      // Record the notification
      // - draftOnly: status="draft" (학생에게 청구서로 노출되지 않음, 원장/관리자만 참고)
      // - skipSms (legacy): status="saved" (학생에게 청구서로 노출됨)
      // - 일반 발송: status="sent" / "scheduled" / "failed"
      const notificationStatus = draftOnly
        ? "draft"
        : skipSms
          ? "saved"
          : (smsResult.success ? (scheduledDate ? "scheduled" : "sent") : "failed");

      const notification = await storage.createTuitionNotification({
        studentId,
        parentId: parentId || null,
        centerId,
        sentById: senderId,
        title: title || null,
        calculatedTotal,
        sentAmount,
        feeBreakdown: JSON.stringify(feeBreakdown),
        paymentMethod,
        paymentDetails: "",
        messageContent: messageContent || "",
        recipientPhone: recipientPhone || "",
        recipientType: recipientType || null,
        status: notificationStatus,
        errorMessage: smsResult.error,
        textbookTotal: textbookTotal || 0,
        paymentStatus: "pending",
        // 예약 문자인 경우, 교육비 내역을 예약 발송 시점(월) 기준으로 저장한다.
        // 5월에 6월 예약문자를 등록하면 해당 내역은 6월 것으로 집계된다.
        ...(notificationStatus === "scheduled" && scheduledDate && !isNaN(new Date(scheduledDate).getTime())
          ? { createdAt: new Date(scheduledDate) }
          : {}),
      });

      if (!skipSendingSms && !smsResult.success) {
        return res.status(500).json({ 
          error: "문자 발송에 실패했습니다", 
          details: smsResult.error,
          notification 
        });
      }

      res.json({ success: true, notification });
    } catch (error: any) {
      console.error("Failed to send tuition notification:", error);
      res.status(500).json({ error: "문자 발송에 실패했습니다", details: error.message });
    }
  });

  // Get pending tuition notifications for a student (used by student account)
  app.get("/api/students/:studentId/tuition-notifications", async (req, res) => {
    try {
      const { studentId } = req.params;
      const centerId = req.query.centerId as string | undefined;
      const notifications = await storage.getTuitionNotificationsByStudent(studentId, centerId);
      // Return all sent or saved notifications (including paid and pending) for payment history
      const validNotifications = notifications.filter(n => n.status === "sent" || n.status === "saved" || n.status === "scheduled");
      res.json(validNotifications);
    } catch (error: any) {
      console.error("Failed to get student tuition notifications:", error);
      res.status(500).json({ error: "조회에 실패했습니다" });
    }
  });

  // Get textbook purchases for a student (used by student account)
  app.get("/api/students/:studentId/textbook-purchases", async (req, res) => {
    try {
      const { studentId } = req.params;
      const centerId = req.query.centerId as string | undefined;
      const purchases = await storage.getStudentTextbookPurchases(studentId, centerId);
      res.json(purchases);
    } catch (error: any) {
      console.error("Failed to get student textbook purchases:", error);
      res.status(500).json({ error: "조회에 실패했습니다" });
    }
  });

  // Helper: Sync revenue for a specific yearMonth based on paid tuition notifications
  async function syncRevenueForYearMonth(centerId: string, yearMonth: string, allNotifications?: any[], allUsers?: any[], exitRecordsMap?: Map<string, string>) {
    const [year, month] = yearMonth.split("-").map(Number);
    if (!allNotifications) allNotifications = await storage.getTuitionNotifications(centerId);
    if (!allUsers) allUsers = await storage.getUsers();
    if (!exitRecordsMap) {
      const exitRecords = await storage.getStudentExitRecords(centerId);
      exitRecordsMap = new Map<string, string>();
      for (const er of exitRecords) {
        if (!exitRecordsMap.has(er.studentId)) {
          exitRecordsMap.set(er.studentId, er.studentName);
        }
      }
    }

    const paidNotifications = allNotifications.filter((n: any) => {
      if (n.paymentStatus !== "paid" || !n.paidAt) return false;
      const d = new Date(n.paidAt);
      return d.getFullYear() === year && (d.getMonth() + 1) === month;
    });

    let totalRevenue = 0;
    const revenueDetails: any[] = [];

    for (const notification of paidNotifications) {
      const student = allUsers.find((u: any) => u.id === notification.studentId);
      const paidAmount = (notification.sentAmount || 0) + (notification.textbookTotal || 0);
      if (paidAmount > 0) {
        totalRevenue += paidAmount;
        let displayName: string;
        if (student?.name) {
          displayName = student.name;
        } else {
          const exitName = exitRecordsMap.get(notification.studentId);
          displayName = exitName ? `${exitName} (퇴원생)` : "(퇴원생)";
        }
        revenueDetails.push({
          name: displayName,
          amount: paidAmount,
          studentId: notification.studentId,
          school: student?.school || "",
          grade: student?.grade || "",
          paidAt: notification.paidAt ? new Date(notification.paidAt).toISOString() : "",
          paymentMethod: notification.paymentMethod || "",
        });
      }
    }

    const existingRecord = await storage.getMonthlyFinancialRecord(centerId, yearMonth);
    if (existingRecord) {
      await storage.updateMonthlyFinancialRecord(existingRecord.id, {
        revenueTuition: totalRevenue,
        revenueTuitionDetails: JSON.stringify(revenueDetails),
      });
    } else if (totalRevenue > 0) {
      const admins = allUsers.filter((u: any) => u.role >= UserRole.PRINCIPAL);
      await storage.createMonthlyFinancialRecord({
        centerId,
        yearMonth,
        createdBy: admins[0]?.id || "system",
        revenueTuition: totalRevenue,
        revenueTuitionDetails: JSON.stringify(revenueDetails),
      });
    }
    return { yearMonth, totalRevenue, count: revenueDetails.length };
  }

  // Helper: Auto-sync revenue for ALL months that have financial records or paid notifications
  async function autoSyncAllRevenue(centerId: string, extraMonths: string[] = []) {
    try {
      const allNotifications = await storage.getTuitionNotifications(centerId);
      const allUsers = await storage.getUsers();
      const exitRecords = await storage.getStudentExitRecords(centerId);
      const exitRecordsMap = new Map<string, string>();
      for (const er of exitRecords) {
        if (!exitRecordsMap.has(er.studentId)) {
          exitRecordsMap.set(er.studentId, er.studentName);
        }
      }

      const monthsToSync = new Set<string>();

      // Collect months from paid notifications
      allNotifications.forEach((n: any) => {
        if (n.paymentStatus === "paid" && n.paidAt) {
          const d = new Date(n.paidAt);
          monthsToSync.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
        }
      });

      // Also collect months from existing financial records with tuition revenue
      // for the current and last year (to clear stale data). We intentionally limit
      // this to recent years so that manually-entered historical tuition revenue is
      // not overwritten by auto-sync. The specific month of a deleted/cancelled
      // invoice is still handled precisely via `extraMonths` below.
      const now = new Date();
      const recentYears = new Set([now.getFullYear(), now.getFullYear() - 1]);
      const existingRecords = await storage.getMonthlyFinancialRecords(centerId);
      for (const record of existingRecords) {
        const recordYear = parseInt(record.yearMonth.split("-")[0], 10);
        if (recentYears.has(recordYear) && (record.revenueTuition ?? 0) > 0) {
          monthsToSync.add(record.yearMonth);
        }
      }

      // Explicitly include any caller-provided months (e.g. the month of a just
      // deleted/cancelled invoice, even if its record's year is outside the recent
      // window or its record already shows 0). This guarantees the affected month
      // is recomputed from the remaining paid notifications.
      for (const ym of extraMonths) {
        if (ym) monthsToSync.add(ym);
      }

      for (const ym of monthsToSync) {
        const result = await syncRevenueForYearMonth(centerId, ym, allNotifications, allUsers, exitRecordsMap);
        console.log(`[AUTO-SYNC] Revenue synced for ${centerId} ${result.yearMonth}: ${result.totalRevenue}원 (${result.count}건)`);
      }
    } catch (error) {
      console.error("[AUTO-SYNC] Failed to sync revenue:", error);
    }
  }

  // Update tuition notification payment status (supports multiple payment methods and memo)
  app.patch("/api/tuition-notifications/:id/payment-status", async (req, res) => {
    try {
      const { id } = req.params;
      const { paymentStatus, paymentMethod, paymentMemo, actorId } = req.body;
      
      if (!paymentStatus || !["pending", "paid", "cancelled"].includes(paymentStatus)) {
        return res.status(400).json({ error: "유효한 결제 상태가 필요합니다" });
      }
      
      if (!actorId) {
        return res.status(400).json({ error: "사용자 ID가 필요합니다" });
      }
      
      // Get the notification first to verify it exists
      const notification = await storage.getTuitionNotificationById(id);
      if (!notification) {
        return res.status(404).json({ error: "알림을 찾을 수 없습니다" });
      }
      
      // Drafts are saved message text only (not actual invoices), so cannot have a payment status
      if (notification.status === "draft") {
        return res.status(400).json({ error: "임시 저장된 안내는 결제 상태를 변경할 수 없습니다" });
      }
      
      // Verify the actor exists and has permission
      const actor = await storage.getUser(actorId);
      if (!actor) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }
      
      // Allow if actor is the student on the notification, or if actor is admin/principal/teacher
      // Roles: 4=admin, 3=principal, 2=teacher, 1=student, 0=parent, -1=kiosk
      const isOwner = notification.studentId === actorId;
      const isAdminOrPrincipal = actor.role === 4 || actor.role === 3;
      const isTeacherRole = actor.role === 2;
      
      if (!isOwner && !isAdminOrPrincipal && !isTeacherRole) {
        return res.status(403).json({ error: "결제 상태를 변경할 권한이 없습니다" });
      }
      
      // Only students are restricted from changing already-processed payments
      // Admin/Principal/Teacher can change any status to any status
      if (!isAdminOrPrincipal && !isTeacherRole && notification.paymentStatus !== "pending" && paymentStatus !== notification.paymentStatus) {
        return res.status(400).json({ error: "이미 처리된 결제입니다" });
      }
      
      const updated = await storage.updateTuitionNotificationPaymentStatus(id, paymentStatus, paymentMethod, paymentMemo);
      
      // Auto-sync revenue when payment status changes. Await so the client refetch
      // after this request reflects the up-to-date revenue. Include the affected
      // invoice's month explicitly so cancelling a paid invoice clears its revenue.
      if (notification.centerId) {
        const affectedDate = notification.paidAt || notification.createdAt;
        const affectedMonth = affectedDate
          ? `${new Date(affectedDate).getFullYear()}-${String(new Date(affectedDate).getMonth() + 1).padStart(2, "0")}`
          : "";
        await autoSyncAllRevenue(notification.centerId, affectedMonth ? [affectedMonth] : []);
      }
      
      res.json(updated);
    } catch (error: any) {
      console.error("Failed to update payment status:", error);
      res.status(500).json({ error: "결제 상태 업데이트에 실패했습니다" });
    }
  });

  // 교육비 안내(청구서) 완전 삭제 - 원장/관리자만 가능
  app.delete("/api/tuition-notifications/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const actorId = (req.body?.actorId || req.query.actorId) as string | undefined;

      if (!actorId) {
        return res.status(400).json({ error: "사용자 ID가 필요합니다" });
      }

      const notification = await storage.getTuitionNotificationById(id);
      if (!notification) {
        return res.status(404).json({ error: "알림을 찾을 수 없습니다" });
      }

      const actor = await storage.getUser(actorId);
      if (!actor) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }

      // 관리자(4)/원장(3)만 삭제 가능
      if (actor.role !== 4 && actor.role !== 3) {
        return res.status(403).json({ error: "교육비 안내를 삭제할 권한이 없습니다" });
      }

      const deleted = await storage.deleteTuitionNotification(id);
      if (!deleted) {
        return res.status(404).json({ error: "삭제에 실패했습니다" });
      }

      // 매출 동기화: 삭제된 청구서의 매출이 재무 탭에서 빠지도록 해당 월을 명시적으로
      // 재동기화하고, await 하여 응답 후 클라이언트 재조회가 최신 매출을 반영하게 한다.
      if (notification.centerId) {
        const affectedDate = notification.paidAt || notification.createdAt;
        const affectedMonth = affectedDate
          ? `${new Date(affectedDate).getFullYear()}-${String(new Date(affectedDate).getMonth() + 1).padStart(2, "0")}`
          : "";
        await autoSyncAllRevenue(notification.centerId, affectedMonth ? [affectedMonth] : []);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete tuition notification:", error);
      res.status(500).json({ error: "교육비 안내 삭제에 실패했습니다" });
    }
  });

  // Toss Payments API endpoints
  
  // Get Toss Payments client key and check if configured (supports center-specific config)
  app.get("/api/payments/config", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      
      // If centerId is provided, check center-specific config first
      if (centerId) {
        const center = await storage.getCenter(centerId);
        if (center && isTossPaymentsConfiguredForCenter(center.tossClientKey, center.tossSecretKey)) {
          return res.json({ 
            configured: true, 
            clientKey: getDecryptedClientKey(center.tossClientKey!) 
          });
        }
      }
      
      // Fallback to system-wide default keys
      const defaults = await getDefaultTossKeys();
      if (defaults.encryptedClientKey && defaults.encryptedSecretKey) {
        return res.json({
          configured: true,
          clientKey: getDecryptedClientKey(defaults.encryptedClientKey),
        });
      }

      // Fallback to environment variables
      if (!isTossPaymentsConfigured()) {
        return res.json({ configured: false });
      }
      res.json({ 
        configured: true, 
        clientKey: getClientKey() 
      });
    } catch (error: any) {
      console.error("Failed to get payment config:", error);
      res.json({ configured: false });
    }
  });

  // Initiate payment - generate orderId and save to notification
  app.post("/api/payments/initiate", async (req, res) => {
    try {
      const { notificationId, studentId } = req.body;
      
      if (!notificationId || !studentId) {
        return res.status(400).json({ error: "필수 정보가 누락되었습니다" });
      }
      
      // Get the notification
      const notification = await storage.getTuitionNotificationById(notificationId);
      if (!notification) {
        return res.status(404).json({ error: "결제 정보를 찾을 수 없습니다" });
      }
      
      // Verify the student matches
      if (notification.studentId !== studentId) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }
      
      // Check if already paid
      if (notification.paymentStatus === "paid") {
        return res.status(400).json({ error: "이미 결제 완료된 건입니다" });
      }

      // Reject cancelled notifications - student should pay against the latest re-issued one
      if (notification.paymentStatus === "cancelled") {
        return res.status(400).json({ error: "취소된 안내건입니다. 새로 안내된 결제건으로 결제해주세요." });
      }
      
      // Generate orderId if not exists
      let orderId = notification.tossOrderId;
      if (!orderId) {
        orderId = `TUITION-${notificationId}-${Date.now()}`;
        await storage.updateTuitionNotificationTossOrderId(notificationId, orderId);
      }
      
      // Calculate total amount
      const tuitionAmount = notification.sentAmount || 0;
      const textbookAmount = notification.textbookTotal || 0;
      const totalAmount = tuitionAmount + textbookAmount;
      
      // Get student name for orderName
      const student = await storage.getUser(studentId);
      const studentName = student?.name || "학생";
      
      res.json({
        orderId,
        amount: totalAmount,
        orderName: `${studentName} 교육비`,
        customerName: studentName,
      });
    } catch (error: any) {
      console.error("Failed to initiate payment:", error);
      res.status(500).json({ error: "결제 시작에 실패했습니다" });
    }
  });

  // Confirm payment after Toss callback
  app.post("/api/payments/confirm", async (req, res) => {
    try {
      const { paymentKey, orderId, amount } = req.body;
      
      if (!paymentKey || !orderId || !amount) {
        return res.status(400).json({ error: "필수 정보가 누락되었습니다" });
      }
      
      // Find notification by orderId
      const notification = await storage.getTuitionNotificationByOrderId(orderId);
      if (!notification) {
        return res.status(404).json({ error: "결제 정보를 찾을 수 없습니다" });
      }

      // Get center to check for center-specific Toss config
      const center = notification.centerId ? await storage.getCenter(notification.centerId) : null;

      // Approve (capture) the payment with Toss first.
      let paymentResult;
      if (center && isTossPaymentsConfiguredForCenter(center.tossClientKey, center.tossSecretKey)) {
        // Use center-specific Toss config
        paymentResult = await confirmPaymentWithKey(
          { paymentKey, orderId, amount },
          center.tossSecretKey!
        );
      } else {
        // Fallback to system-wide default keys, then to environment variables
        const defaults = await getDefaultTossKeys();
        if (defaults.encryptedSecretKey) {
          paymentResult = await confirmPaymentWithKey(
            { paymentKey, orderId, amount },
            defaults.encryptedSecretKey
          );
        } else {
          paymentResult = await confirmPayment({
            paymentKey,
            orderId,
            amount,
          });
        }
      }

      // Record paid status on the correct notification (shared with webhook/reconcile).
      const finalizeResult = await finalizePaidNotificationByOrder(orderId, paymentKey, amount, "confirm");
      if (!finalizeResult.ok) {
        if (finalizeResult.reason === "cancelled") {
          return res.status(400).json({
            error: "취소된 결제 안내건입니다. 새로 안내된 결제건이 있는지 확인 후 다시 결제해주세요.",
          });
        }
        if (finalizeResult.reason === "amount_mismatch") {
          return res.status(400).json({ error: "결제 금액이 일치하지 않습니다" });
        }
        // notfound/lookup_error: Toss는 승인됨. 안전망(웹훅/대사)이 추후 보정하므로 성공으로 응답.
        console.error(`[PAYMENT][confirm] finalize failed (${finalizeResult.reason}) for order ${orderId} but Toss approved.`);
        return res.json({ success: true, payment: paymentResult });
      }

      res.json({
        success: true,
        payment: paymentResult,
        redirectedTo: finalizeResult.redirectedFrom ? finalizeResult.targetId : undefined,
      });
    } catch (error: any) {
      console.error("Failed to confirm payment:", error);
      // 네트워크/스트림 오류로 confirm 응답을 받지 못했더라도 Toss에는 이미
      // 승인(DONE)됐을 수 있다. 실제 결제 상태를 다시 조회해 DONE이면 즉시
      // 완료 처리하여 "실제 결제됨 → 앱은 결제 대기" 상태로 남지 않게 한다.
      try {
        const { paymentKey, orderId, amount } = req.body;
        if (orderId) {
          const notification = await storage.getTuitionNotificationByOrderId(orderId);
          const center = notification?.centerId
            ? await storage.getCenter(notification.centerId)
            : null;

          let actual: Awaited<ReturnType<typeof getPaymentByOrderId>> | null = null;
          if (center && isTossPaymentsConfiguredForCenter(center.tossClientKey, center.tossSecretKey)) {
            actual = await getPaymentByOrderIdWithKey(orderId, center.tossSecretKey!);
          } else {
            const defaults = await getDefaultTossKeys();
            if (defaults.encryptedSecretKey) {
              actual = await getPaymentByOrderIdWithKey(orderId, defaults.encryptedSecretKey);
            } else if (isTossPaymentsConfigured()) {
              actual = await getPaymentByOrderId(orderId);
            }
          }

          if (actual && actual.status === "DONE") {
            const finalizeResult = await finalizePaidNotificationByOrder(
              orderId,
              actual.paymentKey || paymentKey,
              actual.totalAmount || amount,
              "confirm-fallback",
            );
            if (finalizeResult.ok) {
              console.log(`[PAYMENT][confirm] recovered via status check for order ${orderId} (Toss=DONE).`);
              return res.json({
                success: true,
                payment: actual,
                redirectedTo: finalizeResult.redirectedFrom ? finalizeResult.targetId : undefined,
              });
            }
          }
        }
      } catch (fallbackErr) {
        console.error("[PAYMENT][confirm] fallback status check failed:", fallbackErr);
      }
      res.status(500).json({ 
        error: error.message || "결제 확인에 실패했습니다" 
      });
    }
  });

  // Toss Payments 웹훅: 결제 상태 변경을 서버로 직접 통지받아, 사용자가 결과 화면으로
  // 돌아오지 못해도 결제완료 기록이 누락되지 않도록 한다.
  // (각 센터의 토스 대시보드 > 웹훅에 이 URL 등록 필요: https://<도메인>/api/payments/toss-webhook)
  app.post("/api/payments/toss-webhook", async (req, res) => {
    try {
      const body: any = req.body || {};
      const data: any = body.data || body;
      const orderId: string | undefined = data.orderId;
      const status: string | undefined = data.status;
      const paymentKey: string | undefined = data.paymentKey;

      if (!orderId) {
        return res.status(200).json({ received: true, ignored: "no_orderId" });
      }
      // DONE(결제완료) 이벤트만 처리. 그 외 상태는 무시(가상계좌 입금대기 등).
      if (status && status !== "DONE") {
        return res.status(200).json({ received: true, ignored: `status_${status}` });
      }

      const notification = await storage.getTuitionNotificationByOrderId(orderId);
      if (!notification) {
        return res.status(200).json({ received: true, ignored: "notif_not_found" });
      }

      // 위변조 방지: 웹훅 본문을 신뢰하지 않고 토스에서 직접 결제 상태를 재조회해 DONE 인지 확인.
      const order = await fetchTossOrderForCenter(orderId, notification.centerId || null);
      if (!order || order.status !== "DONE") {
        return res.status(200).json({ received: true, ignored: "not_done_on_toss" });
      }

      const result = await finalizePaidNotificationByOrder(
        orderId,
        order.paymentKey || paymentKey || "",
        order.totalAmount,
        "webhook",
      );
      return res.status(200).json({ received: true, ok: result.ok });
    } catch (error: any) {
      console.error("[PAYMENT][webhook] error:", error?.message || error);
      // 200으로 응답: 실패해도 주기적 대사(reconcile)가 보정하므로 안전.
      return res.status(200).json({ received: true, error: true });
    }
  });

  // 결제 시작(orderId 존재)했지만 pending 인 건을 토스에 직접 조회해 DONE 이면 결제완료로 보정.
  // 사용자 화면 복귀 실패/웹훅 누락 등으로 누락된 결제를 자동 복구하는 안전망.
  async function runTuitionPaymentReconciliation(source: string): Promise<{ checked: number; fixed: number }> {
    let checked = 0;
    let fixed = 0;
    try {
      const pending = await storage.getPendingTuitionNotificationsWithOrderId();
      const cutoff = Date.now() - 45 * 24 * 60 * 60 * 1000; // 최근 45일만 점검
      for (const n of pending) {
        if (!n.tossOrderId) continue;
        if (n.createdAt && new Date(n.createdAt).getTime() < cutoff) continue;
        checked++;
        const order = await fetchTossOrderForCenter(n.tossOrderId, n.centerId || null);
        if (!order) {
          console.warn(`[PAYMENT-RECONCILE][${source}] order not found on Toss: notif=${n.id} order=${n.tossOrderId} center=${n.centerId}`);
          continue;
        }
        if (order.status !== "DONE") {
          console.log(`[PAYMENT-RECONCILE][${source}] skip (status=${order.status}): notif=${n.id} order=${n.tossOrderId}`);
          continue;
        }
        const expected = (n.sentAmount || 0) + (n.textbookTotal || 0);
        if (order.totalAmount !== expected) {
          console.warn(`[PAYMENT-RECONCILE][${source}] amount mismatch: notif=${n.id} order=${n.tossOrderId} tossAmount=${order.totalAmount} expected=${expected} (sent=${n.sentAmount} textbook=${n.textbookTotal})`);
          continue;
        }
        const r = await finalizePaidNotificationByOrder(
          n.tossOrderId,
          order.paymentKey,
          order.totalAmount,
          source,
        );
        if (r.ok && !r.alreadyPaid) {
          fixed++;
        } else if (!r.ok) {
          console.warn(`[PAYMENT-RECONCILE][${source}] finalize failed (${r.reason}): notif=${n.id} order=${n.tossOrderId}`);
        }
      }
      if (fixed > 0 || source === "manual") {
        console.log(`[PAYMENT-RECONCILE][${source}] checked=${checked}, fixed=${fixed}`);
      }
    } catch (e: any) {
      console.error("[PAYMENT-RECONCILE] error:", e?.message || e);
    }
    return { checked, fixed };
  }

  // 관리자/원장이 즉시 결제 동기화를 실행 (현재 누락된 건 즉시 복구용)
  app.post("/api/payments/reconcile", async (req, res) => {
    try {
      const actorId = (req.body?.actorId || req.query.actorId) as string;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const actor = await storage.getUser(actorId);
      if (!actor || (actor.role !== UserRole.ADMIN && actor.role !== UserRole.PRINCIPAL)) {
        return res.status(403).json({ error: "관리자 또는 원장만 실행할 수 있습니다" });
      }
      const result = await runTuitionPaymentReconciliation("manual");
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("[PAYMENT][reconcile] manual error:", error);
      res.status(500).json({ error: "결제 동기화에 실패했습니다" });
    }
  });

  // 주기적 대사 스케줄러 (10분마다) + 서버 기동 30초 후 1회
  setInterval(() => { runTuitionPaymentReconciliation("scheduled"); }, 10 * 60 * 1000);
  setTimeout(() => { runTuitionPaymentReconciliation("startup"); }, 30 * 1000);
  console.log("[PAYMENT-RECONCILE] Scheduler started (every 10 minutes)");

  // Notifications API
  app.get("/api/notifications", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const notifications = await storage.getNotifications(userId);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to get notifications" });
    }
  });

  app.get("/api/notifications/unread-count", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ error: "Failed to get notification count" });
    }
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      await storage.markNotificationAsRead(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.post("/api/notifications/mark-all-read", async (req, res) => {
    try {
      const userId = req.body.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      await storage.deleteNotification(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete notification" });
    }
  });

  // Get homework due reminders for students
  app.get("/api/notifications/homework-reminders", async (req, res) => {
    try {
      const studentId = req.query.studentId as string;
      if (!studentId) {
        return res.status(400).json({ error: "studentId is required" });
      }
      
      const today = getKoreanToday();
      const homeworkList = await storage.getStudentHomework(studentId);
      const submissions = await storage.getStudentSubmissions(studentId);
      
      // Filter homework due today that hasn't been submitted
      const dueToday = homeworkList.filter(hw => {
        const isToday = hw.dueDate === today;
        const submission = submissions.find(s => s.homeworkId === hw.id);
        const notSubmitted = !submission || (submission.status !== "submitted" && submission.status !== "reviewed");
        return isToday && notSubmitted;
      });
      
      res.json(dueToday);
    } catch (error) {
      res.status(500).json({ error: "Failed to get homework reminders" });
    }
  });

  // ===== Web Push Notification APIs =====
  
  app.get("/api/push/vapid-public-key", async (_req, res) => {
    try {
      const publicKey = process.env.VAPID_PUBLIC_KEY || "";
      if (!publicKey) {
        console.error("[WebPush] VAPID_PUBLIC_KEY environment variable not set");
        return res.status(503).json({ error: "Push notifications not configured", publicKey: "" });
      }
      res.json({ publicKey });
    } catch (error) {
      res.status(500).json({ error: "Failed to get VAPID public key" });
    }
  });

  app.post("/api/push/subscribe", async (req, res) => {
    try {
      const { userId, centerId, subscription, userAgent } = req.body;
      console.log(`[WebPush] Subscribe request - userId: ${userId}, centerId: ${centerId}, hasEndpoint: ${!!subscription?.endpoint}`);
      if (!userId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        console.error("[WebPush] Subscribe failed - missing fields:", { userId: !!userId, endpoint: !!subscription?.endpoint, p256dh: !!subscription?.keys?.p256dh, auth: !!subscription?.keys?.auth });
        return res.status(400).json({ error: "Missing required fields" });
      }
      const result = await storage.createPushSubscription({
        userId,
        centerId: centerId || null,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent || null,
      });
      console.log(`[WebPush] Subscribe success - id: ${result.id}, userId: ${userId}`);
      res.json({ success: true, id: result.id });
    } catch (error) {
      console.error("[WebPush] Subscribe error:", error);
      res.status(500).json({ error: "Failed to save push subscription" });
    }
  });

  app.post("/api/push/unsubscribe", async (req, res) => {
    try {
      const { endpoint } = req.body;
      if (!endpoint) {
        return res.status(400).json({ error: "endpoint is required" });
      }
      await storage.deletePushSubscriptionByEndpoint(endpoint);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to unsubscribe" });
    }
  });

  app.get("/api/push/status", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const subs = await storage.getPushSubscriptionsByUser(userId);
      console.log(`[WebPush] Status check - userId: ${userId}, subscriptions: ${subs.length}`);
      res.json({ subscriptions: subs.length, devices: subs.map(s => ({ id: s.id, userAgent: s.userAgent, lastUsedAt: s.lastUsedAt })) });
    } catch (error) {
      console.error("[WebPush] Status error:", error);
      res.status(500).json({ error: "Failed to get push status" });
    }
  });

  app.post("/api/push/test", async (req, res) => {
    try {
      const { userId } = req.body;
      console.log(`[WebPush] Test notification requested for userId: ${userId}`);
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const { sendPushNotification } = await import("./services/web-push");
      const result = await sendPushNotification(userId, {
        title: "🔔 테스트 알림",
        body: "웹 푸시 알림이 정상적으로 작동합니다!",
        url: "/",
        tag: "test",
      });
      console.log(`[WebPush] Test result for userId ${userId}: sent=${result.sent}, failed=${result.failed}`);
      if (result.sent === 0 && result.failed === 0) {
        res.json({ success: false, message: "등록된 기기가 없습니다.", ...result });
      } else if (result.sent === 0) {
        res.json({ success: false, message: "발송에 실패했습니다.", ...result });
      } else {
        res.json({ success: true, ...result });
      }
    } catch (error: any) {
      console.error("[WebPush] Test error:", error);
      res.status(500).json({ error: "Failed to send test push", message: error?.message });
    }
  });

  // Dashboard Analytics APIs
  
  // Get monthly student trends for admin/principal dashboard
  app.get("/api/dashboard/student-trends", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      const actorId = req.query.actorId as string;
      
      if (!centerId || !actorId) {
        return res.status(400).json({ error: "centerId and actorId are required" });
      }
      
      // Verify actor is admin or principal
      const actor = await storage.getUser(actorId);
      if (!actor || (actor.role !== 3 && actor.role !== 4)) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }
      
      // Optimized: only load students in this specific center
      const centerUsers = await storage.getCenterUsers(centerId, UserRole.STUDENT);
      const studentsInCenter = centerUsers;
      
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // 1-indexed month
      
      // Build actual monthly counts based on createdAt timestamps
      // Count students that existed at the end of each month
      const getStudentCountAtMonth = (year: number, month: number): number => {
        const endOfMonth = new Date(year, month, 0, 23, 59, 59);
        return studentsInCenter.filter(s => {
          const createdAt = s.createdAt ? new Date(s.createdAt) : new Date(0);
          return createdAt <= endOfMonth;
        }).length;
      };
      
      // Check if we have any students from last year
      const lastYear = currentYear - 1;
      const hasLastYearData = studentsInCenter.some(s => {
        const createdAt = s.createdAt ? new Date(s.createdAt) : new Date(0);
        return createdAt.getFullYear() <= lastYear;
      });
      
      // Generate monthly data for current year (January to current month only)
      const monthlyData = [];
      for (let month = 1; month <= currentMonth; month++) {
        const count = getStudentCountAtMonth(currentYear, month);
        const lastYearCount = hasLastYearData ? getStudentCountAtMonth(lastYear, month) : 0;
        
        monthlyData.push({
          month,
          year: currentYear,
          label: `${month}월`,
          count,
          lastYearCount: hasLastYearData ? lastYearCount : null,
          delta: hasLastYearData ? count - lastYearCount : 0,
          deltaPercent: hasLastYearData && lastYearCount > 0 
            ? Math.round((count - lastYearCount) / lastYearCount * 100) 
            : 0
        });
      }
      
      res.json({
        currentTotal: studentsInCenter.length,
        currentYear,
        lastYear,
        hasLastYearData,
        monthlyData,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Get student trends error:", error);
      res.status(500).json({ error: "Failed to get student trends" });
    }
  });

  // Teacher APIs
  
  // Get teachers for a center (for homeroom assignment dropdown)
  app.get("/api/teachers", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      if (!centerId) {
        return res.status(400).json({ error: "Center ID required" });
      }
      
      // Optimized: only load users belonging to this center
      const centerUsers = await storage.getCenterUsers(centerId);
      
      // Filter to staff (teachers, clinic teachers, principals, admin)
      const staff = centerUsers.filter(u => u.role >= UserRole.TEACHER);
      
      res.json(staff);
    } catch (error) {
      console.error("Get teachers error:", error);
      res.status(500).json({ error: "Failed to get teachers" });
    }
  });

  app.get("/api/teachers/:id/stats", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      if (!centerId) {
        return res.status(400).json({ error: "Center ID required" });
      }

      const teacherId = req.params.id;
      const teacher = await storage.getUser(teacherId);
      const classes = await storage.getClasses(centerId);
      const teacherClasses = classes.filter((c) => c.teacherId === teacherId);
      
      const today = new Date();
      const dayMap: Record<number, string> = {
        0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat"
      };
      const todayDay = dayMap[today.getDay()];
      const todayClasses = teacherClasses.filter((c) => c.days.includes(todayDay)).length;

      // Get unique students based on role
      const studentIds = new Set<string>();
      
      if (teacher?.role === UserRole.CLINIC_TEACHER) {
        // For clinic_teacher, get homeroom students only
        const centerUsers = await storage.getCenterUsers(centerId);
        for (const user of centerUsers) {
          if (user.role === UserRole.STUDENT && user.homeroomTeacherId === teacherId) {
            studentIds.add(user.id);
          }
        }
      } else {
        // For regular teachers, get students enrolled in their classes
        for (const cls of teacherClasses) {
          const classEnrollments = await storage.getClassEnrollments(cls.id);
          classEnrollments.forEach((e) => studentIds.add(e.studentId));
        }
      }
      const totalStudents = studentIds.size;

      // Filter submissions to only include relevant students
      const submissions = await storage.getSubmissionsByCenter(centerId);
      const pendingReviews = submissions.filter(
        (s) => s.status === "submitted" && studentIds.has(s.studentId)
      ).length;

      const assessmentClasses = teacherClasses.filter((c) => c.classType === "assessment").length;

      res.json({
        todayClasses,
        pendingReviews,
        totalStudents,
        pendingAssessments: assessmentClasses,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  app.get("/api/teachers/:id/students", async (req, res) => {
    try {
      const teacherId = req.params.id;
      const teacher = await storage.getUser(teacherId);
      if (!teacher) {
        return res.status(404).json({ error: "Teacher not found" });
      }

      const centers = await storage.getUserCenters(teacherId);
      const studentMap = new Map<string, any>();

      for (const center of centers) {
        const classes = await storage.getClasses(center.id);
        const teacherClasses = classes.filter((c) => c.teacherId === teacherId);

        for (const cls of teacherClasses) {
          const classEnrollments = await storage.getClassEnrollments(cls.id);
          for (const enrollment of classEnrollments) {
            if (!studentMap.has(enrollment.studentId)) {
              const student = await storage.getUser(enrollment.studentId);
              if (student) {
                studentMap.set(enrollment.studentId, student);
              }
            }
          }
        }
      }

      res.json(Array.from(studentMap.values()));
    } catch (error) {
      res.status(500).json({ error: "Failed to get teacher's students" });
    }
  });

  app.get("/api/teachers/:id/submissions/recent", async (req, res) => {
    try {
      const teacherId = req.params.id;
      const user = await storage.getUser(teacherId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const centers = await storage.getUserCenters(user.id);
      
      const teacherStudentIds = new Set<string>();
      
      // For clinic_teacher role, only show homeroom students' submissions
      if (user.role === UserRole.CLINIC_TEACHER) {
        // Get students where this teacher is the homeroom teacher
        for (const center of centers) {
          const allUsers = await storage.getUsers();
          const centerUsers = await storage.getUserCenters(user.id);
          const centerIds = centerUsers.map(c => c.id);
          
          for (const student of allUsers) {
            if (student.role === UserRole.STUDENT && student.homeroomTeacherId === teacherId) {
              // Check if student belongs to any of teacher's centers
              const studentCenters = await storage.getUserCenters(student.id);
              if (studentCenters.some(sc => centerIds.includes(sc.id))) {
                teacherStudentIds.add(student.id);
              }
            }
          }
        }
      } else {
        // For regular teachers, get students from their classes
        for (const center of centers) {
          const classes = await storage.getClasses(center.id);
          const teacherClasses = classes.filter((c) => c.teacherId === teacherId);
          for (const cls of teacherClasses) {
            const enrollments = await storage.getClassEnrollments(cls.id);
            enrollments.forEach((e) => teacherStudentIds.add(e.studentId));
          }
        }
      }

      const allSubmissions: any[] = [];
      for (const center of centers) {
        const submissions = await storage.getSubmissionsByCenter(center.id);
        allSubmissions.push(...submissions);
      }

      const recent = allSubmissions
        .filter((s) => s.status === "submitted" && teacherStudentIds.has(s.studentId))
        .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime())
        .slice(0, 10);

      res.json(recent);
    } catch (error) {
      res.status(500).json({ error: "Failed to get submissions" });
    }
  });

  // Homework
  app.get("/api/homework", async (req, res) => {
    try {
      const centerId = req.query.centerId as string | undefined;
      if (centerId) {
        // Validate center exists
        const center = await storage.getCenter(centerId);
        if (!center) {
          return res.json([]); // Return empty array for invalid center
        }
        const homework = await storage.getHomeworkByCenter(centerId);
        res.json(homework);
      } else {
        res.json([]);
      }
    } catch (error: any) {
      console.error("[GET homework] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to get homework", details: error?.message });
    }
  });

  app.post("/api/homework", async (req, res) => {
    try {
      const homework = await storage.createHomework(req.body);
      res.json(homework);
    } catch (error) {
      res.status(500).json({ error: "Failed to create homework" });
    }
  });

  // Bulk homework creation for multiple students
  app.post("/api/homework/bulk", async (req, res) => {
    try {
      const { studentIds, ...homeworkData } = req.body;
      if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({ error: "studentIds array is required" });
      }
      
      const createdHomework = [];
      for (const studentId of studentIds) {
        const homework = await storage.createHomework({
          ...homeworkData,
          studentId,
        });
        createdHomework.push(homework);
      }
      
      res.json(createdHomework);
    } catch (error) {
      console.error("Failed to create bulk homework:", error);
      res.status(500).json({ error: "Failed to create bulk homework" });
    }
  });

  app.patch("/api/homework/:id", async (req, res) => {
    try {
      const homework = await storage.updateHomework(req.params.id, req.body);
      res.json(homework);
    } catch (error) {
      res.status(500).json({ error: "Failed to update homework" });
    }
  });

  app.delete("/api/homework/:id", async (req, res) => {
    try {
      await storage.deleteHomework(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete homework" });
    }
  });

  app.get("/api/homework/:id/unsubmitted", async (req, res) => {
    try {
      const homework = await storage.getHomework(req.params.id);
      if (!homework) {
        return res.status(404).json({ error: "Homework not found" });
      }
      
      const classData = await storage.getClass(homework.classId);
      const classStudents = await storage.getClassStudents(homework.classId);
      const allSubmissions = await storage.getSubmissionsByCenter(classData?.centerId || "");
      
      const homeworkSubmissions = allSubmissions.filter((s: any) => s.homeworkId === homework.id);
      const submittedStudentIds = new Set(homeworkSubmissions.map((s: any) => s.studentId));
      
      const unsubmittedStudents = classStudents.filter((s: any) => !submittedStudentIds.has(s.id));
      
      res.json(unsubmittedStudents);
    } catch (error) {
      console.error("Failed to get unsubmitted students:", error);
      res.status(500).json({ error: "Failed to get unsubmitted students" });
    }
  });

  app.get("/api/homework/submissions", async (req, res) => {
    try {
      const centerId = req.query.centerId as string | undefined;
      if (centerId) {
        const submissions = await storage.getSubmissionsByCenter(centerId);
        res.json(submissions);
      } else {
        res.json([]);
      }
    } catch (error: any) {
      console.error("[GET submissions] Error:", error?.message || error, error?.stack);
      res.status(500).json({ error: "Failed to get submissions", details: error?.message });
    }
  });

  app.post("/api/homework-submissions", async (req, res) => {
    try {
      const { homeworkId, studentId, status, photos } = req.body;
      console.log(`[HomeworkSubmission] POST - homeworkId: ${homeworkId}, studentId: ${studentId}, status: ${status}, photos: ${photos?.length || 0}`);
      
      // Check if submission already exists for this homework and student
      const existingSubmission = await storage.getSubmissionByHomeworkAndStudent(homeworkId, studentId);
      console.log(`[HomeworkSubmission] Existing submission: ${existingSubmission?.id || 'none'}`);
      
      if (existingSubmission) {
        // Update existing submission instead of creating duplicate
        const updated = await storage.updateSubmission(existingSubmission.id, req.body);
        console.log(`[HomeworkSubmission] Updated existing submission: ${updated.id}`);
        
        // If status changed to submitted, notify teacher/principal
        if (status === "submitted" && existingSubmission.status !== "submitted") {
          await createHomeworkSubmissionNotifications(homeworkId, studentId);
        }
        
        return res.json(updated);
      }
      
      const submission = await storage.createSubmission(req.body);
      console.log(`[HomeworkSubmission] Created new submission: ${submission.id}`);
      
      // If submitted, notify teacher/principal
      if (status === "submitted") {
        await createHomeworkSubmissionNotifications(homeworkId, studentId);
      }
      
      res.json(submission);
    } catch (error: any) {
      console.error("[HomeworkSubmission] Failed to create submission:", error?.message, error?.stack);
      res.status(500).json({ error: "Failed to create submission", details: error?.message });
    }
  });

  app.patch("/api/homework-submissions/:id", async (req, res) => {
    try {
      const { status, photos } = req.body;
      console.log(`[HomeworkSubmission] PATCH - id: ${req.params.id}, status: ${status}, photos: ${photos?.length || 0}`);
      
      // Get existing submission to check status change
      const existingSubmission = await storage.getSubmission(req.params.id);
      console.log(`[HomeworkSubmission] Existing status: ${existingSubmission?.status}`);
      
      const submission = await storage.updateSubmission(req.params.id, req.body);
      console.log(`[HomeworkSubmission] Updated submission: ${submission.id}, new status: ${submission.status}`);
      
      // If status changed to submitted, notify teacher/principal
      if (req.body.status === "submitted" && existingSubmission?.status !== "submitted") {
        await createHomeworkSubmissionNotifications(submission.homeworkId, submission.studentId);
      }
      
      res.json(submission);
    } catch (error: any) {
      console.error(`[HomeworkSubmission] PATCH Error for ID ${req.params.id}:`, error?.message, error?.stack);
      res.status(500).json({ error: "Failed to update submission", details: error?.message });
    }
  });

  // Get photos for a specific submission (loaded separately to reduce memory usage)
  app.get("/api/homework-submissions/:id/photos", async (req, res) => {
    try {
      const photos = await storage.getSubmissionPhotos(req.params.id);
      res.json({ photos });
    } catch (error: any) {
      console.error(`[GET submission photos] Error for ID ${req.params.id}:`, error?.message || error);
      res.status(500).json({ error: "Failed to get photos", details: error?.message });
    }
  });

  // Helper function to create notifications for homework submission
  async function createHomeworkSubmissionNotifications(homeworkId: string, studentId: string) {
    try {
      const homework = await storage.getHomework(homeworkId);
      const student = await storage.getUser(studentId);
      
      if (!homework || !student) return;
      
      const classInfo = await storage.getClass(homework.classId);
      if (!classInfo) return;

      // Collect unique recipient ids so a user who is both the class teacher
      // and a principal/admin (cumulative roles) is only notified once.
      const recipientIds = new Set<string>();

      if (classInfo.teacherId) {
        const teacher = await storage.getUser(classInfo.teacherId);
        if (teacher) recipientIds.add(teacher.id);
      }

      const centerUsers = await storage.getCenterUsers(classInfo.centerId);
      const principals = centerUsers.filter(u => u.role === UserRole.PRINCIPAL || u.role === UserRole.ADMIN);
      for (const principal of principals) {
        recipientIds.add(principal.id);
      }

      for (const userId of recipientIds) {
        await storage.createNotification({
          userId,
          type: "homework_submitted",
          title: "숙제 제출",
          message: `${student.name} 학생이 "${homework.title}" 숙제를 제출했습니다.`,
          relatedId: homeworkId,
          relatedType: "homework",
        });
      }
    } catch (error) {
      console.error("Failed to create homework submission notifications:", error);
    }
  }

  // Assessments
  app.get("/api/assessments", async (req, res) => {
    try {
      const centerId = req.query.centerId as string | undefined;
      if (centerId) {
        const assessments = await storage.getAssessmentsByCenter(centerId);
        res.json(assessments);
      } else {
        res.json([]);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to get assessments" });
    }
  });

  app.post("/api/assessments/bulk", async (req, res) => {
    try {
      const { assessments } = req.body;
      const created = await storage.createAssessments(assessments);
      res.json(created);
    } catch (error) {
      res.status(500).json({ error: "Failed to create assessments" });
    }
  });

  app.patch("/api/assessments/:id", async (req, res) => {
    try {
      const { score, maxScore, actorId } = req.body;
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }

      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 평가 점수를 수정할 수 있습니다" });
      }

      const updated = await storage.updateAssessment(req.params.id, { score, maxScore });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update assessment" });
    }
  });

  app.delete("/api/assessments/:id", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }

      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 평가 점수를 삭제할 수 있습니다" });
      }

      await storage.deleteAssessment(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete assessment" });
    }
  });

  // Class Videos
  app.get("/api/class-videos", async (req, res) => {
    try {
      const centerId = req.query.centerId as string | undefined;
      const videos = await storage.getClassVideos(centerId);
      res.json(videos);
    } catch (error) {
      res.status(500).json({ error: "Failed to get videos" });
    }
  });

  app.post("/api/class-videos", async (req, res) => {
    try {
      const video = await storage.createClassVideo(req.body);
      res.json(video);
    } catch (error) {
      res.status(500).json({ error: "Failed to create video" });
    }
  });

  app.patch("/api/class-videos/:id", async (req, res) => {
    try {
      const video = await storage.updateClassVideo(req.params.id, req.body);
      res.json(video);
    } catch (error) {
      res.status(500).json({ error: "Failed to update video" });
    }
  });

  app.delete("/api/class-videos/:id", async (req, res) => {
    try {
      await storage.deleteClassVideo(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete video" });
    }
  });

  // Textbooks
  app.get("/api/textbooks", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      const textbooks = await storage.getTextbooks(centerId);
      res.json(textbooks);
    } catch (error) {
      res.status(500).json({ error: "Failed to get textbooks" });
    }
  });

  // 교재 표지 이미지 서버 경유 R2 업로드 (presigned URL CORS 문제 해결)
  app.post("/api/textbooks/upload-cover", clinicUpload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "파일이 없습니다" });
      }

      if (!isR2Configured()) {
        return res.status(503).json({ error: "R2 저장소가 설정되지 않았습니다" });
      }

      const centerId = req.body.centerId || "default";
      const ext = file.originalname.split('.').pop()?.toLowerCase() || "jpg";
      const objectKey = `centers/${centerId}/textbooks/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;

      const publicUrl = await uploadBuffer(file.buffer, objectKey, file.mimetype);
      console.log(`[TEXTBOOK] Cover uploaded to R2 - objectKey: ${objectKey}`);

      res.json({ objectPath: objectKey, publicUrl });
    } catch (error: any) {
      console.error("[TEXTBOOK] Cover upload failed:", error?.message, error?.stack);
      res.status(500).json({ error: "이미지 업로드에 실패했습니다", details: error?.message });
    }
  });

  app.post("/api/textbooks", async (req, res) => {
    try {
      console.log("[TEXTBOOK] Creating textbook:", JSON.stringify(req.body));
      const textbook = await storage.createTextbook(req.body);
      console.log("[TEXTBOOK] Created successfully:", textbook.id);
      res.json(textbook);
    } catch (error: any) {
      console.error("[TEXTBOOK] Failed to create:", error?.message, error?.stack);
      res.status(500).json({ error: "Failed to create textbook", details: error?.message });
    }
  });

  app.patch("/api/textbooks/:id", async (req, res) => {
    try {
      const textbook = await storage.updateTextbook(req.params.id, req.body);
      res.json(textbook);
    } catch (error) {
      res.status(500).json({ error: "Failed to update textbook" });
    }
  });

  app.delete("/api/textbooks/:id", async (req, res) => {
    try {
      await storage.deleteTextbook(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete textbook" });
    }
  });

  // Textbook Videos
  app.get("/api/textbook-videos/:textbookId", async (req, res) => {
    try {
      const videos = await storage.getTextbookVideos(req.params.textbookId);
      res.json(videos);
    } catch (error) {
      res.status(500).json({ error: "Failed to get textbook videos" });
    }
  });

  app.post("/api/textbook-videos", async (req, res) => {
    try {
      console.log("[TEXTBOOK-VIDEO] Creating video:", JSON.stringify(req.body));
      const video = await storage.createTextbookVideo(req.body);
      console.log("[TEXTBOOK-VIDEO] Created successfully:", video.id);
      res.json(video);
    } catch (error: any) {
      console.error("[TEXTBOOK-VIDEO] Failed to create:", error?.message, error?.stack);
      res.status(500).json({ error: "Failed to create textbook video", details: error?.message });
    }
  });

  app.patch("/api/textbook-videos/:id", async (req, res) => {
    try {
      const video = await storage.updateTextbookVideo(req.params.id, req.body);
      res.json(video);
    } catch (error) {
      res.status(500).json({ error: "Failed to update textbook video" });
    }
  });

  app.delete("/api/textbook-videos/:id", async (req, res) => {
    try {
      await storage.deleteTextbookVideo(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete textbook video" });
    }
  });

  // ========== CLINIC ROUTES ==========

  // Get clinic assignments
  app.get("/api/clinic-assignments", async (req, res) => {
    try {
      const { centerId, regularTeacherId, clinicTeacherId, studentId } = req.query;
      const assignments = await storage.getClinicAssignments({
        centerId: centerId as string | undefined,
        regularTeacherId: regularTeacherId as string | undefined,
        clinicTeacherId: clinicTeacherId as string | undefined,
        studentId: studentId as string | undefined,
      });
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ error: "Failed to get clinic assignments" });
    }
  });

  // Get single clinic assignment
  app.get("/api/clinic-assignments/:id", async (req, res) => {
    try {
      const assignment = await storage.getClinicAssignment(req.params.id);
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      res.json(assignment);
    } catch (error) {
      res.status(500).json({ error: "Failed to get clinic assignment" });
    }
  });

  // Create clinic assignment with steps
  app.post("/api/clinic-assignments", async (req, res) => {
    try {
      const { steps, ...assignmentData } = req.body;
      const assignment = await storage.createClinicAssignment(assignmentData);
      
      if (steps && Array.isArray(steps)) {
        for (let i = 0; i < steps.length; i++) {
          await storage.createClinicAssignmentStep({
            assignmentId: assignment.id,
            stepOrder: i + 1,
            instruction: steps[i].instruction,
          });
        }
      }
      
      const fullAssignment = await storage.getClinicAssignment(assignment.id);
      res.json(fullAssignment);
    } catch (error) {
      console.error("Failed to create clinic assignment:", error);
      res.status(500).json({ error: "Failed to create clinic assignment" });
    }
  });

  // Update clinic assignment
  app.patch("/api/clinic-assignments/:id", async (req, res) => {
    try {
      const assignment = await storage.updateClinicAssignment(req.params.id, req.body);
      res.json(assignment);
    } catch (error) {
      res.status(500).json({ error: "Failed to update clinic assignment" });
    }
  });

  // Delete clinic assignment
  app.delete("/api/clinic-assignments/:id", async (req, res) => {
    try {
      await storage.deleteClinicAssignment(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete clinic assignment" });
    }
  });

  // Add step to clinic assignment
  app.post("/api/clinic-assignments/:id/steps", async (req, res) => {
    try {
      const step = await storage.createClinicAssignmentStep({
        ...req.body,
        assignmentId: req.params.id,
      });
      res.json(step);
    } catch (error) {
      res.status(500).json({ error: "Failed to create step" });
    }
  });

  // Update step
  app.patch("/api/clinic-steps/:id", async (req, res) => {
    try {
      const step = await storage.updateClinicAssignmentStep(req.params.id, req.body);
      res.json(step);
    } catch (error) {
      res.status(500).json({ error: "Failed to update step" });
    }
  });

  // Delete step
  app.delete("/api/clinic-steps/:id", async (req, res) => {
    try {
      await storage.deleteClinicAssignmentStep(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete step" });
    }
  });

  // Upload file for clinic assignment
  app.post("/api/clinic-assignments/:id/files", clinicUpload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const ext = path.extname(req.file.originalname).toLowerCase();
      const fileType = ext === ".pdf" ? "pdf" : "image";
      
      const file = await storage.createClinicAssignmentFile({
        assignmentId: req.params.id,
        stepId: req.body.stepId || null,
        fileName: req.file.originalname,
        filePath: `/uploads/clinic/${req.file.filename}`,
        fileType,
      });
      res.json(file);
    } catch (error) {
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Delete file
  app.delete("/api/clinic-files/:id", async (req, res) => {
    try {
      await storage.deleteClinicAssignmentFile(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // Add comment to clinic assignment
  app.post("/api/clinic-assignments/:id/comments", async (req, res) => {
    try {
      const comment = await storage.createClinicComment({
        ...req.body,
        assignmentId: req.params.id,
      });
      res.json(comment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  // Delete comment
  app.delete("/api/clinic-comments/:id", async (req, res) => {
    try {
      await storage.deleteClinicComment(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });

  // Get progress logs
  app.get("/api/clinic-assignments/:id/progress", async (req, res) => {
    try {
      const logs = await storage.getClinicProgressLogs(req.params.id);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to get progress logs" });
    }
  });

  // Add progress log
  app.post("/api/clinic-assignments/:id/progress", async (req, res) => {
    try {
      const log = await storage.createClinicProgressLog({
        ...req.body,
        assignmentId: req.params.id,
      });
      res.json(log);
    } catch (error) {
      res.status(500).json({ error: "Failed to create progress log" });
    }
  });

  // Update progress log
  app.patch("/api/clinic-progress/:id", async (req, res) => {
    try {
      const log = await storage.updateClinicProgressLog(req.params.id, req.body);
      res.json(log);
    } catch (error) {
      res.status(500).json({ error: "Failed to update progress log" });
    }
  });

  // ===== NEW CLINIC SYSTEM (Weekly Workflow) =====

  // Get clinic students by center
  app.get("/api/clinic-students", async (req, res) => {
    try {
      const { centerId } = req.query;
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      const students = await storage.getClinicStudents(centerId as string);
      res.json(students);
    } catch (error) {
      res.status(500).json({ error: "Failed to get clinic students" });
    }
  });

  // Get single clinic student
  app.get("/api/clinic-students/:id", async (req, res) => {
    try {
      const student = await storage.getClinicStudent(req.params.id);
      if (!student) {
        return res.status(404).json({ error: "Clinic student not found" });
      }
      res.json(student);
    } catch (error) {
      res.status(500).json({ error: "Failed to get clinic student" });
    }
  });

  // Create clinic student
  app.post("/api/clinic-students", async (req, res) => {
    try {
      const { period1Default, period2Default, period3Default, ...studentData } = req.body;
      
      // Ensure clinicDays is always an array (never null)
      if (!studentData.clinicDays) {
        studentData.clinicDays = [];
      }
      
      const student = await storage.createClinicStudent(studentData);
      
      // Create instruction defaults for each selected day if any period defaults are provided
      // Wrapped in try-catch to handle case where period1_default column doesn't exist in production
      if ((period1Default || period2Default || period3Default) && studentData.clinicDays?.length) {
        try {
          for (const day of studentData.clinicDays) {
            await storage.upsertClinicInstructionDefault({
              clinicStudentId: student.id,
              weekday: day,
              period1Default: period1Default || null,
              period2Default: period2Default || null,
              period3Default: period3Default || null,
            });
          }
        } catch (defaultsError) {
          // Log but don't fail - instruction defaults are optional
          console.warn("Failed to create instruction defaults (column may not exist):", defaultsError);
        }
      }
      
      res.json(student);
    } catch (error) {
      console.error("Failed to create clinic student:", error);
      res.status(500).json({ error: "Failed to create clinic student" });
    }
  });

  // Sync students enrolled in clinic classes to clinic_students table
  app.post("/api/clinic-students/sync", async (req, res) => {
    try {
      const { centerId } = req.body;
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }

      // Get all clinic-type classes in this center
      const allClasses = await storage.getClasses(centerId);
      const clinicClasses = allClasses.filter(c => c.classType === "high_clinic" || c.classType === "middle_clinic");

      let syncedCount = 0;

      for (const cls of clinicClasses) {
        // Get enrollments for this class
        const classEnrollments = await storage.getClassEnrollments(cls.id);
        const clinicType = cls.classType === "high_clinic" ? "high" : "middle";
        
        for (const enrollment of classEnrollments) {
          const existingClinicStudent = await storage.getClinicStudentByStudentCenterAndType(
            enrollment.studentId, 
            cls.centerId,
            clinicType
          );

          if (existingClinicStudent) {
            // Merge clinic days
            const existingDays = existingClinicStudent.clinicDays || [];
            const newDays = cls.days || [];
            const mergedDays = Array.from(new Set([...existingDays, ...newDays]));
            
            if (mergedDays.length > existingDays.length) {
              await storage.updateClinicStudent(existingClinicStudent.id, {
                clinicDays: mergedDays,
                isActive: true,
              });
              syncedCount++;
            }
          } else {
            // Get student info to auto-fill grade
            const studentInfo = await storage.getUser(enrollment.studentId);
            
            // Create new clinic student entry with empty teacher (shows as "미지정")
            await storage.createClinicStudent({
              studentId: enrollment.studentId,
              regularTeacherId: "", // Empty = shows as "미지정"
              clinicTeacherId: null,
              centerId: cls.centerId,
              clinicType: clinicType,
              grade: studentInfo?.grade || null, // Auto-fill grade from student profile
              classGroup: null, // 미등록 (unregistered)
              clinicDays: cls.days || [],
              defaultInstructions: "",
              isActive: true,
            });
            syncedCount++;
          }
        }
      }

      res.json({ success: true, syncedCount });
    } catch (error) {
      console.error("Failed to sync clinic students:", error);
      res.status(500).json({ error: "Failed to sync clinic students" });
    }
  });

  // Update clinic student
  app.patch("/api/clinic-students/:id", async (req, res) => {
    try {
      const student = await storage.updateClinicStudent(req.params.id, req.body);
      res.json(student);
    } catch (error) {
      res.status(500).json({ error: "Failed to update clinic student" });
    }
  });

  // Delete clinic student
  app.delete("/api/clinic-students/:id", async (req, res) => {
    try {
      await storage.deleteClinicStudent(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete clinic student" });
    }
  });

  // Get weekly records for a clinic student
  app.get("/api/clinic-weekly-records", async (req, res) => {
    try {
      const { clinicStudentId, centerId, weekStartDate, year, month } = req.query;
      
      // Month-based fetching (for viewing all records in a month)
      if (centerId && year && month) {
        const records = await storage.getClinicWeeklyRecordsByMonth(
          centerId as string,
          parseInt(year as string),
          parseInt(month as string)
        );
        return res.json(records);
      }
      
      // Week-based fetching (legacy, for specific week)
      if (centerId && weekStartDate) {
        const records = await storage.getClinicWeeklyRecordsByCenter(
          centerId as string,
          weekStartDate as string
        );
        return res.json(records);
      }
      
      if (clinicStudentId) {
        const records = await storage.getClinicWeeklyRecords(
          clinicStudentId as string,
          weekStartDate as string | undefined
        );
        return res.json(records);
      }
      
      res.status(400).json({ error: "clinicStudentId or centerId is required" });
    } catch (error) {
      res.status(500).json({ error: "Failed to get weekly records" });
    }
  });

  // Get single weekly record
  app.get("/api/clinic-weekly-records/:id", async (req, res) => {
    try {
      const record = await storage.getClinicWeeklyRecord(req.params.id);
      if (!record) {
        return res.status(404).json({ error: "Weekly record not found" });
      }
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to get weekly record" });
    }
  });

  // Create weekly record
  app.post("/api/clinic-weekly-records", async (req, res) => {
    try {
      const { clinicStudentId, centerId, weekStartDate } = req.body;
      
      // Validate that the clinic student exists and belongs to the specified center
      let clinicStudent = null;
      if (clinicStudentId) {
        clinicStudent = await storage.getClinicStudent(clinicStudentId);
        if (!clinicStudent) {
          return res.status(404).json({ error: "Clinic student not found" });
        }
        if (centerId && clinicStudent.centerId !== centerId) {
          return res.status(403).json({ error: "Clinic student does not belong to the specified center" });
        }
      }
      
      let carryOverData: any = {};
      if (clinicStudentId && weekStartDate) {
        const currentDate = new Date(weekStartDate);
        const previousWeekDate = new Date(currentDate);
        previousWeekDate.setDate(previousWeekDate.getDate() - 7);
        const previousWeekStartDate = previousWeekDate.toISOString().split('T')[0];
        
        const previousRecords = await storage.getClinicWeeklyRecords(clinicStudentId, previousWeekStartDate);
        if (previousRecords.length > 0) {
          const prev = previousRecords[0];
          carryOverData = {
            weeklyEvaluation: prev.weeklyEvaluation || null,
            period2Instruction: prev.period2Instruction || null,
            period3Instruction: prev.period3Instruction || null,
            clinicTeacherNotes: prev.clinicTeacherNotes || null,
          };
        }
      }
      
      const record = await storage.createClinicWeeklyRecord({
        ...carryOverData,
        ...req.body,
      });
      res.json(record);
    } catch (error: any) {
      console.error("Failed to create weekly record:", error);
      res.status(500).json({ error: "Failed to create weekly record", details: error?.message });
    }
  });

  // Update weekly record
  app.patch("/api/clinic-weekly-records/:id", async (req, res) => {
    try {
      const record = await storage.updateClinicWeeklyRecord(req.params.id, req.body);
      res.json(record);
    } catch (error: any) {
      console.error("Failed to update weekly record:", error);
      res.status(500).json({ error: "Failed to update weekly record", details: error?.message });
    }
  });

  // Delete weekly record
  app.delete("/api/clinic-weekly-records/:id", async (req, res) => {
    try {
      await storage.deleteClinicWeeklyRecord(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete weekly record" });
    }
  });

  // Upload file for weekly record
  app.post("/api/clinic-weekly-records/:id/file", clinicUpload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      // Verify the record exists before updating
      const existingRecord = await storage.getClinicWeeklyRecord(req.params.id);
      if (!existingRecord) {
        return res.status(404).json({ error: "Weekly record not found" });
      }
      
      const record = await storage.updateClinicWeeklyRecord(req.params.id, {
        filePath: `/uploads/clinic/${file.filename}`,
        fileName: file.originalname,
      });
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Batch create weekly records for all clinic students (for a specific week)
  app.post("/api/clinic-weekly-records/batch", async (req, res) => {
    try {
      const { centerId, weekStartDate } = req.body;
      if (!centerId || !weekStartDate) {
        return res.status(400).json({ error: "centerId and weekStartDate are required" });
      }

      const clinicStudentsList = await storage.getClinicStudents(centerId);
      const existingRecords = await storage.getClinicWeeklyRecordsByCenter(centerId, weekStartDate);
      const existingClinicStudentIds = new Set(existingRecords.map(r => r.clinicStudentId));

      // Get previous week's records to carry over all instructions
      const currentDate = new Date(weekStartDate);
      const previousWeekDate = new Date(currentDate);
      previousWeekDate.setDate(previousWeekDate.getDate() - 7);
      const previousWeekStartDate = previousWeekDate.toISOString().split('T')[0];
      
      const previousRecords = await storage.getClinicWeeklyRecordsByCenter(centerId, previousWeekStartDate);
      const previousRecordsMap = new Map(previousRecords.map(r => [r.clinicStudentId, r]));

      const newRecords = await Promise.all(
        clinicStudentsList
          .filter(cs => cs.isActive && !existingClinicStudentIds.has(cs.id))
          .map(cs => {
            const prev = previousRecordsMap.get(cs.id);
            return storage.createClinicWeeklyRecord({
              clinicStudentId: cs.id,
              weekStartDate,
              status: "pending",
              weeklyEvaluation: prev?.weeklyEvaluation || null,
              period2Instruction: prev?.period2Instruction || null,
              period3Instruction: prev?.period3Instruction || null,
              clinicTeacherNotes: prev?.clinicTeacherNotes || null,
            });
          })
      );

      // Auto-cleanup: Delete records older than 6 months (26 weeks)
      const sixMonthsAgo = new Date(currentDate);
      sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 182);
      const cutoffDate = sixMonthsAgo.toISOString().split('T')[0];
      
      try {
        const deletedCount = await storage.deleteOldClinicWeeklyRecords(centerId, cutoffDate);
        if (deletedCount > 0) {
        }
      } catch (cleanupError) {
        console.error("[CLINIC] Failed to cleanup old records:", cleanupError);
      }

      res.json({ created: newRecords.length, records: newRecords });
    } catch (error: any) {
      console.error("[CLINIC] Failed to batch create weekly records:", error);
      res.status(500).json({ error: "Failed to batch create weekly records", details: error?.message });
    }
  });

  // ===== Clinic Resources (자료 모음) =====
  app.get("/api/clinic-resources", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      const resources = await storage.getClinicResources(centerId);
      res.json(resources);
    } catch (error) {
      res.status(500).json({ error: "Failed to get clinic resources" });
    }
  });

  // Direct upload to R2 with presigned URL for faster uploads
  app.post("/api/clinic-resources/presigned-url", async (req, res) => {
    try {
      const { centerId, fileName, contentType } = req.body;
      if (!centerId || !fileName || !contentType) {
        return res.status(400).json({ error: "centerId, fileName, and contentType are required" });
      }

      if (!isR2Configured()) {
        return res.status(503).json({ error: "파일 저장소가 설정되지 않았습니다." });
      }

      const fileExt = path.extname(fileName).toLowerCase().replace('.', '');
      const uniqueId = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const objectKey = `clinic-resources/${centerId}/${uniqueId}.${fileExt}`;

      const { getPresignedUploadUrl } = await import("./r2-storage");
      const { uploadUrl, publicUrl } = await getPresignedUploadUrl(objectKey);

      res.json({ uploadUrl, objectKey, publicUrl });
    } catch (error: any) {
      console.error("[Clinic Resources] Failed to generate presigned URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Confirm upload after direct R2 upload
  app.post("/api/clinic-resources/confirm", async (req, res) => {
    try {
      const { centerId, classId, fileName, filePath, description, isPermanent, weekStartDate, uploadedById } = req.body;
      
      if (!centerId || !uploadedById || !fileName || !filePath) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const resource = await storage.createClinicResource({
        centerId,
        classId: classId || null,
        fileName,
        filePath,
        description: description || null,
        isPermanent: isPermanent === true || isPermanent === "true",
        weekStartDate: weekStartDate || null,
        uploadedById,
      });

      res.json(resource);
    } catch (error: any) {
      console.error("[Clinic Resources] Failed to confirm upload:", error);
      res.status(500).json({ error: "Failed to save file record" });
    }
  });

  // Legacy server-side upload (keeping for backward compatibility)
  app.post("/api/clinic-resources", clinicUpload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      
      const { centerId, description, isPermanent, weekStartDate, uploadedById } = req.body;
      
      if (!centerId || !uploadedById) {
        return res.status(400).json({ error: "centerId and uploadedById are required" });
      }

      // Decode Korean filename - try UTF-8 first, then latin1 to UTF-8 conversion
      let fileName = file.originalname;
      try {
        // Check if the filename appears to be latin1 encoded UTF-8
        const decoded = iconv.decode(Buffer.from(fileName, 'latin1'), 'utf-8');
        if (decoded && !decoded.includes('�')) {
          fileName = decoded;
        }
      } catch (e) {
        // Keep original filename if decoding fails
      }

      // Upload to R2 - use shared R2 module
      if (!isR2Configured()) {
        return res.status(503).json({ error: "파일 저장소가 설정되지 않았습니다. 관리자에게 문의하세요." });
      }
      
      let filePath: string;
      try {
        const fileExt = path.extname(fileName).toLowerCase().replace('.', '');
        const uniqueId = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const objectKey = `clinic-resources/${centerId}/${uniqueId}.${fileExt}`;
        
        filePath = await uploadBuffer(file.buffer, objectKey, file.mimetype);
      } catch (r2Error: any) {
        console.error("[Clinic Resources] R2 upload failed:", r2Error);
        console.error("[Clinic Resources] R2 error details:", r2Error?.message, r2Error?.Code, r2Error?.$metadata);
        return res.status(503).json({ error: "파일 저장소 연결에 문제가 있습니다. 잠시 후 다시 시도하세요." });
      }

      const resource = await storage.createClinicResource({
        centerId,
        fileName,
        filePath,
        description: description || null,
        isPermanent: isPermanent === "true",
        weekStartDate: weekStartDate || null,
        uploadedById,
      });
      res.json(resource);
    } catch (error) {
      console.error("Clinic resource upload error:", error);
      res.status(500).json({ error: "Failed to create clinic resource" });
    }
  });

  app.delete("/api/clinic-resources/:id", async (req, res) => {
    try {
      // Get the resource to get the file path before deleting from DB
      const resource = await storage.getClinicResource(req.params.id);
      if (!resource) {
        return res.status(404).json({ error: "Resource not found" });
      }

      // Delete from R2 if configured and path looks like an R2 path
      if (isR2Configured() && resource.filePath && !resource.filePath.startsWith('/uploads/')) {
        try {
          // Extract object key from filePath (remove public URL prefix if present)
          let objectKey = resource.filePath;
          const r2PublicUrl = process.env.R2_PUBLIC_URL;
          if (r2PublicUrl && resource.filePath.startsWith(r2PublicUrl)) {
            objectKey = resource.filePath.replace(`${r2PublicUrl}/`, '');
          }
          await deleteObject(objectKey);
        } catch (r2Error) {
          console.error("[Clinic Resources] Failed to delete R2 object:", r2Error);
          // Continue with DB deletion even if R2 deletion fails
        }
      }

      await storage.deleteClinicResource(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("[Clinic Resources] Delete error:", error);
      res.status(500).json({ error: "Failed to delete clinic resource" });
    }
  });

  // Update clinic resource (classId)
  app.patch("/api/clinic-resources/:id", async (req, res) => {
    try {
      const { classId } = req.body;
      const resource = await storage.updateClinicResource(req.params.id, {
        classId: classId || null,
      });
      res.json(resource);
    } catch (error) {
      console.error("[Clinic Resources] Update error:", error);
      res.status(500).json({ error: "Failed to update clinic resource" });
    }
  });

  // Cleanup old temporary resources (called periodically or manually)
  app.post("/api/clinic-resources/cleanup", async (req, res) => {
    try {
      const { beforeDate } = req.body;
      if (!beforeDate) {
        return res.status(400).json({ error: "beforeDate is required" });
      }
      const deletedCount = await storage.deleteOldTemporaryClinicResources(beforeDate);
      res.json({ deleted: deletedCount });
    } catch (error) {
      res.status(500).json({ error: "Failed to cleanup old resources" });
    }
  });

  // ===== Clinic Daily Notes (날짜별 기록) =====

  app.get("/api/clinic-daily-notes/:clinicStudentId", async (req, res) => {
    try {
      const notes = await storage.getClinicDailyNotes(req.params.clinicStudentId);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: "Failed to get clinic daily notes" });
    }
  });

  app.post("/api/clinic-daily-notes", async (req, res) => {
    try {
      const note = await storage.createClinicDailyNote(req.body);
      res.json(note);
    } catch (error) {
      res.status(500).json({ error: "Failed to create clinic daily note" });
    }
  });

  app.patch("/api/clinic-daily-notes/:id", async (req, res) => {
    try {
      const note = await storage.updateClinicDailyNote(req.params.id, req.body);
      res.json(note);
    } catch (error) {
      res.status(500).json({ error: "Failed to update clinic daily note" });
    }
  });

  app.delete("/api/clinic-daily-notes/:id", async (req, res) => {
    try {
      await storage.deleteClinicDailyNote(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete clinic daily note" });
    }
  });

  // ===== Clinic Instruction Defaults (요일별 기본 지시사항) =====

  app.get("/api/clinic-instruction-defaults/:clinicStudentId", async (req, res) => {
    try {
      const defaults = await storage.getClinicInstructionDefaults(req.params.clinicStudentId);
      res.json(defaults);
    } catch (error) {
      res.status(500).json({ error: "Failed to get instruction defaults" });
    }
  });

  app.post("/api/clinic-instruction-defaults", async (req, res) => {
    try {
      const result = await storage.upsertClinicInstructionDefault(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to save instruction default" });
    }
  });

  app.delete("/api/clinic-instruction-defaults/:id", async (req, res) => {
    try {
      await storage.deleteClinicInstructionDefault(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete instruction default" });
    }
  });

  // ===== Clinic Weekly Record Files (주간 기록 첨부파일) =====

  app.get("/api/clinic-weekly-record-files/:recordId", async (req, res) => {
    try {
      const files = await storage.getClinicWeeklyRecordFiles(req.params.recordId);
      res.json(files);
    } catch (error) {
      res.status(500).json({ error: "Failed to get record files" });
    }
  });

  app.post("/api/clinic-weekly-record-files", clinicUpload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const { recordId, period } = req.body;
      if (!recordId || !period) {
        return res.status(400).json({ error: "recordId and period are required" });
      }

      // Decode Korean filename
      let fileName = file.originalname;
      try {
        const decoded = iconv.decode(Buffer.from(fileName, 'latin1'), 'utf-8');
        if (decoded && !decoded.includes('�')) {
          fileName = decoded;
        }
      } catch (e) {
        // Keep original filename if decoding fails
      }

      const fileExt = fileName.split('.').pop()?.toLowerCase() || 'unknown';
      
      // Upload to R2 - use shared R2 module
      if (!isR2Configured()) {
        return res.status(500).json({ error: "R2 storage not configured" });
      }
      
      const uniqueId = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const objectKey = `clinic/${recordId}/${period}/${uniqueId}.${fileExt}`;
      
      const publicUrl = await uploadBuffer(file.buffer, objectKey, file.mimetype);

      const fileRecord = await storage.createClinicWeeklyRecordFile({
        recordId,
        period,
        fileName,
        filePath: publicUrl,
        fileType: fileExt,
        fileSize: file.size,
      });

      res.json(fileRecord);
    } catch (error) {
      console.error("Failed to upload clinic record file:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  app.delete("/api/clinic-weekly-record-files/:id", async (req, res) => {
    try {
      const fileRecord = await storage.getClinicWeeklyRecordFileById(req.params.id);
      if (!fileRecord) {
        return res.status(404).json({ error: "File not found" });
      }
      
      // Delete from R2 if it's an R2 path (starts with clinic/)
      if (fileRecord.filePath && isR2Configured()) {
        let objectKey = fileRecord.filePath;
        // Strip public URL prefix if present
        const r2PublicUrl = process.env.R2_PUBLIC_URL;
        if (r2PublicUrl && fileRecord.filePath.startsWith(r2PublicUrl)) {
          objectKey = fileRecord.filePath.replace(`${r2PublicUrl}/`, '');
        }
        // Only delete if it looks like an R2 object key (starts with clinic/)
        if (objectKey.startsWith('clinic/')) {
          try {
            await deleteObject(objectKey);
          } catch (r2Error) {
            console.error("Failed to delete file from R2:", r2Error);
          }
        }
      }
      
      await storage.deleteClinicWeeklyRecordFile(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // ===== Clinic Shared Instruction Groups (공통 지시사항 그룹) =====

  app.get("/api/clinic-shared-instruction-groups", async (req, res) => {
    try {
      const { centerId, teacherId, weekStartDate } = req.query;
      const groups = await storage.getClinicSharedInstructionGroups(
        centerId as string,
        teacherId as string | undefined,
        weekStartDate as string | undefined
      );
      res.json(groups);
    } catch (error) {
      console.error("Failed to get shared instruction groups:", error);
      res.status(500).json({ error: "Failed to get shared instruction groups" });
    }
  });

  app.post("/api/clinic-shared-instruction-groups", async (req, res) => {
    try {
      const { centerId, teacherId, weekStartDate, period, content, useDefault, recordIds } = req.body;
      
      const group = await storage.createClinicSharedInstructionGroup({
        centerId,
        teacherId,
        weekStartDate,
        period,
        content,
        useDefault: useDefault || false,
      });
      
      if (recordIds && recordIds.length > 0) {
        for (const recordId of recordIds) {
          await storage.addClinicSharedInstructionMember({
            sharedGroupId: group.id,
            recordId,
          });
        }
      }
      
      const groupWithMembers = await storage.getClinicSharedInstructionGroupWithMembers(group.id);
      res.json(groupWithMembers);
    } catch (error) {
      console.error("Failed to create shared instruction group:", error);
      res.status(500).json({ error: "Failed to create shared instruction group" });
    }
  });

  app.patch("/api/clinic-shared-instruction-groups/:id", async (req, res) => {
    try {
      const { content, useDefault, recordIds } = req.body;
      
      await storage.updateClinicSharedInstructionGroup(req.params.id, {
        content,
        useDefault,
      });
      
      if (recordIds !== undefined) {
        await storage.clearClinicSharedInstructionMembers(req.params.id);
        for (const recordId of recordIds) {
          await storage.addClinicSharedInstructionMember({
            sharedGroupId: req.params.id,
            recordId,
          });
        }
      }
      
      const groupWithMembers = await storage.getClinicSharedInstructionGroupWithMembers(req.params.id);
      res.json(groupWithMembers);
    } catch (error) {
      console.error("Failed to update shared instruction group:", error);
      res.status(500).json({ error: "Failed to update shared instruction group" });
    }
  });

  app.delete("/api/clinic-shared-instruction-groups/:id", async (req, res) => {
    try {
      await storage.deleteClinicSharedInstructionGroup(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete shared instruction group:", error);
      res.status(500).json({ error: "Failed to delete shared instruction group" });
    }
  });

  app.get("/api/clinic-shared-instruction-members/:recordId", async (req, res) => {
    try {
      const members = await storage.getClinicSharedInstructionMembersByRecord(req.params.recordId);
      res.json(members);
    } catch (error) {
      console.error("Failed to get shared instruction members:", error);
      res.status(500).json({ error: "Failed to get shared instruction members" });
    }
  });

  // ===== Attendance System (출결 시스템) =====

  // Check SOLAPI configuration status
  app.get("/api/attendance/solapi-status", async (_req, res) => {
    const configured = await isSolapiConfigured();
    res.json({ configured });
  });

  // Auto-generate attendance PINs for all students in center
  app.post("/api/attendance-pins/auto-generate", async (req, res) => {
    try {
      const { centerId } = req.body;
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }

      console.log(`[AUTO-GEN-PIN] start centerId=${centerId}`);
      // Get all students in this center
      const centerUsers = await storage.getUsers(centerId);
      // Use loose equality on role to guard against legacy string values
      const students = centerUsers.filter((u: User) => Number(u.role) === Number(UserRole.STUDENT));
      console.log(`[AUTO-GEN-PIN] centerUsers=${centerUsers.length} students=${students.length}`);
      if (centerUsers.length > 0 && students.length === 0) {
        console.log(`[AUTO-GEN-PIN] WARN: center has users but 0 with role=STUDENT. Roles seen: ${JSON.stringify(centerUsers.map(u => ({ id: u.id, role: u.role, name: u.name })).slice(0, 10))}`);
      }

      // Get existing PINs for this center
      const existingPins = await storage.getAttendancePins(centerId);
      console.log(`[AUTO-GEN-PIN] existingPins=${existingPins.length}`);

      // Clean up orphan PINs whose student no longer exists in this center.
      // Without this, deleted students' PINs keep occupying their last-4-digit
      // slot and block auto-generation for newly registered students.
      const studentIdSet = new Set(students.map((s) => s.id));
      const orphanPins = existingPins.filter((p) => !studentIdSet.has(p.studentId));
      for (const orphan of orphanPins) {
        await storage.deleteAttendancePin(orphan.id);
      }
      const livePins = existingPins.filter((p) => studentIdSet.has(p.studentId));

      // Only active PINs occupy a slot; deactivated PINs can be re-used
      const activePins = livePins.filter((p) => p.isActive !== false);
      const usedPins = activePins.map((p) => p.pin);
      const studentsWithPins = new Set(activePins.map((p) => p.studentId));
      console.log(`[AUTO-GEN-PIN] orphansRemoved=${orphanPins.length} livePins=${livePins.length} activePins=${activePins.length}`);

      const created: { studentId: string; pin: string }[] = [];
      const skipped: { studentId: string; name?: string; reason: string }[] = [];

      for (const student of students) {
        // Skip if already has PIN
        if (studentsWithPins.has(student.id)) {
          skipped.push({ studentId: student.id, name: student.name, reason: "이미 출결번호 있음" });
          continue;
        }

        // Skip if no phone number
        if (!student.phone) {
          console.log(`[AUTO-GEN-PIN] skip student=${student.id}(${student.name}) reason=전화번호 없음 phone=${student.phone}`);
          skipped.push({ studentId: student.id, name: student.name, reason: "전화번호 없음" });
          continue;
        }

        const pin = generatePinFromPhone(student.phone, usedPins);
        if (!pin) {
          console.log(`[AUTO-GEN-PIN] skip student=${student.id}(${student.name}) reason=PIN 중복 phone=${student.phone}`);
          skipped.push({ studentId: student.id, name: student.name, reason: "PIN 중복 (수동 등록 필요)" });
          continue;
        }

        try {
          await storage.createAttendancePin({ studentId: student.id, centerId, pin });
          usedPins.push(pin);
          created.push({ studentId: student.id, pin });
          console.log(`[AUTO-GEN-PIN] created student=${student.id}(${student.name}) pin=${pin}`);
        } catch (createErr: any) {
          console.error(`[AUTO-GEN-PIN] createAttendancePin FAILED student=${student.id}:`, createErr?.message || createErr);
          skipped.push({ studentId: student.id, name: student.name, reason: `생성 실패: ${createErr?.message || "unknown"}` });
        }
      }

      console.log(`[AUTO-GEN-PIN] done created=${created.length} skipped=${skipped.length} orphansRemoved=${orphanPins.length}`);

      res.json({
        created: created.length,
        skipped: skipped.length,
        orphansRemoved: orphanPins.length,
        totalStudents: students.length,
        details: { created, skipped },
      });
    } catch (error) {
      console.error("Auto-generate PINs error:", error);
      res.status(500).json({ error: "Failed to auto-generate PINs" });
    }
  });

  // Manual attendance check-in by teacher
  app.post("/api/attendance/manual-checkin", async (req, res) => {
    try {
      const { studentId, centerId, classId, isLate } = req.body;
      if (!studentId || !centerId) {
        return res.status(400).json({ error: "studentId and centerId are required" });
      }

      const today = getKoreanToday();

      // Check if already checked in today for this specific class
      let existingRecord;
      if (classId) {
        existingRecord = await storage.getAttendanceRecordByStudentDateAndClass(studentId, today, classId);
      } else {
        existingRecord = await storage.getAttendanceRecordByStudentAndDate(studentId, today);
      }
      
      let record;
      let isUpdate = false;
      
      if (existingRecord) {
        record = await storage.updateAttendanceRecord(existingRecord.id, {
          attendanceStatus: isLate ? "late" : "present",
          wasLate: isLate || false,
        });
        isUpdate = true;
      } else {
        // Create new attendance record with classId
        record = await storage.createAttendanceRecord({
          studentId,
          centerId,
          classId: classId || undefined,
          checkInDate: today,
          wasLate: isLate || false,
        });
      }

      // Get student info for notification
      const student = await storage.getUser(studentId);
      const center = await storage.getCenter(centerId);
      
      const solapiConfigured = await isSolapiConfigured(center?.name);
      
      // Send notification if configured
      if (solapiConfigured && student) {
        const parentPhone = student.motherPhone || student.fatherPhone;
        if (parentPhone) {
          // Get custom message templates
          const templates = await storage.getMessageTemplates(centerId);
          const checkInTemplate = templates.find((t) => t.type === "check_in");
          const lateTemplate = templates.find((t) => t.type === "late");

          const logNotification = async (result: { success: boolean; error?: string; sentText?: string }) => {
            await storage.createNotificationLog({
              attendanceRecordId: record.id,
              recipientPhone: parentPhone,
              recipientType: student.motherPhone ? "mother" : "father",
              messageType: isLate ? "late" : "attendance_checkin",
              channel: "sms",
              status: result.success ? "sent" : "failed",
              errorMessage: result.error || null,
              messageContent: result.sentText || null,
            });
          };

          if (isLate) {
            const timeStr = record.checkInAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });
            sendLateNotification(student.name, timeStr, parentPhone, center?.name, lateTemplate?.body, center?.id)
              .then(logNotification)
              .catch(err => console.error("Notification error:", err));
          } else {
            sendAttendanceNotification(student.name, record.checkInAt, parentPhone, center?.name, checkInTemplate?.body, center?.id)
              .then(logNotification)
              .catch(err => console.error("Notification error:", err));
          }
        }
      }

      res.json({ success: true, record });
    } catch (error) {
      console.error("Manual check-in error:", error);
      res.status(500).json({ error: "Failed to create attendance record" });
    }
  });

  // Update attendance status only (without sending SMS)
  app.patch("/api/attendance/update-status", async (req, res) => {
    try {
      const { studentId, centerId, classId, status, date } = req.body;
      if (!studentId || !centerId || !status) {
        return res.status(400).json({ error: "studentId, centerId, and status are required" });
      }

      const validStatuses = ["pending", "present", "late", "absent"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status. Must be: pending, present, late, or absent" });
      }

      const checkInDate = date || getKoreanToday();

      // Always create a new attendance record so that history accumulates
      // (e.g. 등원 → 지각 → 하원 are all kept as separate time-stamped entries)
      const record = await storage.createAttendanceRecord({
        studentId,
        centerId,
        classId: classId || undefined,
        checkInDate,
        wasLate: status === "late",
        attendanceStatus: status,
      });

      res.json({ success: true, record });
    } catch (error) {
      console.error("Update attendance status error:", error);
      res.status(500).json({ error: "Failed to update attendance status" });
    }
  });

  // Send SMS notification for attendance (separate from status update)
  app.post("/api/attendance/send-sms", async (req, res) => {
    try {
      const { studentId, centerId, classId, type, date } = req.body;
      if (!studentId || !centerId || !type) {
        return res.status(400).json({ error: "studentId, centerId, and type are required" });
      }

      if (!["check_in", "late", "check_out"].includes(type)) {
        return res.status(400).json({ error: "Invalid type. Must be: check_in, late, or check_out" });
      }

      const student = await storage.getUser(studentId);
      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }

      const center = await storage.getCenter(centerId);
      const parentPhone = student.motherPhone || student.fatherPhone;
      if (!parentPhone) {
        return res.status(400).json({ error: "학부모 연락처가 없습니다" });
      }

      const solapiIsConfigured = await isSolapiConfigured(center?.name);
      if (!solapiIsConfigured) {
        return res.status(400).json({ error: "알림 서비스가 설정되지 않았습니다" });
      }

      // Use the date from the client if provided, otherwise use Korean today
      const today = date || getKoreanToday();
      let attendanceRecord;
      if (classId) {
        attendanceRecord = await storage.getAttendanceRecordByStudentDateAndClass(studentId, today, classId);
      } else {
        attendanceRecord = await storage.getAttendanceRecordByStudentAndDate(studentId, today);
      }

      // Get custom message templates
      const templates = await storage.getMessageTemplates(centerId);
      const checkInTemplate = templates.find((t) => t.type === "check_in");
      const lateTemplate = templates.find((t) => t.type === "late");
      const checkOutTemplate = templates.find((t) => t.type === "check_out");

      const now = new Date();
      const timeStr = now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });
      let result: { success: boolean; error?: string; sentText?: string };

      if (type === "late") {
        result = await sendLateNotification(student.name, timeStr, parentPhone, center?.name, lateTemplate?.body, center?.id);
      } else if (type === "check_out") {
        // Send check-out notification
        let messageBody = checkOutTemplate?.body || "[{학원명}] {학생명} 학생이 {시간}에 하원하였습니다.";
        messageBody = messageBody
          .replace(/{학원명}/g, center?.name || "학원")
          .replace(/{학생명}/g, student.name)
          .replace(/{시간}/g, timeStr)
          .replace(/{날짜}/g, now.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" }));
        const smsResult = await sendSms({ to: parentPhone, text: messageBody, centerName: center?.name, centerId: center?.id });
        result = { ...smsResult, sentText: messageBody };
      } else {
        result = await sendAttendanceNotification(student.name, now, parentPhone, center?.name, checkInTemplate?.body, center?.id);
      }

      // Update attendance status when sending check_in or late SMS
      if (result.success && (type === "check_in" || type === "late")) {
        const newStatus = type === "check_in" ? "present" : "late";
        if (attendanceRecord) {
          await storage.updateAttendanceRecord(attendanceRecord.id, { attendanceStatus: newStatus });
          attendanceRecord = { ...attendanceRecord, attendanceStatus: newStatus };
        } else {
          const koreaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
          const todayStr = `${koreaTime.getFullYear()}-${String(koreaTime.getMonth() + 1).padStart(2, '0')}-${String(koreaTime.getDate()).padStart(2, '0')}`;
          attendanceRecord = await storage.createAttendanceRecord({
            studentId,
            centerId,
            classId: classId || null,
            attendanceStatus: newStatus,
            checkInDate: todayStr,
          });
        }
      }

      // Record check-out time when sending check_out SMS (even if SMS fails)
      if (type === "check_out") {
        const allTodayRecords = await storage.getAttendanceRecordsByStudentAndDate(studentId, today);
        const recordsWithoutCheckout = allTodayRecords.filter(r => !r.checkOutAt);
        if (recordsWithoutCheckout.length > 0) {
          for (const rec of recordsWithoutCheckout) {
            await storage.updateAttendanceRecordCheckOut(rec.id, now);
          }
          attendanceRecord = recordsWithoutCheckout[0];
        } else if (attendanceRecord) {
          await storage.updateAttendanceRecordCheckOut(attendanceRecord.id, now);
        }
      }

      // Log the notification
      if (attendanceRecord) {
        await storage.createNotificationLog({
          attendanceRecordId: attendanceRecord.id,
          recipientPhone: parentPhone,
          recipientType: student.motherPhone ? "mother" : "father",
          messageType: type === "check_out" ? "check_out" : (type === "late" ? "late" : "attendance_checkin"),
          channel: "sms",
          status: result.success ? "sent" : "failed",
          errorMessage: result.error || null,
          messageContent: result.sentText || null,
        });
      }

      if (!result.success) {
        return res.status(500).json({ error: result.error || "알림 발송에 실패했습니다" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Send attendance SMS error:", error);
      res.status(500).json({ error: "Failed to send attendance SMS" });
    }
  });

  app.get("/api/centers/:centerId/auto-late-settings", async (req, res) => {
    try {
      const { centerId } = req.params;
      const enabled = await storage.getSystemSetting(`auto_late_notification_enabled_${centerId}`);
      const minutes = await storage.getSystemSetting(`auto_late_notification_minutes_${centerId}`);
      const template = await storage.getSystemSetting(`auto_late_notification_template_${centerId}`);
      res.json({
        enabled: enabled === "true",
        minutes: parseInt(minutes || "10", 10),
        template: template || "",
      });
    } catch (error) {
      console.error("Get auto late settings error:", error);
      res.status(500).json({ error: "Failed to get auto late settings" });
    }
  });

  app.put("/api/centers/:centerId/auto-late-settings", async (req, res) => {
    try {
      const { centerId } = req.params;
      const { enabled, minutes, template } = req.body;

      if (typeof enabled === "boolean") {
        await storage.setSystemSetting(`auto_late_notification_enabled_${centerId}`, enabled.toString());
      }
      if (typeof minutes === "number" && minutes >= 1 && minutes <= 60) {
        await storage.setSystemSetting(`auto_late_notification_minutes_${centerId}`, minutes.toString());
      }
      if (typeof template === "string") {
        await storage.setSystemSetting(`auto_late_notification_template_${centerId}`, template);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Update auto late settings error:", error);
      res.status(500).json({ error: "Failed to update auto late settings" });
    }
  });

  // Get attendance history for a student (date range)
  app.get("/api/attendance/history/:studentId", async (req, res) => {
    try {
      const { studentId } = req.params;
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      const records = await storage.getAttendanceRecordsForStudent(
        studentId,
        startDate as string,
        endDate as string
      );

      const enrichedRecords = await Promise.all(records.map(async (record: any) => {
        if (record.wasLate) return record;
        if (record.attendanceStatus !== "present") return record;
        const logs = await storage.getNotificationLogsByAttendanceRecord(record.id);
        const lateLog = logs.find(l => l.messageType === "late" && l.status === "sent");
        if (lateLog) {
          return {
            ...record,
            wasLate: true,
            lateNotificationSentAt: lateLog.sentAt || record.createdAt || record.checkInAt,
          };
        }
        return record;
      }));

      res.json(enrichedRecords);
    } catch (error) {
      console.error("Get attendance history error:", error);
      res.status(500).json({ error: "Failed to get attendance history" });
    }
  });

  // Resend attendance notification
  app.post("/api/attendance/resend-notification", async (req, res) => {
    try {
      const { studentId, isLate } = req.body;
      if (!studentId) {
        return res.status(400).json({ error: "studentId is required" });
      }

      const student = await storage.getUser(studentId);
      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }

      const parentPhone = student.motherPhone || student.fatherPhone;
      if (!parentPhone) {
        return res.status(400).json({ error: "학부모 연락처가 없습니다" });
      }

      const solapiIsConfigured = await isSolapiConfigured();
      if (!solapiIsConfigured) {
        return res.status(400).json({ error: "알림 서비스가 설정되지 않았습니다" });
      }

      // Get today's attendance record for logging
      const today = getKoreanToday();
      const attendanceRecord = await storage.getAttendanceRecordByStudentAndDate(studentId, today);

      const now = new Date();
      let result: { success: boolean; error?: string };
      
      // Get center name from student's attendance record
      let centerName: string | undefined;
      if (attendanceRecord) {
        const center = await storage.getCenter(attendanceRecord.centerId);
        centerName = center?.name;
      }
      
      if (isLate) {
        const timeStr = now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });
        result = await sendLateNotification(student.name, timeStr, parentPhone, centerName, undefined, attendanceRecord?.centerId);
      } else {
        result = await sendAttendanceNotification(student.name, now, parentPhone, centerName, undefined, attendanceRecord?.centerId);
      }

      // Log the notification
      if (attendanceRecord) {
        await storage.createNotificationLog({
          attendanceRecordId: attendanceRecord.id,
          recipientPhone: parentPhone,
          recipientType: student.motherPhone ? "mother" : "father",
          messageType: isLate ? "late" : "attendance_checkin",
          channel: "sms",
          status: result.success ? "sent" : "failed",
          errorMessage: result.error || null,
          messageContent: result.sentText || null,
        });
      }

      if (!result.success) {
        return res.status(500).json({ error: result.error || "알림 발송에 실패했습니다" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Resend notification error:", error);
      res.status(500).json({ error: "Failed to resend notification" });
    }
  });

  // Bulk SMS to parents
  app.post("/api/sms/bulk-send", async (req, res) => {
    try {
      const { studentIds, message, phoneTypes, phoneType, actorId } = req.body;
      
      if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({ error: "studentIds is required and must be an array" });
      }
      
      if (!message || typeof message !== "string" || message.trim().length === 0) {
        return res.status(400).json({ error: "message is required" });
      }

      // Normalize recipient types: prefer new phoneTypes array, fall back to legacy phoneType
      const selectedTypes: string[] = Array.isArray(phoneTypes)
        ? phoneTypes
        : phoneType === "both"
          ? ["mother", "father"]
          : phoneType
            ? [phoneType]
            : [];

      if (selectedTypes.length === 0) {
        return res.status(400).json({ error: "phoneTypes is required and must be a non-empty array" });
      }

      const { successCount, failCount, results } = await sendBulkSmsToStudents({
        studentIds,
        message,
        selectedTypes,
        actorId: actorId || "",
      });

      res.json({ 
        success: true, 
        successCount, 
        failCount, 
        results 
      });
    } catch (error) {
      console.error("Bulk SMS error:", error);
      res.status(500).json({ error: "Failed to send bulk SMS" });
    }
  });

  // 예약 문자 등록 (Schedule SMS)
  app.post("/api/sms/schedule", async (req, res) => {
    try {
      const { centerId, studentIds, message, phoneTypes, phoneType, scheduledAt, actorId } = req.body;

      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({ error: "studentIds is required and must be an array" });
      }
      if (!message || typeof message !== "string" || message.trim().length === 0) {
        return res.status(400).json({ error: "message is required" });
      }

      const selectedTypes: string[] = Array.isArray(phoneTypes)
        ? phoneTypes
        : phoneType
          ? [phoneType]
          : [];
      if (selectedTypes.length === 0) {
        return res.status(400).json({ error: "phoneTypes is required and must be a non-empty array" });
      }

      const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
      if (!scheduledDate || isNaN(scheduledDate.getTime())) {
        return res.status(400).json({ error: "scheduledAt is required and must be a valid date" });
      }
      if (scheduledDate.getTime() <= Date.now()) {
        return res.status(400).json({ error: "예약 시간은 현재 시각보다 이후여야 합니다" });
      }

      const created = await storage.createScheduledSms({
        centerId,
        createdBy: actorId || "",
        studentIds,
        message: message.trim(),
        phoneTypes: selectedTypes,
        scheduledAt: scheduledDate,
      });

      res.json({ success: true, scheduled: created });
    } catch (error) {
      console.error("Schedule SMS error:", error);
      res.status(500).json({ error: "Failed to schedule SMS" });
    }
  });

  // 예약 문자 목록 조회
  app.get("/api/sms/scheduled", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      const list = await storage.getScheduledSmsByCenter(centerId);
      res.json(list);
    } catch (error) {
      console.error("Get scheduled SMS error:", error);
      res.status(500).json({ error: "Failed to get scheduled SMS" });
    }
  });

  // 예약 문자 취소
  app.delete("/api/sms/scheduled/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const cancelled = await storage.cancelScheduledSms(id);
      if (!cancelled) {
        return res.status(400).json({ error: "취소할 수 없는 예약입니다 (이미 발송되었거나 존재하지 않음)" });
      }
      res.json({ success: true, scheduled: cancelled });
    } catch (error) {
      console.error("Cancel scheduled SMS error:", error);
      res.status(500).json({ error: "Failed to cancel scheduled SMS" });
    }
  });

  // Direct bulk SMS to phone numbers (for center management)
  app.post("/api/sms/direct-bulk-send", async (req, res) => {
    try {
      const { phones, message, centerName, centerId, actorId } = req.body;
      
      console.log(`[SMS BULK] Request received - centerName: "${centerName}", centerId: ${centerId}, phones count: ${phones?.length || 0}, actorId: ${actorId}`);
      
      if (!phones || !Array.isArray(phones) || phones.length === 0) {
        return res.status(400).json({ error: "phones is required and must be an array" });
      }
      
      if (!message || typeof message !== "string" || message.trim().length === 0) {
        return res.status(400).json({ error: "message is required" });
      }

      if (!centerName) {
        return res.status(400).json({ error: "centerName is required" });
      }

      let successCount = 0;
      let failCount = 0;

      for (const phone of phones) {
        if (!phone || typeof phone !== "string") {
          failCount++;
          continue;
        }

        const smsResult = await sendSms({
          to: phone,
          text: message.trim(),
          centerName,
          centerId,
        });
        
        if (smsResult.success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      res.json({ 
        success: true, 
        successCount, 
        failCount, 
      });
    } catch (error) {
      console.error("Direct bulk SMS error:", error);
      res.status(500).json({ error: "Failed to send bulk SMS" });
    }
  });

  // Get SMS history for a center
  app.get("/api/sms/history", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      const history = await storage.getSmsHistory(centerId);
      res.json(history);
    } catch (error) {
      console.error("Get SMS history error:", error);
      res.status(500).json({ error: "Failed to get SMS history" });
    }
  });

  // SMS Templates CRUD (Teacher+ only)
  app.get("/api/sms-templates", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      if (!centerId) return res.status(400).json({ error: "centerId is required" });
      const templates = await storage.getSmsTemplates(centerId);
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to get SMS templates" });
    }
  });

  app.post("/api/sms-templates", async (req, res) => {
    try {
      const { centerId, title, message, createdBy } = req.body;
      if (!centerId || !title?.trim() || !message?.trim() || !createdBy) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const actor = await storage.getUser(createdBy);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }
      const template = await storage.createSmsTemplate({ centerId, title: title.trim(), message: message.trim(), createdBy });
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to create SMS template" });
    }
  });

  app.put("/api/sms-templates/:id", async (req, res) => {
    try {
      const { title, message } = req.body;
      if (!title?.trim() || !message?.trim()) {
        return res.status(400).json({ error: "제목과 내용을 입력해주세요" });
      }
      const template = await storage.updateSmsTemplate(req.params.id, { title: title.trim(), message: message.trim() });
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to update SMS template" });
    }
  });

  app.delete("/api/sms-templates/:id", async (req, res) => {
    try {
      await storage.deleteSmsTemplate(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete SMS template" });
    }
  });

  // SMS Credits (충전형 문자)
  app.get("/api/sms-credits/:centerId", async (req, res) => {
    try {
      const { centerId } = req.params;
      const actorId = req.query.actorId as string;
      if (actorId) {
        const actor = await storage.getUser(actorId);
        if (!actor || (actor.role !== UserRole.ADMIN && actor.role !== UserRole.PRINCIPAL)) {
          return res.status(403).json({ error: "권한이 없습니다." });
        }
      }
      let credit = await storage.getSmsCredit(centerId);
      if (!credit) {
        credit = await storage.createSmsCredit(centerId);
      }
      res.json(credit);
    } catch (error) {
      res.status(500).json({ error: "Failed to get SMS credit" });
    }
  });

  app.patch("/api/sms-credits/:centerId/notify", async (req, res) => {
    try {
      const { centerId } = req.params;
      const { enabled, actorId } = req.body;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다." });
      const actor = await storage.getUser(actorId);
      if (!actor || (actor.role !== UserRole.ADMIN && actor.role !== UserRole.PRINCIPAL)) {
        return res.status(403).json({ error: "관리자 또는 원장만 변경할 수 있습니다." });
      }
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ error: "enabled 값이 올바르지 않습니다." });
      }
      const credit = await storage.updateSmsCreditNotifyEnabled(centerId, enabled);
      res.json(credit);
    } catch (error) {
      res.status(500).json({ error: "Failed to update notify setting" });
    }
  });

  app.post("/api/sms-credits/:centerId/charge", async (req, res) => {
    try {
      const { centerId } = req.params;
      const { amount, actorId } = req.body;
      if (actorId) {
        const actor = await storage.getUser(actorId);
        if (!actor || actor.role !== UserRole.ADMIN) {
          return res.status(403).json({ error: "관리자만 충전할 수 있습니다." });
        }
      }
      if (!amount || amount < 30000) {
        return res.status(400).json({ error: "최소 충전 금액은 30,000원입니다." });
      }
      const credit = await storage.updateSmsCreditBalance(centerId, amount);
      await storage.createSmsCreditTransaction({
        centerId,
        amount,
        type: "charge",
        description: `${amount.toLocaleString()}원 충전`,
      });
      res.json(credit);
    } catch (error) {
      res.status(500).json({ error: "Failed to charge SMS credit" });
    }
  });

  app.get("/api/sms-credit-transactions", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다." });
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 조회 가능합니다." });
      }
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 200;
      const transactions = await storage.getAllSmsCreditTransactions(limit);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get all SMS credit transactions" });
    }
  });

  app.get("/api/sms-credit-transactions/:centerId", async (req, res) => {
    try {
      const { centerId } = req.params;
      const actorId = req.query.actorId as string;
      if (actorId) {
        const actor = await storage.getUser(actorId);
        if (!actor || (actor.role !== UserRole.ADMIN && actor.role !== UserRole.PRINCIPAL)) {
          return res.status(403).json({ error: "권한이 없습니다." });
        }
      }
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const transactions = await storage.getSmsCreditTransactions(centerId, limit);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get SMS credit transactions" });
    }
  });

  app.post("/api/sms-credits/:centerId/adjust", async (req, res) => {
    try {
      const { centerId } = req.params;
      const { amount, reason, actorId } = req.body;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 잔액을 조정할 수 있습니다" });
      }
      if (typeof amount !== "number" || amount === 0) {
        return res.status(400).json({ error: "조정 금액을 입력해주세요" });
      }

      let credit = await storage.getSmsCredit(centerId);
      if (!credit) {
        credit = await storage.createSmsCredit(centerId);
      }
      const newBalance = (credit.balance || 0) + amount;
      if (newBalance < 0) {
        return res.status(400).json({ error: `잔액이 부족합니다. 현재 잔액: ${(credit.balance || 0).toLocaleString()}원` });
      }

      const updated = await storage.updateSmsCreditBalance(centerId, amount);
      await storage.createSmsCreditTransaction({
        centerId,
        amount,
        type: amount > 0 ? "charge" : "deduct",
        description: reason || (amount > 0 ? `관리자 수동 증액 ${amount.toLocaleString()}원` : `관리자 수동 감액 ${Math.abs(amount).toLocaleString()}원`),
      });
      res.json(updated);
    } catch (error) {
      console.error("Failed to adjust SMS credit:", error);
      res.status(500).json({ error: "잔액 조정에 실패했습니다" });
    }
  });

  app.put("/api/centers/:centerId/sms-mode", async (req, res) => {
    try {
      const { centerId } = req.params;
      const { smsMode, creditSenderNumber, actorId } = req.body;
      if (actorId) {
        const actor = await storage.getUser(actorId);
        if (!actor || (actor.role !== UserRole.ADMIN && actor.role !== UserRole.PRINCIPAL)) {
          return res.status(403).json({ error: "권한이 없습니다." });
        }
      }
      const updateData: any = {};
      if (smsMode !== undefined) updateData.smsMode = smsMode;
      if (creditSenderNumber !== undefined) updateData.creditSenderNumber = creditSenderNumber;
      // 크레딧 모드 발신번호는 플랫폼 SOLAPI 계정에 등록된 번호만 사용 가능 → 저장 시 검증
      if (creditSenderNumber) {
        const normalized = String(creditSenderNumber).replace(/[^0-9]/g, "");
        const registered = await getPlatformRegisteredSenderNumbers();
        if (registered !== null && !registered.includes(normalized)) {
          return res.status(400).json({
            error: `이 발신번호(${creditSenderNumber})는 아직 문자 발송 시스템(SOLAPI)에 등록되지 않았습니다. 크레딧 모드에서는 시스템 SOLAPI 계정에 발신번호가 등록되어 있어야 발송이 가능합니다. 관리자에게 발신번호 등록을 요청해주세요.`,
          });
        }
      }
      const center = await storage.updateCenter(centerId, updateData);
      res.json(center);
    } catch (error) {
      res.status(500).json({ error: "Failed to update SMS mode" });
    }
  });

  // Helper: get charge Toss keys from system settings (관리자가 등록한 충전용 키)
  async function getChargeTossKeys(): Promise<{ clientKey: string; secretKey: string } | null> {
    const encClientKey = await storage.getSystemSetting("charge_toss_client_key");
    const encSecretKey = await storage.getSystemSetting("charge_toss_secret_key");
    if (encClientKey && encSecretKey) {
      try {
        const clientKey = decrypt(encClientKey);
        const secretKey = decrypt(encSecretKey);
        if (clientKey.length > 20 && (clientKey.startsWith("test_") || clientKey.startsWith("live_"))) {
          console.log(`[TOSS-CHARGE] Using charge system keys (clientKey starts with "${clientKey.substring(0, 10)}...")`);
          return { clientKey, secretKey };
        }
      } catch (e) {
        console.error("[TOSS-CHARGE] Failed to decrypt charge keys:", e);
      }
    }
    return null;
  }

  // 충전용 토스 키 조회 (관리자 전용)
  app.get("/api/charge-toss-settings", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) return res.status(401).json({ error: "인증 필요" });
      const actor = await storage.getUser(actorId);
      if (!actor || (actor.role !== 4 && actor.role !== 3)) return res.status(403).json({ error: "권한 없음" });

      const encClientKey = await storage.getSystemSetting("charge_toss_client_key");
      const encSecretKey = await storage.getSystemSetting("charge_toss_secret_key");
      let configured = false;
      let maskedClientKey: string | null = null;
      let maskedSecretKey: string | null = null;

      if (encClientKey && encSecretKey) {
        try {
          const ck = decrypt(encClientKey);
          const sk = decrypt(encSecretKey);
          if (ck.length > 10) {
            configured = true;
            maskedClientKey = ck.substring(0, 8) + "****" + ck.substring(ck.length - 4);
            maskedSecretKey = sk.substring(0, 8) + "****" + sk.substring(sk.length - 4);
          }
        } catch {}
      }

      res.json({ configured, maskedClientKey, maskedSecretKey });
    } catch (error: any) {
      console.error("[TOSS-CHARGE] Settings error:", error);
      res.status(500).json({ error: "설정 조회 실패" });
    }
  });

  // 충전용 토스 키 저장 (관리자 전용)
  app.put("/api/charge-toss-settings", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) return res.status(401).json({ error: "인증 필요" });
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role !== 4) return res.status(403).json({ error: "관리자 권한 필요" });

      const { clientKey, secretKey } = req.body;
      if (!clientKey || !secretKey) return res.status(400).json({ error: "키를 모두 입력해주세요" });
      if (!clientKey.startsWith("test_") && !clientKey.startsWith("live_")) {
        return res.status(400).json({ error: "클라이언트 키는 test_ 또는 live_ 로 시작해야 합니다" });
      }

      await storage.setSystemSetting("charge_toss_client_key", encrypt(clientKey));
      await storage.setSystemSetting("charge_toss_secret_key", encrypt(secretKey));
      console.log(`[TOSS-CHARGE] Charge keys saved by admin ${actorId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[TOSS-CHARGE] Save error:", error);
      res.status(500).json({ error: "설정 저장 실패" });
    }
  });

  // 충전용 토스 키 삭제 (관리자 전용)
  app.delete("/api/charge-toss-settings", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) return res.status(401).json({ error: "인증 필요" });
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role !== 4) return res.status(403).json({ error: "관리자 권한 필요" });

      await storage.setSystemSetting("charge_toss_client_key", "");
      await storage.setSystemSetting("charge_toss_secret_key", "");
      console.log(`[TOSS-CHARGE] Charge keys deleted by admin ${actorId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[TOSS-CHARGE] Delete error:", error);
      res.status(500).json({ error: "설정 삭제 실패" });
    }
  });

  // 충전용 토스 키 전체 보기 (관리자 전용)
  app.get("/api/charge-toss-settings/reveal", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) return res.status(401).json({ error: "인증 필요" });
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role !== 4) return res.status(403).json({ error: "관리자 권한 필요" });

      const encClientKey = await storage.getSystemSetting("charge_toss_client_key");
      const encSecretKey = await storage.getSystemSetting("charge_toss_secret_key");
      let clientKey: string | null = null;
      let secretKey: string | null = null;
      if (encClientKey) try { clientKey = decrypt(encClientKey); } catch {}
      if (encSecretKey) try { secretKey = decrypt(encSecretKey); } catch {}
      res.json({ clientKey, secretKey });
    } catch (error: any) {
      res.status(500).json({ error: "조회 실패" });
    }
  });

  // Toss Payments - 충전용 설정 조회
  app.get("/api/payments/toss/config", async (req, res) => {
    try {
      const chargeKeys = await getChargeTossKeys();
      if (chargeKeys) {
        return res.json({ available: true, clientKey: chargeKeys.clientKey });
      }
      const envClientKey = process.env.TOSS_CLIENT_KEY || process.env.VITE_TOSS_CLIENT_KEY;
      const hasSecretKey = !!process.env.TOSS_SECRET_KEY;
      console.log(`[TOSS-CHARGE] Config from env: clientKey=${!!envClientKey}, secretKey=${hasSecretKey}`);
      res.json({ available: hasSecretKey && !!envClientKey, clientKey: envClientKey || null });
    } catch (error: any) {
      console.error("[TOSS-CHARGE] Config error:", error);
      res.json({ available: false, clientKey: null });
    }
  });

  app.post("/api/payments/toss/confirm", async (req, res) => {
    try {
      const { paymentKey, orderId, amount, centerId } = req.body;
      if (!paymentKey || !orderId || !amount || !centerId) {
        return res.status(400).json({ error: "필수 정보가 누락되었습니다." });
      }

      const chargeKeys = await getChargeTossKeys();
      let tossResult;

      if (chargeKeys) {
        console.log(`[TOSS-CHARGE] Confirm: using charge system keys`);
        const encSecretKey = (await storage.getSystemSetting("charge_toss_secret_key"))!;
        tossResult = await confirmPaymentWithKey(
          { paymentKey, orderId, amount },
          encSecretKey
        );
      } else if (process.env.TOSS_SECRET_KEY) {
        console.log(`[TOSS-CHARGE] Confirm: using env key`);
        tossResult = await confirmPayment({ paymentKey, orderId, amount });
      } else {
        return res.status(500).json({ error: "결제 시스템이 설정되지 않았습니다." });
      }

      const credit = await storage.updateSmsCreditBalance(centerId, amount);
      await storage.createSmsCreditTransaction({
        centerId,
        amount,
        type: "charge",
        description: `토스페이먼츠 결제 충전 (${amount.toLocaleString()}원)`,
        paymentKey: paymentKey,
      });

      console.log(`[TOSS] Payment confirmed: orderId=${orderId}, amount=${amount}, centerId=${centerId}`);
      res.json({ success: true, credit, payment: { orderId: tossResult.orderId, status: tossResult.status } });
    } catch (error: any) {
      console.error("[TOSS] Payment error:", error);
      res.status(500).json({ error: "결제 처리 중 오류가 발생했습니다." });
    }
  });

  // Toss Payments - success/fail redirect handlers
  app.get("/api/payments/toss/success", async (req, res) => {
    const { paymentKey, orderId, amount } = req.query;
    const centerId = (orderId as string)?.split("-").slice(2, 7).join("-");
    res.redirect(`/settings?payment=success&paymentKey=${paymentKey}&orderId=${orderId}&amount=${amount}`);
  });

  app.get("/api/payments/toss/fail", async (req, res) => {
    const { code, message } = req.query;
    res.redirect(`/settings?payment=fail&code=${code}&message=${encodeURIComponent(message as string || "")}`);
  });

  // ──────────────────────────────────────────────────────────────────
  // SMS Credit 자동결제(Toss BillingKey) 기능 제거됨
  // 잔액이 5,000원 이하로 떨어지면 server/services/solapi.ts에서
  // 관리자/원장에게 충전 안내 알림을 발송하는 반자동 충전 방식으로 대체.
  // ──────────────────────────────────────────────────────────────────

  // Get classes for teacher (for attendance management)
  app.get("/api/teachers/:id/classes", async (req, res) => {
    try {
      const teacherId = req.params.id;
      const centerId = req.query.centerId as string;
      
      let allClasses = await storage.getClasses(centerId);
      const teacherClasses = allClasses.filter((c) => (c.teacherId === teacherId || isAssistantTeacher(c, teacherId)) && !c.isArchived);
      
      res.json(teacherClasses);
    } catch (error) {
      res.status(500).json({ error: "Failed to get teacher classes" });
    }
  });

  // Get students with attendance status for a class on a specific date
  app.get("/api/attendance/all-students", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      const date = req.query.date as string || getKoreanToday();
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }

      const allUsers = await storage.getUsers(centerId);
      const students = allUsers.filter(u => u.role === UserRole.STUDENT);

      const records: AttendanceRecord[] = [];
      for (const student of students) {
        const record = await storage.getAttendanceRecordByStudentAndDate(student.id, date);
        if (record) records.push(record);
      }
      const recordMap = new Map(records.map((r: AttendanceRecord) => [r.studentId, r]));

      const notificationLogsMap = new Map<string, { sentAt: Date; status: string; messageType: string; messageContent?: string }[]>();
      for (const record of records) {
        const logs = await storage.getNotificationLogsByAttendanceRecord(record.id);
        notificationLogsMap.set(record.id, logs
          .filter(l => l.sentAt !== null)
          .map(l => ({ sentAt: l.sentAt as Date, status: l.status, messageType: l.messageType || "unknown", messageContent: l.messageContent || undefined })));
      }

      const result = students.map((student) => {
        const attendanceRecord = recordMap.get(student.id) || null;
        return {
          ...student,
          attendanceRecord,
          notificationLogs: attendanceRecord ? notificationLogsMap.get(attendanceRecord.id) || [] : [],
        };
      });

      res.json(result);
    } catch (error) {
      console.error("Get all students attendance error:", error);
      res.status(500).json({ error: "Failed to get all students attendance" });
    }
  });

  app.get("/api/classes/:id/attendance", async (req, res) => {
    try {
      const classId = req.params.id;
      const date = req.query.date as string || getKoreanToday();
      
      // Get students enrolled in this class
      const students = await storage.getClassStudents(classId);
      
      // Get attendance records for these students on this date FOR THIS SPECIFIC CLASS ONLY
      // Do NOT use center-level fallback - each class must have its own attendance records
      const studentIds = students.map((s) => s.id);
      const records: AttendanceRecord[] = [];
      for (const studentId of studentIds) {
        // Only get records that belong to this specific class
        const record = await storage.getAttendanceRecordByStudentDateAndClass(studentId, date, classId);
        if (record) records.push(record);
      }
      const recordMap = new Map(records.map((r: AttendanceRecord) => [r.studentId, r]));
      
      // Get notification logs for each record
      const notificationLogsMap = new Map<string, { sentAt: Date; status: string; messageType: string; messageContent?: string }[]>();
      for (const record of records) {
        const logs = await storage.getNotificationLogsByAttendanceRecord(record.id);
        notificationLogsMap.set(record.id, logs
          .filter(l => l.sentAt !== null)
          .map(l => ({ sentAt: l.sentAt as Date, status: l.status, messageType: l.messageType || "unknown", messageContent: l.messageContent || undefined })));
      }
      
      // Combine student info with attendance status and notification logs
      const result = students.map((student) => {
        const attendanceRecord = recordMap.get(student.id) || null;
        return {
          ...student,
          attendanceRecord,
          notificationLogs: attendanceRecord ? notificationLogsMap.get(attendanceRecord.id) || [] : [],
        };
      });
      
      res.json(result);
    } catch (error) {
      console.error("Get class attendance error:", error);
      res.status(500).json({ error: "Failed to get class attendance" });
    }
  });

  // Attendance PINs - 출결번호 관리
  app.get("/api/attendance-pins", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      const pins = await storage.getAttendancePins(centerId);
      res.json(pins);
    } catch (error) {
      res.status(500).json({ error: "Failed to get attendance pins" });
    }
  });

  app.get("/api/students/:studentId/attendance-pin/:centerId", async (req, res) => {
    try {
      const { studentId, centerId } = req.params;
      const pin = await storage.getAttendancePinByStudent(studentId, centerId);
      res.json(pin || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to get attendance pin" });
    }
  });

  app.post("/api/attendance-pins", async (req, res) => {
    try {
      const { studentId, centerId, pin } = req.body;
      if (!studentId || !centerId || !pin) {
        return res.status(400).json({ error: "studentId, centerId, and pin are required" });
      }
      // Check if PIN already exists for this center
      const existing = await storage.getAttendancePinByPin(centerId, pin);
      if (existing) {
        return res.status(400).json({ error: "이 출결번호는 이미 사용 중입니다" });
      }
      // Check if student already has a PIN for this center
      const existingForStudent = await storage.getAttendancePinByStudent(studentId, centerId);
      if (existingForStudent) {
        return res.status(400).json({ error: "이 학생은 이미 출결번호가 있습니다" });
      }
      const result = await storage.createAttendancePin({ studentId, centerId, pin });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to create attendance pin" });
    }
  });

  app.patch("/api/attendance-pins/:id", async (req, res) => {
    try {
      const { pin, isActive } = req.body;

      // Validate uniqueness when activating a PIN or changing its value, so we
      // don't end up with two active PINs that share the same digits in a center.
      const current = await storage.getAttendancePinById(req.params.id);
      if (current) {
        const willBeActive = isActive === undefined ? current.isActive !== false : isActive !== false;
        const targetPin = pin ?? current.pin;
        const pinChanged = pin !== undefined && pin !== current.pin;
        const reactivating = isActive === true && current.isActive === false;
        if (willBeActive && (pinChanged || reactivating)) {
          const existingPins = await storage.getAttendancePins(current.centerId);
          const conflict = existingPins.find((p) =>
            p.id !== current.id && p.pin === targetPin && p.isActive !== false
          );
          if (conflict) {
            return res.status(400).json({ error: "이미 사용 중인 출결번호입니다" });
          }
        }
      }

      const result = await storage.updateAttendancePin(req.params.id, { pin, isActive });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to update attendance pin" });
    }
  });

  app.delete("/api/attendance-pins/:id", async (req, res) => {
    try {
      await storage.deleteAttendancePin(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete attendance pin" });
    }
  });

  // Cleanup orphan records (where class has been deleted)
  app.post("/api/classes/cleanup-orphans", async (req, res) => {
    try {
      // Delete orphan enrollments using subquery
      await db.execute(sql`
        DELETE FROM enrollments 
        WHERE class_id NOT IN (SELECT id FROM classes)
      `);
      
      // Delete orphan attendance records (class_id is NULL)
      await db.delete(attendanceRecords).where(isNull(attendanceRecords.classId));
      
      console.log("[CLEANUP] Orphan records cleaned up successfully");
      res.json({ success: true, message: "삭제된 수업의 고아 기록이 정리되었습니다" });
    } catch (error) {
      console.error("Failed to cleanup orphan records:", error);
      res.status(500).json({ error: "Failed to cleanup orphan records" });
    }
  });

  // Teacher Check-in Settings (선생님 출근 설정)
  app.get("/api/teacher-check-in-settings", async (req, res) => {
    try {
      const { teacherId, centerId } = req.query;
      if (!teacherId || !centerId) {
        return res.status(400).json({ error: "teacherId and centerId are required" });
      }
      const settings = await storage.getTeacherCheckInSettings(teacherId as string, centerId as string);
      res.json(settings || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to get teacher check-in settings" });
    }
  });

  // Get all teacher check-in settings for a center (with teacher info)
  app.get("/api/teacher-check-in-settings/all", async (req, res) => {
    try {
      const { centerId } = req.query;
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      const allSettings = await storage.getAllTeacherCheckInSettings(centerId as string);
      // Attach teacher info to each setting
      const settingsWithTeachers = await Promise.all(
        allSettings.map(async (setting) => {
          const teacher = await storage.getUser(setting.teacherId);
          return { ...setting, teacher };
        })
      );
      res.json(settingsWithTeachers);
    } catch (error) {
      res.status(500).json({ error: "Failed to get all teacher check-in settings" });
    }
  });

  app.post("/api/teacher-check-in-settings", async (req, res) => {
    try {
      const { teacherId, centerId, smsRecipient1, smsRecipient2, messageTemplate, checkOutMessageTemplate, isActive } = req.body;
      
      if (!teacherId || !centerId) {
        return res.status(400).json({ error: "teacherId와 centerId가 필요합니다" });
      }

      // Get teacher info to generate check-in code from phone number
      const teacher = await storage.getUser(teacherId);
      if (!teacher) {
        return res.status(404).json({ error: "선생님 정보를 찾을 수 없습니다" });
      }

      // Generate check-in code from phone number
      const phoneDigits = (teacher.phone || "").replace(/\D/g, "");
      if (phoneDigits.length < 8) {
        return res.status(400).json({ error: "출근코드 생성을 위해 선생님 핸드폰번호가 필요합니다. 프로필에서 핸드폰번호를 먼저 등록해주세요." });
      }

      // Try last 4 digits first
      let checkInCode = phoneDigits.slice(-4);
      
      // Check if code conflicts with existing student PINs or other teachers' codes
      const existingPin = await storage.getAttendancePinByPin(centerId, checkInCode);
      const existingSettings = await storage.getTeacherCheckInSettingsByCode(centerId, checkInCode);
      
      if (existingPin || (existingSettings && existingSettings.teacherId !== teacherId)) {
        // Use middle 4 digits instead
        checkInCode = phoneDigits.slice(3, 7);
        
        // Check again with middle 4 digits
        const existingPin2 = await storage.getAttendancePinByPin(centerId, checkInCode);
        const existingSettings2 = await storage.getTeacherCheckInSettingsByCode(centerId, checkInCode);
        
        if (existingPin2 || (existingSettings2 && existingSettings2.teacherId !== teacherId)) {
          return res.status(400).json({ error: "출근코드 생성에 실패했습니다. 핸드폰번호를 확인해주세요." });
        }
      }

      // Check if settings already exist for this teacher at this center
      const currentSettings = await storage.getTeacherCheckInSettings(teacherId, centerId);
      if (currentSettings) {
        // Update existing settings (keep existing checkInCode if already set)
        const updatePayload: any = {
          checkInCode: currentSettings.checkInCode || checkInCode,
          smsRecipient1: smsRecipient1 || null,
          smsRecipient2: smsRecipient2 || null,
          messageTemplate: messageTemplate || null,
          isActive: isActive !== false,
        };
        if (checkOutMessageTemplate !== undefined) {
          updatePayload.checkOutMessageTemplate = checkOutMessageTemplate || null;
        }
        const updated = await storage.updateTeacherCheckInSettings(currentSettings.id, updatePayload);
        return res.json(updated);
      }

      // Create new settings
      const result = await storage.createTeacherCheckInSettings({
        teacherId,
        centerId,
        checkInCode,
        smsRecipient1: smsRecipient1 || null,
        smsRecipient2: smsRecipient2 || null,
        messageTemplate: messageTemplate || null,
        checkOutMessageTemplate: checkOutMessageTemplate || null,
        isActive: isActive !== false,
      });
      res.json(result);
    } catch (error) {
      console.error("Failed to create/update teacher check-in settings:", error);
      res.status(500).json({ error: "Failed to save teacher check-in settings" });
    }
  });

  // Update message template for all teachers in a center
  app.post("/api/teacher-check-in-settings/update-message-template", async (req, res) => {
    try {
      const { centerId, messageTemplate, checkOutMessageTemplate } = req.body;
      
      if (!centerId) {
        return res.status(400).json({ error: "centerId가 필요합니다" });
      }
      
      // Get all teacher check-in settings for this center
      const allSettings = await storage.getAllTeacherCheckInSettings(centerId);
      
      // Update message template for all settings in this center
      const updateData: any = {};
      if (messageTemplate !== undefined) updateData.messageTemplate = messageTemplate || null;
      if (checkOutMessageTemplate !== undefined) updateData.checkOutMessageTemplate = checkOutMessageTemplate || null;
      
      if (allSettings.length > 0) {
        for (const setting of allSettings) {
          await storage.updateTeacherCheckInSettings(setting.id, updateData);
        }
      } else {
        // No settings exist yet - store as system setting for this center
        const key = `teacher_message_template_${centerId}`;
        const value = JSON.stringify({
          messageTemplate: messageTemplate || null,
          checkOutMessageTemplate: checkOutMessageTemplate || null,
        });
        await storage.setSystemSetting(key, value);
      }
      
      res.json({ success: true, updated: allSettings.length });
    } catch (error) {
      console.error("Failed to update message template:", error);
      res.status(500).json({ error: "메시지 템플릿 저장에 실패했습니다" });
    }
  });

  app.patch("/api/teacher-check-in-settings/:id", async (req, res) => {
    try {
      const { checkInCode, smsRecipient1, smsRecipient2, messageTemplate, checkOutMessageTemplate, isActive, centerId, teacherId } = req.body;

      // Validate checkInCode if provided
      if (checkInCode) {
        if (!/^\d{4}$/.test(checkInCode)) {
          return res.status(400).json({ error: "출근코드는 4자리 숫자여야 합니다" });
        }

        if (centerId) {
          // Check if code conflicts with existing student PINs
          const existingPin = await storage.getAttendancePinByPin(centerId, checkInCode);
          if (existingPin) {
            return res.status(400).json({ error: "이 코드는 학생 출결번호와 중복됩니다. 다른 코드를 사용해 주세요." });
          }

          // Check if code conflicts with other teachers' codes
          const existingSettings = await storage.getTeacherCheckInSettingsByCode(centerId, checkInCode);
          if (existingSettings && existingSettings.id !== req.params.id) {
            return res.status(400).json({ error: "이 코드는 다른 선생님이 사용 중입니다. 다른 코드를 사용해 주세요." });
          }
        }
      }

      // Only include fields that were explicitly provided in the request
      const updateData: Record<string, any> = {};
      if (checkInCode !== undefined) updateData.checkInCode = checkInCode;
      if (smsRecipient1 !== undefined) updateData.smsRecipient1 = smsRecipient1;
      if (smsRecipient2 !== undefined) updateData.smsRecipient2 = smsRecipient2;
      if (messageTemplate !== undefined) updateData.messageTemplate = messageTemplate;
      if (checkOutMessageTemplate !== undefined) updateData.checkOutMessageTemplate = checkOutMessageTemplate;
      if (isActive !== undefined) updateData.isActive = isActive;

      const result = await storage.updateTeacherCheckInSettings(req.params.id, updateData);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to update teacher check-in settings" });
    }
  });

  app.delete("/api/teacher-check-in-settings/:id", async (req, res) => {
    try {
      await storage.deleteTeacherCheckInSettings(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete teacher check-in settings" });
    }
  });

  // Validate PIN and get enrolled classes for the student
  app.post("/api/attendance/validate-pin", async (req, res) => {
    try {
      const { centerId, pin } = req.body;
      
      if (!centerId || !pin) {
        return res.status(400).json({ error: "centerId and pin are required" });
      }
      
      // Validate PIN is exactly 4 digits
      if (!/^\d{4}$/.test(pin)) {
        return res.status(400).json({ error: "출결번호는 4자리 숫자여야 합니다" });
      }

      // STEP 1: Check student PIN first (students take priority to avoid collisions)
      // Find student by PIN
      console.log(`[VALIDATE-PIN] centerId=${centerId}, pinProvided=true`);
      const pinRecord = await storage.getAttendancePinByPin(centerId, pin);
      console.log(`[VALIDATE-PIN] studentMatch=${!!pinRecord}`);
      
      if (!pinRecord) {
        // STEP 2: No student found, check if this matches a teacher's custom check-in code
        const checkInSettings = await storage.getTeacherCheckInSettingsByCode(centerId, pin);
        console.log(`[VALIDATE-PIN] teacherCodeMatch=${!!checkInSettings}, isActive=${checkInSettings?.isActive || false}`);
        
        if (checkInSettings && checkInSettings.teacher && checkInSettings.isActive) {
          const matchedTeacher = checkInSettings.teacher;
          const now = new Date();
          // Use Korea timezone for SMS
          const koreaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
          const hours = koreaTime.getHours().toString().padStart(2, "0");
          const minutes = koreaTime.getMinutes().toString().padStart(2, "0");
          const checkInTime = `${hours}:${minutes}`;
          const dateStr = `${koreaTime.getMonth() + 1}월 ${koreaTime.getDate()}일`;

          // Send response immediately - SMS will be sent from teacher-work/punch endpoint
          res.json({
            success: true,
            type: "teacher",
            teacher: { 
              id: matchedTeacher.id, 
              name: matchedTeacher.name,
              role: matchedTeacher.role
            },
            checkInTime: now,
            message: `${matchedTeacher.name} 선생님`
          });
          return;
        }

        // STEP 3: No custom code found, check if this matches a teacher's phone number (legacy fallback)
        const centerUsers = await storage.getCenterUsers(centerId);
        const teachers = centerUsers.filter(u => 
          u.role === UserRole.TEACHER || 
          u.role === UserRole.CLINIC_TEACHER || 
          u.role === UserRole.PRINCIPAL || 
          u.role === UserRole.ADMIN
        );

        // Match by last 4 digits or middle 4 digits of phone number
        const matchedTeacher = teachers.find(t => {
          if (!t.phone) return false;
          const phone = t.phone.replace(/\D/g, ""); // Remove non-digits
          if (phone.length < 4) return false;
          
          // Check last 4 digits
          const last4 = phone.slice(-4);
          if (last4 === pin) return true;
          
          // Check middle 4 digits (for 010-XXXX-YYYY format, middle is positions 3-6)
          if (phone.length >= 7) {
            const middle4 = phone.slice(3, 7);
            if (middle4 === pin) return true;
          }
          
          return false;
        });

        console.log(`[VALIDATE-PIN] legacyPhoneMatch=${!!matchedTeacher}`);
        if (matchedTeacher) {
          const now = new Date();
          // Use Korea timezone for SMS
          const koreaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
          const hours = koreaTime.getHours().toString().padStart(2, "0");
          const minutes = koreaTime.getMinutes().toString().padStart(2, "0");
          const checkInTime = `${hours}:${minutes}`;

          // Send response immediately - SMS will be sent from teacher-work/punch endpoint
          res.json({
            success: true,
            type: "teacher",
            teacher: { 
              id: matchedTeacher.id, 
              name: matchedTeacher.name,
              role: matchedTeacher.role
            },
            checkInTime: now,
            message: `${matchedTeacher.name} 선생님`
          });
          return;
        }

        // Neither student nor teacher found
        return res.status(404).json({ error: "등록되지 않은 출결번호입니다" });
      }

      // Student found - proceed with student flow
      // Get student's enrolled classes in this center
      const enrolledClasses = await storage.getStudentEnrolledClasses(pinRecord.studentId, centerId);
      
      // Filter to only active (non-archived) classes
      const activeClasses = enrolledClasses.filter(c => !c.isArchived);

      res.json({
        success: true,
        type: "student",
        student: pinRecord.student,
        classes: activeClasses,
      });
    } catch (error) {
      console.error("PIN validation error:", error);
      res.status(500).json({ error: "출결번호 확인에 실패했습니다" });
    }
  });

  // Attendance Check-in - 출결 체크인 (출결 패드에서 호출)
  app.post("/api/attendance/check-in", async (req, res) => {
    try {
      const { centerId, pin, classId } = req.body;
      if (!centerId || !pin) {
        return res.status(400).json({ error: "centerId and pin are required" });
      }
      
      // Validate PIN is exactly 4 digits
      if (!/^\d{4}$/.test(pin)) {
        return res.status(400).json({ error: "출결번호는 4자리 숫자여야 합니다" });
      }

      // Find student by PIN
      const pinRecord = await storage.getAttendancePinByPin(centerId, pin);
      if (!pinRecord) {
        return res.status(404).json({ error: "등록되지 않은 출결번호입니다" });
      }

      const today = getKoreanToday();

      // Check if already checked in today for this specific class (or center-level if no classId)
      let existingRecord;
      if (classId) {
        existingRecord = await storage.getAttendanceRecordByStudentDateAndClass(pinRecord.studentId, today, classId);
      } else {
        // For students without class enrollment, check for any center-level check-in today
        existingRecord = await storage.getAttendanceRecordByStudentAndDate(pinRecord.studentId, today);
      }
      if (existingRecord) {
        if (existingRecord.attendanceStatus === "late" || existingRecord.attendanceStatus === "pending" || existingRecord.attendanceStatus === "absent") {
          const wasOriginallyLate = existingRecord.attendanceStatus === "late";
          const updatedRecord = await storage.updateAttendanceRecord(existingRecord.id, {
            attendanceStatus: "present",
            checkInAt: new Date(),
            ...(wasOriginallyLate ? { wasLate: true, lateNotificationSentAt: existingRecord.checkInAt } : {}),
          });
          
          let className = "";
          if (classId) {
            const classInfo = await storage.getClass(classId);
            if (classInfo) {
              const baseName = classInfo.subject ? `${classInfo.name} ${classInfo.subject}반` : classInfo.name;
              className = classInfo.classroom ? `${baseName} (${classInfo.classroom})` : baseName;
            }
          }

          res.json({
            success: true,
            student: pinRecord.student,
            checkInTime: updatedRecord?.checkInAt || new Date(),
            className,
            message: `${pinRecord.student?.name} 출결 완료!`
          });

          const center = await storage.getCenter(centerId);

          // 출결 푸시 알림 (학생 본인 + 학부모)
          try {
            const checkInTimeStr = (updatedRecord?.checkInAt || new Date()).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });
            const pushTitle = `[${center?.name || "학원"}] 등원 완료`;
            const pushBody = `${pinRecord.student?.name} 학생이 ${checkInTimeStr}에 등원했습니다.${className ? ` (${className})` : ""}`;
            const pushTargets: string[] = [];
            if (pinRecord.studentId) pushTargets.push(pinRecord.studentId);
            if (pinRecord.student?.parentId) pushTargets.push(pinRecord.student.parentId);
            for (const targetId of pushTargets) {
              storage.createNotification({
                userId: targetId,
                type: "attendance_checkin",
                title: pushTitle,
                message: pushBody,
                relatedId: existingRecord.id,
                relatedType: "attendance",
              }).catch(err => console.error("[ATTENDANCE-PAD] Push notification create error:", err));
            }
          } catch (e) {
            console.error("[ATTENDANCE-PAD] Push notification block error:", e);
          }

          const solapiReady = await isSolapiConfigured(center?.name);
          if (solapiReady && pinRecord.student) {
            const student = pinRecord.student;
            const parentPhone = student.motherPhone || student.fatherPhone;
            if (parentPhone) {
              const templates = await storage.getMessageTemplates(centerId);
              const checkInTemplate = templates.find((t) => t.type === "check_in");
              sendAttendanceNotification(student.name, new Date(), parentPhone, center?.name, checkInTemplate?.body, center?.id)
                .then(async (result) => {
                  await storage.createNotificationLog({
                    attendanceRecordId: existingRecord.id,
                    recipientPhone: parentPhone,
                    recipientType: student.motherPhone ? "mother" : "father",
                    messageType: "attendance_checkin",
                    channel: "sms",
                    status: result.success ? "sent" : "failed",
                    errorMessage: result.error || null,
                    messageContent: result.sentText || null,
                  });
                })
                .catch(err => console.error("[ATTENDANCE-PAD] Notification error:", err));
            }
          }
          return;
        }
        return res.status(400).json({ 
          error: "이미 출석 체크가 완료되었습니다",
          student: pinRecord.student,
          checkInTime: existingRecord.checkInAt
        });
      }

      // Create attendance record
      const record = await storage.createAttendanceRecord({
        studentId: pinRecord.studentId,
        centerId,
        classId: classId || undefined,
        checkInDate: today,
      });

      // Get class name for the message if classId provided
      let className = "";
      if (classId) {
        const classInfo = await storage.getClass(classId);
        if (classInfo) {
          const baseName = classInfo.subject ? `${classInfo.name} ${classInfo.subject}반` : classInfo.name;
          className = classInfo.classroom ? `${baseName} (${classInfo.classroom})` : baseName;
        }
      }

      res.json({
        success: true,
        student: pinRecord.student,
        checkInTime: record.checkInAt,
        className,
        message: `${pinRecord.student?.name} 출결 완료!`
      });

      // Send notification to parent/student via SOLAPI (async, don't wait)
      const center = await storage.getCenter(centerId);

      // 출결 푸시 알림 (학생 본인 + 학부모)
      try {
        const checkInTimeStr = new Date(record.checkInAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });
        const pushTitle = `[${center?.name || "학원"}] 등원 완료`;
        const pushBody = `${pinRecord.student?.name} 학생이 ${checkInTimeStr}에 등원했습니다.${className ? ` (${className})` : ""}`;
        const pushTargets: string[] = [];
        if (pinRecord.studentId) pushTargets.push(pinRecord.studentId);
        if (pinRecord.student?.parentId) pushTargets.push(pinRecord.student.parentId);
        for (const targetId of pushTargets) {
          storage.createNotification({
            userId: targetId,
            type: "attendance_checkin",
            title: pushTitle,
            message: pushBody,
            relatedId: record.id,
            relatedType: "attendance",
          }).catch(err => console.error("[ATTENDANCE-PAD] Push notification create error:", err));
        }
      } catch (e) {
        console.error("[ATTENDANCE-PAD] Push notification block error:", e);
      }

      const solapiReady = await isSolapiConfigured(center?.name);
      
      if (solapiReady && pinRecord.student) {
        const student = pinRecord.student;
        const parentPhone = student.motherPhone || student.fatherPhone;
        
        if (parentPhone) {
          const checkInTime = new Date(record.checkInAt);
          
          // Get custom message templates (like manual check-in does)
          const templates = await storage.getMessageTemplates(centerId);
          const checkInTemplate = templates.find((t) => t.type === "check_in");
          
          sendAttendanceNotification(student.name, checkInTime, parentPhone, center?.name, checkInTemplate?.body, center?.id)
            .then(async (result) => {
              if (result.success) {
              } else {
                console.error(`[ATTENDANCE-PAD] Failed to send notification: ${result.error}`);
              }
              // Log notification result
              await storage.createNotificationLog({
                attendanceRecordId: record.id,
                recipientPhone: parentPhone,
                recipientType: student.motherPhone ? "mother" : "father",
                messageType: "attendance_checkin",
                channel: "sms",
                status: result.success ? "sent" : "failed",
                errorMessage: result.error || null,
                messageContent: result.sentText || null,
              });
            })
            .catch(err => console.error("[ATTENDANCE-PAD] Notification error:", err));
        }
      }
    } catch (error) {
      console.error("Check-in error:", error);
      res.status(500).json({ error: "출석 체크에 실패했습니다" });
    }
  });

  // Attendance Check-out - 하원 체크아웃 (출결 패드에서 호출)
  app.post("/api/attendance/check-out", async (req, res) => {
    try {
      const { centerId, pin } = req.body;
      if (!centerId || !pin) {
        return res.status(400).json({ error: "centerId and pin are required" });
      }
      
      // Validate PIN is exactly 4 digits
      if (!/^\d{4}$/.test(pin)) {
        return res.status(400).json({ error: "출결번호는 4자리 숫자여야 합니다" });
      }

      // Find student by PIN
      const pinRecord = await storage.getAttendancePinByPin(centerId, pin);
      if (!pinRecord) {
        return res.status(404).json({ error: "등록되지 않은 출결번호입니다" });
      }

      const today = getKoreanToday();

      // Find today's check-in records without check-out
      const allTodayRecords = await storage.getAttendanceRecordsByStudentAndDate(pinRecord.studentId, today);
      
      const checkOutTime = new Date();
      let recordId: string;
      
      const recordsWithoutCheckout = allTodayRecords.filter(r => !r.checkOutAt);
      
      if (allTodayRecords.length === 0) {
        // No check-in record exists - create a new record with only check-out time
        const newRecord = await storage.createAttendanceRecordCheckOutOnly({
          studentId: pinRecord.studentId,
          centerId,
          checkInDate: today,
          checkOutAt: checkOutTime,
        });
        recordId = newRecord.id;
      } else if (recordsWithoutCheckout.length === 0) {
        return res.status(400).json({ 
          error: "이미 하원 체크가 완료되었습니다",
          student: pinRecord.student,
          checkOutTime: allTodayRecords[0].checkOutAt
        });
      } else {
        // Update all records without check-out time
        for (const rec of recordsWithoutCheckout) {
          await storage.updateAttendanceRecordCheckOut(rec.id, checkOutTime);
          if (rec.attendanceStatus === "absent" || rec.attendanceStatus === "pending") {
            await storage.updateAttendanceRecord(rec.id, {
              attendanceStatus: "present",
            });
          }
        }
        recordId = recordsWithoutCheckout[0].id;
      }

      res.json({
        success: true,
        student: pinRecord.student,
        checkOutTime,
        message: `${pinRecord.student?.name} 하원 완료!`
      });

      // Send notification to parent/student via SOLAPI (async, don't wait)
      const center = await storage.getCenter(centerId);

      // 하원 푸시 알림 (학생 본인 + 학부모)
      try {
        const checkOutTimeStr = checkOutTime.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });
        const pushTitle = `[${center?.name || "학원"}] 하원 완료`;
        const pushBody = `${pinRecord.student?.name} 학생이 ${checkOutTimeStr}에 하원했습니다.`;
        const pushTargets: string[] = [];
        if (pinRecord.studentId) pushTargets.push(pinRecord.studentId);
        if (pinRecord.student?.parentId) pushTargets.push(pinRecord.student.parentId);
        for (const targetId of pushTargets) {
          storage.createNotification({
            userId: targetId,
            type: "attendance_checkout",
            title: pushTitle,
            message: pushBody,
            relatedId: recordId,
            relatedType: "attendance",
          }).catch(err => console.error("[ATTENDANCE-PAD] Push notification create error:", err));
        }
      } catch (e) {
        console.error("[ATTENDANCE-PAD] Push notification block error:", e);
      }

      const solapiReady = await isSolapiConfigured(center?.name);
      
      if (solapiReady && pinRecord.student) {
        const student = pinRecord.student;
        const parentPhone = student.motherPhone || student.fatherPhone;
        
        if (parentPhone) {
          // Get custom check-out message templates
          const templates = await storage.getMessageTemplates(centerId);
          const checkOutTemplate = templates.find((t) => t.type === "check_out");
          
          // Format check-out message
          let messageBody = checkOutTemplate?.body || "[{학원명}] {학생명} 학생이 {시간}에 하원하였습니다.";
          messageBody = messageBody
            .replace(/{학원명}/g, center?.name || "학원")
            .replace(/{학생명}/g, student.name)
            .replace(/{시간}/g, checkOutTime.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }))
            .replace(/{날짜}/g, checkOutTime.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" }));
          
          sendSms({
            to: parentPhone.replace(/\D/g, ""),
            text: messageBody,
            centerName: center?.name,
            centerId: center?.id,
          })
            .then(async (result: { success: boolean; error?: string }) => {
              if (result.success) {
                // Mark as sent
                await storage.updateAttendanceRecordCheckOutNotificationSent(recordId);
              } else {
                console.error(`[ATTENDANCE-PAD] Failed to send check-out notification: ${result.error}`);
              }
              // Log notification result
              await storage.createNotificationLog({
                attendanceRecordId: recordId,
                recipientPhone: parentPhone,
                recipientType: student.motherPhone ? "mother" : "father",
                messageType: "check_out",
                channel: "sms",
                status: result.success ? "sent" : "failed",
                errorMessage: result.error || null,
                messageContent: messageBody,
              });
            })
            .catch((err: Error) => console.error("[ATTENDANCE-PAD] Check-out notification error:", err));
        } else {
        }
      }
    } catch (error) {
      console.error("Check-out error:", error);
      res.status(500).json({ error: "하원 체크에 실패했습니다" });
    }
  });

  // Teacher Check-in - 선생님 출근 체크 (출결 패드에서 호출) - Legacy endpoint
  app.post("/api/attendance/teacher-check-in", async (req, res) => {
    try {
      const { centerId, phoneDigits } = req.body;
      if (!centerId || !phoneDigits) {
        return res.status(400).json({ error: "centerId and phoneDigits are required" });
      }
      
      // Validate phoneDigits is exactly 4 digits
      if (!/^\d{4}$/.test(phoneDigits)) {
        return res.status(400).json({ error: "전화번호 4자리를 입력해주세요" });
      }

      // Find teacher by phone number (last 4 or middle 4 digits)
      const centerUsers = await storage.getCenterUsers(centerId);
      const teachers = centerUsers.filter(u => 
        u.role === UserRole.TEACHER || 
        u.role === UserRole.CLINIC_TEACHER || 
        u.role === UserRole.PRINCIPAL || 
        u.role === UserRole.ADMIN
      );

      // Match by last 4 digits or middle 4 digits of phone number
      const matchedTeacher = teachers.find(t => {
        if (!t.phone) return false;
        const phone = t.phone.replace(/\D/g, ""); // Remove non-digits
        if (phone.length < 4) return false;
        
        // Check last 4 digits
        const last4 = phone.slice(-4);
        if (last4 === phoneDigits) return true;
        
        // Check middle 4 digits (for 010-XXXX-YYYY format, middle is positions 3-6)
        if (phone.length >= 7) {
          const middle4 = phone.slice(3, 7);
          if (middle4 === phoneDigits) return true;
        }
        
        return false;
      });

      if (!matchedTeacher) {
        return res.status(404).json({ error: "등록된 선생님을 찾을 수 없습니다" });
      }

      const now = new Date();
      // Use Korea timezone
      const koreaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
      const hours = koreaTime.getHours().toString().padStart(2, "0");
      const minutes = koreaTime.getMinutes().toString().padStart(2, "0");
      const checkInTime = `${hours}:${minutes}`;

      // SMS will be sent from teacher-work/punch endpoint
      res.json({
        success: true,
        teacher: { 
          id: matchedTeacher.id, 
          name: matchedTeacher.name,
          role: matchedTeacher.role
        },
        checkInTime: now,
        message: `${matchedTeacher.name} 선생님`
      });
    } catch (error) {
      console.error("Teacher check-in error:", error);
      res.status(500).json({ error: "출근 체크에 실패했습니다" });
    }
  });

  // Teacher Work Record - 선생님 출퇴근 기록 (출근/퇴근 버튼)
  app.post("/api/teacher-work/punch", async (req, res) => {
    try {
      const { teacherId, centerId, type } = req.body; // type: 'check_in' | 'check_out'
      if (!teacherId || !centerId || !type) {
        return res.status(400).json({ error: "teacherId, centerId, and type are required" });
      }

      const now = new Date();
      const today = format(now, "yyyy-MM-dd");
      const koreaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
      const hours = koreaTime.getHours().toString().padStart(2, "0");
      const minutes = koreaTime.getMinutes().toString().padStart(2, "0");
      
      // Check if there's an existing record for today
      let record = await storage.getTeacherWorkRecordByDate(teacherId, centerId, today);
      let actionType: "check_in" | "check_out";
      let responseMessage: string;
      
      const teacher = await storage.getUser(teacherId);
      const teacherName = teacher?.name || "선생님";
      
      if (!record) {
        record = await storage.createTeacherWorkRecord({
          teacherId,
          centerId,
          workDate: today,
          checkInAt: now,
        });
        actionType = "check_in";
        responseMessage = `${teacherName} 출근 완료! (${hours}:${minutes})`;
        
        res.json({
          success: true,
          actionType,
          message: responseMessage,
          checkInAt: now,
        });
      } else {
        const workMinutes = record.checkInAt ? 
          Math.floor((now.getTime() - new Date(record.checkInAt).getTime()) / 60000) : 0;
        
        await storage.updateTeacherWorkRecord(record.id, {
          checkOutAt: now,
          workMinutes,
          noCheckOut: false,
        });
        
        actionType = "check_out";
        const workHours = Math.floor(workMinutes / 60);
        const workMins = workMinutes % 60;
        responseMessage = `${teacherName} 퇴근 완료! (${hours}:${minutes}) - 근무시간: ${workHours}시간 ${workMins}분`;
        
        res.json({
          success: true,
          actionType,
          message: responseMessage,
          checkOutAt: now,
          workMinutes,
        });
      }

      // Send SMS notification (async, don't block response)
      (async () => {
        try {
          const center = await storage.getCenter(centerId);
          const solapiReady = await isSolapiConfigured(center?.name);
          if (!solapiReady) {
            console.log(`[TEACHER-PUNCH] SOLAPI not ready for ${center?.name}, skipping SMS`);
            return;
          }

          const checkInSettings = await storage.getTeacherCheckInSettings(teacherId, centerId);
          const formattedTime = `${hours}시 ${minutes}분`;
          const dateStr = `${koreaTime.getMonth() + 1}월 ${koreaTime.getDate()}일`;

          const applyTemplate = (template: string) =>
            template
              .replace(/{name}/g, teacherName)
              .replace(/{선생님명}/g, teacherName)
              .replace(/{time}/g, formattedTime)
              .replace(/{시간}/g, formattedTime)
              .replace(/{date}/g, dateStr)
              .replace(/{날짜}/g, dateStr)
              .replace(/{센터명}/g, center?.name || "학원")
              .replace(/{학원명}/g, center?.name || "학원")
              .replace(/{center}/g, center?.name || "학원");

          // Get templates from settings or fallback to system settings
          let checkInTemplate = checkInSettings?.messageTemplate || null;
          let checkOutTemplate = checkInSettings?.checkOutMessageTemplate || null;
          if (!checkInTemplate || !checkOutTemplate) {
            const sysVal = await storage.getSystemSetting(`teacher_message_template_${centerId}`);
            if (sysVal) {
              try {
                const parsed = JSON.parse(sysVal);
                if (!checkInTemplate && parsed.messageTemplate) checkInTemplate = parsed.messageTemplate;
                if (!checkOutTemplate && parsed.checkOutMessageTemplate) checkOutTemplate = parsed.checkOutMessageTemplate;
              } catch {}
            }
          }

          let smsMessage: string;
          if (actionType === "check_out") {
            smsMessage = checkOutTemplate
              ? applyTemplate(checkOutTemplate)
              : `[${center?.name || "학원"}] ${teacherName} 선생님 퇴근 확인 (${formattedTime})`;
          } else {
            smsMessage = checkInTemplate
              ? applyTemplate(checkInTemplate)
              : `[${center?.name || "학원"}] ${teacherName} 선생님 출근 확인 (${formattedTime})`;
          }

          let recipients = [checkInSettings?.smsRecipient1, checkInSettings?.smsRecipient2]
            .filter((r): r is string => !!r);

          if (recipients.length === 0) {
            const allSettings = await storage.getAllTeacherCheckInSettings(centerId);
            const fallbackRecipients = new Set<string>();
            for (const s of allSettings) {
              if (s.smsRecipient1) fallbackRecipients.add(s.smsRecipient1);
              if (s.smsRecipient2) fallbackRecipients.add(s.smsRecipient2);
            }
            recipients = Array.from(fallbackRecipients);
          }

          if (recipients.length === 0) {
            const centerUsers = await storage.getCenterUsers(centerId);
            const principals = centerUsers.filter(u => u.role === UserRole.PRINCIPAL && u.phone);
            for (const p of principals) {
              if (p.phone) recipients.push(p.phone);
            }
          }

          console.log(`[TEACHER-PUNCH] ${actionType} SMS to ${recipients.length} recipient(s) for ${teacherName}`);
          for (const recipient of recipients) {
            sendSms({
              to: recipient.replace(/\D/g, ""),
              text: smsMessage,
              centerName: center?.name,
              centerId: center?.id,
            })
              .then(result => {
                if (result.success) {
                  console.log(`[TEACHER-PUNCH] SMS sent to ${recipient.slice(0, 3)}****`);
                } else {
                  console.error(`[TEACHER-PUNCH] SMS failed: ${result.error}`);
                }
              })
              .catch((err: Error) => console.error("[TEACHER-PUNCH] SMS error:", err));
          }
        } catch (smsErr) {
          console.error("[TEACHER-PUNCH] SMS notification error:", smsErr);
        }
      })();
    } catch (error) {
      console.error("Teacher work punch error:", error);
      res.status(500).json({ error: "출퇴근 기록에 실패했습니다" });
    }
  });

  // Get teacher work records for management tab
  app.get("/api/teacher-work-records", async (req, res) => {
    try {
      const { centerId, startDate, endDate } = req.query;
      if (!centerId || !startDate || !endDate) {
        return res.status(400).json({ error: "centerId, startDate, and endDate are required" });
      }
      
      const records = await storage.getTeacherWorkRecords(
        centerId as string, 
        startDate as string, 
        endDate as string
      );
      
      // Enrich with teacher names
      const enrichedRecords = await Promise.all(records.map(async (record) => {
        const teacher = await storage.getUser(record.teacherId);
        return {
          ...record,
          teacherName: teacher?.name || "Unknown",
        };
      }));
      
      res.json(enrichedRecords);
    } catch (error) {
      console.error("Failed to get teacher work records:", error);
      res.status(500).json({ error: "Failed to get teacher work records" });
    }
  });

  // Get teacher work days count for a specific month (for hourly salary calculation)
  app.get("/api/teacher-work-days", async (req, res) => {
    try {
      const { centerId, yearMonth } = req.query;
      if (!centerId || !yearMonth) {
        return res.status(400).json({ error: "centerId and yearMonth are required" });
      }
      
      // Parse yearMonth to get date range (e.g., "2025-01" -> "2025-01-01" to "2025-01-31")
      const [year, month] = (yearMonth as string).split("-").map(Number);
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate(); // Last day of the month
      const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      
      const records = await storage.getTeacherWorkRecords(
        centerId as string, 
        startDate, 
        endDate
      );
      
      // Count work days per teacher
      const workDaysMap: Record<string, number> = {};
      for (const record of records) {
        if (!workDaysMap[record.teacherId]) {
          workDaysMap[record.teacherId] = 0;
        }
        workDaysMap[record.teacherId]++;
      }
      
      res.json(workDaysMap);
    } catch (error) {
      console.error("Failed to get teacher work days:", error);
      res.status(500).json({ error: "Failed to get teacher work days" });
    }
  });

  // 한국 시간 기준 현재 연-월 (YYYY-MM) — 재무 스냅샷 동결 기준
  const getCurrentYearMonthKST = () =>
    new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 7);

  // Teacher schedule-based hours calculation for hourly wage
  // 현재 시간표 기준으로 센터 전체 강사별 수업 시간을 계산 (전체 맵)
  const computeScheduleHoursMap = async (centerId: string, yearMonth: string): Promise<Record<string, { totalHours: number; details: any[] }>> => {
    const [year, month] = yearMonth.split("-").map(Number);
    const teacherClasses = await storage.getClasses(centerId);
    const filtered = teacherClasses.filter(c => !c.isArchived);

    const dayMap: Record<string, string> = { sun: "0", mon: "1", tue: "2", wed: "3", thu: "4", fri: "5", sat: "6" };

    const countWeekdaysInMonth = (y: number, m: number, dayOfWeek: number) => {
      let count = 0;
      const daysInMonth = new Date(y, m, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        if (new Date(y, m - 1, d).getDay() === dayOfWeek) count++;
      }
      return count;
    };

    const calcHours = (start: string, end: string) => {
      const [sh, sm] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
    };

    const teacherHoursMap: Record<string, { totalHours: number; details: any[] }> = {};

    const uniqueIds = new Set<string>();
    for (const cls of filtered) {
      if (cls.teacherId) uniqueIds.add(cls.teacherId);
      for (const aid of getAssistantTeacherIds(cls)) uniqueIds.add(aid);
    }

    for (const tid of Array.from(uniqueIds)) {
      const teacherFiltered = filtered.filter(c => c.teacherId === tid || isAssistantTeacher(c, tid));
      for (const cls of teacherFiltered) {
        let scheduleEntries: Array<{ day: string; startTime: string; endTime: string }> = [];
        if (cls.schedule) {
          try {
            scheduleEntries = JSON.parse(cls.schedule);
          } catch {}
        }
        if (scheduleEntries.length === 0 && cls.days) {
          scheduleEntries = cls.days.map(d => ({
            day: d,
            startTime: cls.startTime,
            endTime: cls.endTime,
          }));
        }

        if (!teacherHoursMap[tid]) {
          teacherHoursMap[tid] = { totalHours: 0, details: [] };
        }

        for (const entry of scheduleEntries) {
          const dow = parseInt(dayMap[entry.day] || "0");
          const occurrences = countWeekdaysInMonth(year, month, dow);
          const hoursPerSession = calcHours(entry.startTime, entry.endTime);
          const totalForThis = hoursPerSession * occurrences;
          teacherHoursMap[tid].totalHours += totalForThis;
          teacherHoursMap[tid].details.push({
            classId: cls.id,
            className: `${cls.name} ${cls.subject}`,
            day: entry.day,
            startTime: entry.startTime,
            endTime: entry.endTime,
            hoursPerSession: Math.round(hoursPerSession * 100) / 100,
            occurrences,
            totalHours: Math.round(totalForThis * 100) / 100,
            classHourlyRate: cls.hourlyRate != null ? cls.hourlyRate : null,
            isAssistant: tid !== cls.teacherId && isAssistantTeacher(cls, tid),
          });
        }
      }
    }

    for (const tid of Object.keys(teacherHoursMap)) {
      teacherHoursMap[tid].totalHours = Math.round(teacherHoursMap[tid].totalHours * 100) / 100;
    }

    return teacherHoursMap;
  };

  app.get("/api/teacher-schedule-hours", async (req, res) => {
    try {
      const { centerId, yearMonth, teacherId } = req.query;
      if (!centerId || !yearMonth) {
        return res.status(400).json({ error: "centerId and yearMonth are required" });
      }

      const currentYM = getCurrentYearMonthKST();
      const requestedYM = yearMonth as string;
      let teacherHoursMap: Record<string, { totalHours: number; details: any[] }>;

      if (requestedYM < currentYM) {
        // 지난달: 동결된 스냅샷 우선 사용, 없으면 최초 1회 계산 후 동결
        const snapshot = await storage.getFinanceSnapshot(centerId as string, requestedYM, "scheduleHours");
        if (snapshot) {
          teacherHoursMap = JSON.parse(snapshot.data);
        } else {
          teacherHoursMap = await computeScheduleHoursMap(centerId as string, requestedYM);
          await storage.upsertFinanceSnapshot(centerId as string, requestedYM, "scheduleHours", JSON.stringify(teacherHoursMap));
        }
      } else {
        // 이번 달(또는 미래): 실시간 계산 + 이번 달이면 스냅샷 갱신
        teacherHoursMap = await computeScheduleHoursMap(centerId as string, requestedYM);
        if (requestedYM === currentYM) {
          storage.upsertFinanceSnapshot(centerId as string, requestedYM, "scheduleHours", JSON.stringify(teacherHoursMap))
            .catch(err => console.error("Failed to save schedule hours snapshot:", err));
        }
      }

      if (teacherId) {
        const tid = teacherId as string;
        return res.json(teacherHoursMap[tid] ? { [tid]: teacherHoursMap[tid] } : {});
      }
      res.json(teacherHoursMap);
    } catch (error) {
      console.error("Failed to get teacher schedule hours:", error);
      res.status(500).json({ error: "Failed to get teacher schedule hours" });
    }
  });

  app.get("/api/teacher-absent-days", async (req, res) => {
    try {
      const { centerId, yearMonth, teacherId } = req.query;
      if (!centerId || !yearMonth || !teacherId) {
        return res.status(400).json({ error: "centerId, yearMonth, teacherId are required" });
      }

      const [year, month] = (yearMonth as string).split("-").map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      const teacherClasses = await storage.getClasses(centerId as string);
      const myClasses = teacherClasses.filter(c => !c.isArchived && (c.teacherId === teacherId || isAssistantTeacher(c, teacherId)));

      const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

      const scheduledDays = new Set<string>();
      for (const cls of myClasses) {
        let entries: Array<{ day: string; startTime: string; endTime: string }> = [];
        if (cls.schedule) {
          try { entries = JSON.parse(cls.schedule); } catch {}
        }
        if (entries.length === 0 && cls.days) {
          entries = cls.days.map(d => ({ day: d, startTime: cls.startTime, endTime: cls.endTime }));
        }
        for (const entry of entries) {
          const dow = dayMap[entry.day] ?? -1;
          if (dow < 0) continue;
          for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month - 1, d);
            if (date > today) continue;
            if (date.getDay() === dow) {
              scheduledDays.add(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
            }
          }
        }
      }

      const workRecords = await storage.getTeacherWorkRecords(
        centerId as string,
        `${year}-${String(month).padStart(2, "0")}-01`,
        `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`
      );
      const workedDays = new Set<string>();
      workRecords
        .filter(r => r.teacherId === teacherId)
        .forEach(r => workedDays.add(r.workDate));

      const absentDays: string[] = [];
      for (const day of scheduledDays) {
        if (!workedDays.has(day)) {
          absentDays.push(day);
        }
      }
      absentDays.sort();

      const calcHours = (start: string, end: string) => {
        const [sh, sm] = start.split(":").map(Number);
        const [eh, em] = end.split(":").map(Number);
        return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
      };

      const absentDetails = absentDays.map(dateStr => {
        const [ay, am, ad] = dateStr.split("-").map(Number);
        const date = new Date(ay, am - 1, ad);
        const dow = date.getDay();
        let totalHours = 0;
        const classes: string[] = [];
        for (const cls of myClasses) {
          let entries: Array<{ day: string; startTime: string; endTime: string }> = [];
          if (cls.schedule) {
            try { entries = JSON.parse(cls.schedule); } catch {}
          }
          if (entries.length === 0 && cls.days) {
            entries = cls.days.map(d => ({ day: d, startTime: cls.startTime, endTime: cls.endTime }));
          }
          for (const entry of entries) {
            if ((dayMap[entry.day] ?? -1) === dow) {
              totalHours += calcHours(entry.startTime, entry.endTime);
              classes.push(`${cls.name} ${cls.subject}`);
            }
          }
        }
        return { date: dateStr, hours: Math.round(totalHours * 100) / 100, classes };
      });

      res.json({ absentDays: absentDetails, scheduledDayCount: scheduledDays.size, workedDayCount: workedDays.size });
    } catch (error) {
      console.error("Failed to get teacher absent days:", error);
      res.status(500).json({ error: "Failed to get teacher absent days" });
    }
  });

  app.patch("/api/classes/:classId/hourly-rate", async (req, res) => {
    try {
      const { classId } = req.params;
      const { hourlyRate, actorId } = req.body;
      if (!actorId) return res.status(400).json({ error: "actorId is required" });
      const actor = await storage.getUser(actorId);
      if (!actor || (actor.role < 3)) return res.status(403).json({ error: "권한이 없습니다" });
      const cls = await storage.getClass(classId);
      if (!cls) return res.status(404).json({ error: "수업을 찾을 수 없습니다" });
      await db.update(classes).set({ hourlyRate: hourlyRate === null ? null : parseInt(hourlyRate) }).where(eq(classes.id, classId));
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to update class hourly rate:", error);
      res.status(500).json({ error: "Failed to update class hourly rate" });
    }
  });

  app.patch("/api/classes/bulk-hourly-rate", async (req, res) => {
    try {
      const { classRates, actorId } = req.body;
      console.log("[BULK-HOURLY-RATE] Request received:", JSON.stringify({ classRatesCount: classRates?.length, actorId, classRates }));
      if (!actorId) return res.status(400).json({ error: "actorId is required" });
      const actor = await storage.getUser(actorId);
      if (!actor || (actor.role < 3)) return res.status(403).json({ error: "권한이 없습니다" });
      if (!Array.isArray(classRates)) return res.status(400).json({ error: "classRates array is required" });
      for (const { classId, hourlyRate } of classRates) {
        if (!classId) continue;
        console.log(`[BULK-HOURLY-RATE] Updating class ${classId} -> hourlyRate: ${hourlyRate}`);
        await db.update(classes).set({ hourlyRate: hourlyRate === null ? null : parseInt(hourlyRate) }).where(eq(classes.id, classId));
      }
      console.log(`[BULK-HOURLY-RATE] Done: ${classRates.length} classes updated`);
      res.json({ success: true, updated: classRates.length });
    } catch (error) {
      console.error("Failed to bulk update class hourly rates:", error);
      res.status(500).json({ error: "Failed to bulk update class hourly rates" });
    }
  });

  // Attendance Records - 출결 기록 조회
  app.get("/api/attendance-records", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      const date = req.query.date as string;
      if (!centerId || !date) {
        return res.status(400).json({ error: "centerId and date are required" });
      }
      const records = await storage.getAttendanceRecords(centerId, date);
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Failed to get attendance records" });
    }
  });

  // Get all attendance records for a date with student info - sorted by check-in time
  app.get("/api/attendance/by-date", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      const date = req.query.date as string;
      if (!centerId || !date) {
        return res.status(400).json({ error: "centerId and date are required" });
      }
      const records = await storage.getAttendanceRecordsByDateWithStudents(centerId, date);
      
      const recordsWithLogs = await Promise.all(records.map(async (record: any) => {
        const logs = await storage.getNotificationLogsByAttendanceRecord(record.id);
        return {
          ...record,
          notificationLogs: logs
            .filter(l => l.sentAt !== null)
            .map(l => ({ sentAt: l.sentAt as Date, status: l.status, messageType: l.messageType || "unknown", messageContent: l.messageContent || undefined })),
        };
      }));
      
      res.json(recordsWithLogs);
    } catch (error) {
      console.error("[API] Error fetching attendance by date:", error);
      res.status(500).json({ error: "Failed to get attendance records" });
    }
  });

  // Send late notification - 지각 알림 발송
  app.delete("/api/attendance-records/:id", async (req, res) => {
    try {
      const recordId = req.params.id;
      if (!recordId) {
        return res.status(400).json({ error: "Record ID is required" });
      }

      const record = await db.select().from(attendanceRecords).where(eq(attendanceRecords.id, recordId)).limit(1);
      if (!record || record.length === 0) {
        return res.status(404).json({ error: "출결 기록을 찾을 수 없습니다" });
      }

      await storage.deleteAttendanceRecord(recordId);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete attendance record:", error);
      res.status(500).json({ error: "Failed to delete attendance record" });
    }
  });

  app.post("/api/attendance-records/:id/late-notify", async (req, res) => {
    try {
      const recordId = req.params.id;
      const { studentId, expectedTime } = req.body;
      
      
      // Get student info for notification
      let student = null;
      if (studentId) {
        student = await storage.getUser(studentId);
      } else {
      }

      // Update record to mark late notification sent
      const record = await storage.updateAttendanceRecord(recordId, {
        lateNotificationSent: true,
        lateNotificationSentAt: new Date(),
      });

      // Send late notification via SOLAPI
      // Get center name from attendance record
      let centerName: string | undefined;
      if (record?.centerId) {
        const center = await storage.getCenter(record.centerId);
        centerName = center?.name;
      } else {
      }
      
      const solapiAvailable = await isSolapiConfigured(centerName);
      
      if (solapiAvailable && student) {
        const parentPhone = student.motherPhone || student.fatherPhone;
        
        if (parentPhone) {
          sendLateNotification(student.name, expectedTime || "예정 시간", parentPhone, centerName, undefined, record?.centerId)
            .then(result => {
              if (result.success) {
              } else {
                console.error(`[LATE-NOTIFY] FAILED: ${result.error}`);
              }
            })
            .catch(err => console.error("[LATE-NOTIFY] Exception:", err));
        } else {
        }
      } else {
      }

      res.json({ success: true, record });
    } catch (error) {
      console.error("[LATE-NOTIFY] Error:", error);
      res.status(500).json({ error: "Failed to send late notification" });
    }
  });

  // Message Templates - 알림 메시지 템플릿
  app.get("/api/message-templates", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      const templates = await storage.getMessageTemplates(centerId);
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to get message templates" });
    }
  });

  app.post("/api/message-templates", async (req, res) => {
    try {
      const { centerId, type, title, body } = req.body;
      if (!centerId || !type || !title || !body) {
        return res.status(400).json({ error: "centerId, type, title, and body are required" });
      }
      const template = await storage.createMessageTemplate({ centerId, type, title, body });
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to create message template" });
    }
  });

  app.patch("/api/message-templates/:id", async (req, res) => {
    try {
      const { title, body, isActive } = req.body;
      const template = await storage.updateMessageTemplate(req.params.id, { title, body, isActive });
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to update message template" });
    }
  });

  app.delete("/api/message-templates/:id", async (req, res) => {
    try {
      await storage.deleteMessageTemplate(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete message template" });
    }
  });

  // Class Notes (수업 공통 기록)
  app.get("/api/class-notes/dates", async (req, res) => {
    try {
      const classId = req.query.classId as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!classId || !startDate || !endDate) {
        return res.status(400).json({ error: "classId, startDate, and endDate are required" });
      }
      const classNoteRows = await db.execute(sql`
        SELECT DISTINCT note_date::text as note_date FROM class_notes 
        WHERE class_id = ${classId} AND note_date >= ${startDate} AND note_date <= ${endDate}
      `);
      const studentNoteRows = await db.execute(sql`
        SELECT DISTINCT note_date::text as note_date FROM student_class_notes 
        WHERE class_id = ${classId} AND note_date >= ${startDate} AND note_date <= ${endDate}
      `);
      const classRows = Array.isArray(classNoteRows) ? classNoteRows : (classNoteRows as any).rows || [];
      const studentRows = Array.isArray(studentNoteRows) ? studentNoteRows : (studentNoteRows as any).rows || [];
      const dateSet = new Set<string>();
      for (const row of classRows) {
        const d = row.note_date;
        dateSet.add(typeof d === 'string' ? d : format(new Date(d), "yyyy-MM-dd"));
      }
      for (const row of studentRows) {
        const d = row.note_date;
        dateSet.add(typeof d === 'string' ? d : format(new Date(d), "yyyy-MM-dd"));
      }
      res.json(Array.from(dateSet));
    } catch (error) {
      console.error("[GET class-notes/dates] Error:", error);
      res.status(500).json({ error: "Failed to get note dates" });
    }
  });

  app.get("/api/students/:studentId/note-dates", async (req, res) => {
    try {
      const { studentId } = req.params;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const centerId = req.query.centerId as string;
      if (!startDate || !endDate || !centerId) {
        return res.status(400).json({ error: "startDate, endDate, and centerId are required" });
      }
      const classNoteRows = await db.execute(sql`
        SELECT DISTINCT cn.note_date::text as note_date
        FROM class_notes cn
        INNER JOIN class_students cs ON cn.class_id = cs.class_id
        INNER JOIN classes c ON cn.class_id = c.id
        WHERE cs.student_id = ${studentId}
          AND c.center_id = ${centerId}
          AND cn.note_date >= ${startDate}
          AND cn.note_date <= ${endDate}
      `);
      const studentNoteRows = await db.execute(sql`
        SELECT DISTINCT note_date::text as note_date
        FROM student_class_notes
        WHERE student_id = ${studentId}
          AND note_date >= ${startDate}
          AND note_date <= ${endDate}
      `);
      const classRows = Array.isArray(classNoteRows) ? classNoteRows : (classNoteRows as any).rows || [];
      const studentRows = Array.isArray(studentNoteRows) ? studentNoteRows : (studentNoteRows as any).rows || [];
      const dateSet = new Set<string>();
      for (const row of classRows) {
        const d = row.note_date;
        dateSet.add(typeof d === 'string' ? d : format(new Date(d), "yyyy-MM-dd"));
      }
      for (const row of studentRows) {
        const d = row.note_date;
        dateSet.add(typeof d === 'string' ? d : format(new Date(d), "yyyy-MM-dd"));
      }
      res.json(Array.from(dateSet));
    } catch (error) {
      console.error("[GET students/:id/note-dates] Error:", error);
      res.status(500).json({ error: "Failed to get student note dates" });
    }
  });

  app.get("/api/students/:studentId/all-class-notes", async (req, res) => {
    try {
      const { studentId } = req.params;
      const noteDate = req.query.noteDate as string;
      const centerId = req.query.centerId as string;
      if (!noteDate || !centerId) {
        return res.status(400).json({ error: "noteDate and centerId are required" });
      }
      const result = await db.execute(sql`
        SELECT cn.*, 
               t.name as teacher_name,
               c.name as class_name, c.subject as class_subject
        FROM class_notes cn
        INNER JOIN class_students cs ON cn.class_id = cs.class_id
        INNER JOIN classes c ON cn.class_id = c.id
        LEFT JOIN users t ON cn.teacher_id = t.id
        WHERE cs.student_id = ${studentId}
          AND c.center_id = ${centerId}
          AND cn.note_date = ${noteDate}
        ORDER BY c.name
      `);
      const rows = Array.isArray(result) ? result : (result as any).rows || [];
      res.json(rows);
    } catch (error) {
      console.error("[GET students/:id/all-class-notes] Error:", error);
      res.status(500).json({ error: "Failed to get student's class notes" });
    }
  });

  app.get("/api/students/:studentId/all-student-notes", async (req, res) => {
    try {
      const { studentId } = req.params;
      const noteDate = req.query.noteDate as string;
      if (!noteDate) {
        return res.status(400).json({ error: "noteDate is required" });
      }
      const result = await db.execute(sql`
        SELECT scn.*,
               u.name as student_name, u.grade as student_grade,
               t.name as teacher_name,
               c.name as class_name, c.subject as class_subject
        FROM student_class_notes scn
        LEFT JOIN users u ON scn.student_id = u.id
        LEFT JOIN users t ON scn.teacher_id = t.id
        LEFT JOIN classes c ON scn.class_id = c.id
        WHERE scn.student_id = ${studentId}
          AND scn.note_date = ${noteDate}
        ORDER BY c.name
      `);
      const rows = Array.isArray(result) ? result : (result as any).rows || [];
      res.json(rows);
    } catch (error) {
      console.error("[GET students/:id/all-student-notes] Error:", error);
      res.status(500).json({ error: "Failed to get student notes" });
    }
  });

  app.get("/api/class-notes", async (req, res) => {
    try {
      const classId = req.query.classId as string;
      const noteDate = req.query.noteDate as string;
      if (!classId || !noteDate) {
        return res.status(400).json({ error: "classId and noteDate are required" });
      }
      const notes = await storage.getClassNotes(classId, noteDate);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: "Failed to get class notes" });
    }
  });

  app.post("/api/class-notes", async (req, res) => {
    try {
      const { classId, teacherId, noteDate, content } = req.body;
      if (!classId || !teacherId || !noteDate || !content) {
        return res.status(400).json({ error: "classId, teacherId, noteDate, and content are required" });
      }
      const note = await storage.createClassNote({ classId, teacherId, noteDate, content });
      res.json(note);
    } catch (error) {
      res.status(500).json({ error: "Failed to create class note" });
    }
  });

  app.patch("/api/class-notes/:id", async (req, res) => {
    try {
      const { content } = req.body;
      const note = await storage.updateClassNote(req.params.id, { content });
      res.json(note);
    } catch (error) {
      res.status(500).json({ error: "Failed to update class note" });
    }
  });

  app.delete("/api/class-notes/:id", async (req, res) => {
    try {
      await storage.deleteClassNote(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete class note" });
    }
  });

  // Student Class Notes (학생별 수업 기록)
  app.get("/api/student-class-notes", async (req, res) => {
    try {
      const classId = req.query.classId as string;
      const noteDate = req.query.noteDate as string;
      if (!classId || !noteDate) {
        return res.status(400).json({ error: "classId and noteDate are required" });
      }
      const notes = await storage.getStudentClassNotes(classId, noteDate);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: "Failed to get student class notes" });
    }
  });

  // Student Class Notes - Monthly view for specific student
  app.get("/api/student-class-notes/monthly", async (req, res) => {
    try {
      const studentId = req.query.studentId as string;
      const classId = req.query.classId as string;
      const year = req.query.year as string;
      const month = req.query.month as string;
      
      if (!studentId || !year || !month) {
        return res.status(400).json({ error: "studentId, year, and month are required" });
      }
      
      const startDate = `${year}-${month.padStart(2, '0')}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endDate = `${year}-${month.padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
      
      let result;
      if (classId) {
        result = await db.execute(sql`
          SELECT scn.*, 
                 u.name as student_name, u.grade as student_grade,
                 t.name as teacher_name,
                 c.name as class_name, c.subject as class_subject
          FROM student_class_notes scn
          LEFT JOIN users u ON scn.student_id = u.id
          LEFT JOIN users t ON scn.teacher_id = t.id
          LEFT JOIN classes c ON scn.class_id = c.id
          WHERE scn.student_id = ${studentId}
            AND scn.class_id = ${classId}
            AND scn.note_date >= ${startDate}
            AND scn.note_date <= ${endDate}
          ORDER BY scn.note_date DESC
        `);
      } else {
        result = await db.execute(sql`
          SELECT scn.*, 
                 u.name as student_name, u.grade as student_grade,
                 t.name as teacher_name,
                 c.name as class_name, c.subject as class_subject
          FROM student_class_notes scn
          LEFT JOIN users u ON scn.student_id = u.id
          LEFT JOIN users t ON scn.teacher_id = t.id
          LEFT JOIN classes c ON scn.class_id = c.id
          WHERE scn.student_id = ${studentId}
            AND scn.note_date >= ${startDate}
            AND scn.note_date <= ${endDate}
          ORDER BY scn.note_date DESC
        `);
      }
      
      const rows = Array.isArray(result) ? result : (result as any).rows || [];
      res.json(rows);
    } catch (error) {
      console.error("Failed to get monthly student notes:", error);
      res.status(500).json({ error: "Failed to get monthly student notes" });
    }
  });

  app.get("/api/class-notes/monthly", async (req, res) => {
    try {
      const classId = req.query.classId as string;
      const year = req.query.year as string;
      const month = req.query.month as string;

      if (!classId || !year || !month) {
        return res.status(400).json({ error: "classId, year, and month are required" });
      }

      const startDate = `${year}-${month.padStart(2, '0')}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endDate = `${year}-${month.padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

      const result = await db.execute(sql`
        SELECT cn.*,
               t.name as teacher_name,
               c.name as class_name, c.subject as class_subject
        FROM class_notes cn
        LEFT JOIN users t ON cn.teacher_id = t.id
        LEFT JOIN classes c ON cn.class_id = c.id
        WHERE cn.class_id = ${classId}
          AND cn.note_date >= ${startDate}
          AND cn.note_date <= ${endDate}
        ORDER BY cn.note_date DESC
      `);

      const rows = Array.isArray(result) ? result : (result as any).rows || [];
      res.json(rows);
    } catch (error) {
      console.error("Failed to get monthly class notes:", error);
      res.status(500).json({ error: "Failed to get monthly class notes" });
    }
  });

  app.post("/api/student-class-notes", async (req, res) => {
    try {
      const { classId, studentId, teacherId, noteDate, content, attitudeScore } = req.body;
      if (!classId || !studentId || !teacherId || !noteDate || !content) {
        return res.status(400).json({ error: "classId, studentId, teacherId, noteDate, and content are required" });
      }
      // 동일 학생/반/날짜의 기록이 이미 있으면 새로 만들지 않고 갱신한다.
      // (클라이언트에서 짧은 시간 내 중복 요청이 와도 같은 반/점수가
      //  두 번 등록되는 것을 서버에서 원자적으로 방지)
      const note = await storage.upsertStudentClassNote({ classId, studentId, teacherId, noteDate, content, attitudeScore });
      res.json(note);
    } catch (error) {
      res.status(500).json({ error: "Failed to create student class note" });
    }
  });

  app.patch("/api/student-class-notes/:id", async (req, res) => {
    try {
      const { content, attitudeScore } = req.body;
      const note = await storage.updateStudentClassNote(req.params.id, { content, attitudeScore });
      res.json(note);
    } catch (error) {
      res.status(500).json({ error: "Failed to update student class note" });
    }
  });

  app.delete("/api/student-class-notes/:id", async (req, res) => {
    try {
      await storage.deleteStudentClassNote(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete student class note" });
    }
  });

  // Study Cafe (스터디카페)
  // Get study cafe settings for a center
  app.get("/api/study-cafe/settings/:centerId", async (req, res) => {
    try {
      const settings = await storage.getStudyCafeSettings(req.params.centerId);
      res.json(settings || { centerId: req.params.centerId, isEnabled: false, notice: null });
    } catch (error) {
      res.status(500).json({ error: "Failed to get study cafe settings" });
    }
  });

  // Update study cafe settings (admin/principal only, must belong to center unless admin)
  app.post("/api/study-cafe/settings", async (req, res) => {
    try {
      const { centerId, isEnabled, notice, entryPassword, actorId } = req.body;
      if (!centerId || !actorId) {
        return res.status(400).json({ error: "centerId and actorId are required" });
      }
      
      // Verify actor has admin/principal role
      const actor = await storage.getUser(actorId);
      if (!actor || (actor.role !== UserRole.ADMIN && actor.role !== UserRole.PRINCIPAL)) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }
      
      // Principals must belong to the center; admins can access all centers
      if (actor.role === UserRole.PRINCIPAL) {
        const actorCenters = await storage.getUserCenters(actorId);
        if (!actorCenters.some(c => c.id === centerId)) {
          return res.status(403).json({ error: "이 센터에 대한 권한이 없습니다" });
        }
      }
      
      const settings = await storage.upsertStudyCafeSettings({ centerId, isEnabled, notice, entryPassword });
      
      // Initialize seats if enabling for the first time
      if (isEnabled) {
        await storage.initializeStudyCafeSeats(centerId);
      }
      
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to update study cafe settings" });
    }
  });

  // Get all centers with study cafe enabled
  app.get("/api/study-cafe/enabled-centers", async (req, res) => {
    try {
      const enabledSettings = await storage.getStudyCafeEnabledCenters();
      const centerIds = enabledSettings.map(s => s.centerId);
      const allCenters = await storage.getCenters();
      const enabledCenters = allCenters.filter(c => centerIds.includes(c.id));
      res.json(enabledCenters);
    } catch (error) {
      res.status(500).json({ error: "Failed to get enabled centers" });
    }
  });

  // Get seats with status for a center
  app.get("/api/study-cafe/seats/:centerId", async (req, res) => {
    try {
      const settings = await storage.getStudyCafeSettings(req.params.centerId);
      if (!settings?.isEnabled) {
        return res.status(400).json({ error: "스터디카페가 이 센터에서 활성화되지 않았습니다" });
      }
      
      const seats = await storage.getStudyCafeSeatsWithStatus(req.params.centerId);
      res.json(seats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get study cafe seats" });
    }
  });

  // Reserve a seat (student only - must reserve for themselves)
  app.post("/api/study-cafe/reserve", async (req, res) => {
    try {
      const { seatId, studentId, centerId, actorId } = req.body;
      if (!seatId || !studentId || !centerId || !actorId) {
        return res.status(400).json({ error: "seatId, studentId, centerId, and actorId are required" });
      }

      // Students can only reserve for themselves
      if (studentId !== actorId) {
        return res.status(403).json({ error: "다른 학생을 대신하여 예약할 수 없습니다" });
      }

      // Verify the actor is a student
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role !== UserRole.STUDENT) {
        return res.status(403).json({ error: "학생만 좌석을 예약할 수 있습니다" });
      }

      // Check if study cafe is enabled
      const settings = await storage.getStudyCafeSettings(centerId);
      if (!settings?.isEnabled) {
        return res.status(400).json({ error: "스터디카페가 이 센터에서 활성화되지 않았습니다" });
      }

      // Check if student already has an active reservation
      const existingReservation = await storage.getStudentActiveReservation(studentId, centerId);
      if (existingReservation) {
        return res.status(400).json({ error: "이미 예약 중인 좌석이 있습니다. 먼저 반납해주세요." });
      }

      // Check if seat is available
      const activeReservation = await storage.getActiveReservation(seatId);
      const activeFixedSeat = await storage.getActiveFixedSeat(seatId);
      if (activeReservation || activeFixedSeat) {
        return res.status(400).json({ error: "이미 사용 중인 좌석입니다" });
      }

      // Create 2-hour reservation
      const now = new Date();
      const endAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      const reservation = await storage.createStudyCafeReservation({
        seatId,
        studentId,
        centerId,
        startAt: now,
        endAt,
        status: "active",
      });

      res.json(reservation);
    } catch (error) {
      res.status(500).json({ error: "Failed to reserve seat" });
    }
  });

  // Release a seat (student - must be their own, or staff can release any student's reservation)
  // Note: Center membership check is skipped for students releasing their own reservation
  // to handle edge case where student is removed from center but still has active reservation
  app.post("/api/study-cafe/release", async (req, res) => {
    try {
      const { reservationId, actorId } = req.body;
      if (!reservationId || !actorId) {
        return res.status(400).json({ error: "reservationId and actorId are required" });
      }

      const actor = await storage.getUser(actorId);
      if (!actor) {
        return res.status(404).json({ error: "User not found" });
      }

      const existingReservation = await storage.getStudyCafeReservation(reservationId);
      if (!existingReservation) {
        return res.status(404).json({ error: "예약을 찾을 수 없습니다" });
      }

      // Staff (Teacher+) can release any student's reservation
      // Students can only release their own reservations
      const isStaff = actor.role >= UserRole.TEACHER;
      const isOwnReservation = existingReservation.studentId === actorId;

      if (!isStaff && !isOwnReservation) {
        return res.status(403).json({ error: "본인의 예약만 반납할 수 있습니다" });
      }

      // Only allow releasing active reservations
      if (existingReservation.status !== "active") {
        return res.status(400).json({ error: "활성 예약만 반납할 수 있습니다" });
      }

      // Student can always release their own reservation even if removed from center

      const reservation = await storage.updateStudyCafeReservation(reservationId, { status: "released" });
      res.json(reservation);
    } catch (error) {
      res.status(500).json({ error: "Failed to release seat" });
    }
  });

  // Extend reservation (student - must be their own active reservation) - adds another 2 hours
  // Requires center membership for extensions (unlike release)
  app.post("/api/study-cafe/extend", async (req, res) => {
    try {
      const { reservationId, actorId } = req.body;
      if (!reservationId || !actorId) {
        return res.status(400).json({ error: "reservationId and actorId are required" });
      }

      // Verify the actor owns this reservation
      const existingReservation = await storage.getStudyCafeReservation(reservationId);
      if (!existingReservation || existingReservation.studentId !== actorId) {
        return res.status(403).json({ error: "본인의 예약만 연장할 수 있습니다" });
      }

      // Only allow extending active reservations
      if (existingReservation.status !== "active") {
        return res.status(400).json({ error: "활성 예약만 연장할 수 있습니다" });
      }

      // Verify actor still belongs to the reservation's center for extensions
      const actorCenters = await storage.getUserCenters(actorId);
      if (!actorCenters.some(c => c.id === existingReservation.centerId)) {
        return res.status(403).json({ error: "센터 멤버십이 없어 연장할 수 없습니다" });
      }

      // Get current reservation and extend by 2 hours from now
      const now = new Date();
      const newEndAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      const reservation = await storage.updateStudyCafeReservation(reservationId, { 
        endAt: newEndAt,
        startAt: now,
      });
      res.json(reservation);
    } catch (error) {
      res.status(500).json({ error: "Failed to extend reservation" });
    }
  });

  // Get student's current reservation
  app.get("/api/study-cafe/my-reservation/:studentId/:centerId", async (req, res) => {
    try {
      const reservation = await storage.getStudentActiveReservation(req.params.studentId, req.params.centerId);
      res.json(reservation || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to get reservation" });
    }
  });

  // Fixed Seats (고정석) - admin/principal/teacher
  app.get("/api/study-cafe/fixed-seats/:centerId", async (req, res) => {
    try {
      const fixedSeats = await storage.getFixedSeats(req.params.centerId);
      res.json(fixedSeats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get fixed seats" });
    }
  });

  app.post("/api/study-cafe/fixed-seats", async (req, res) => {
    try {
      const { seatId, studentId, centerId, startDate, endDate, actorId } = req.body;
      if (!seatId || !studentId || !centerId || !startDate || !endDate || !actorId) {
        return res.status(400).json({ error: "All fields are required" });
      }

      // Verify actor has teacher+ role
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 고정석을 지정할 수 있습니다" });
      }

      // Verify actor belongs to the target center (admins can access all)
      if (actor.role !== UserRole.ADMIN) {
        const actorCenters = await storage.getUserCenters(actorId);
        if (!actorCenters.some(c => c.id === centerId)) {
          return res.status(403).json({ error: "이 센터에 대한 권한이 없습니다" });
        }
      }

      // Check if seat already has an active fixed seat assignment
      const existingFixedSeat = await storage.getActiveFixedSeat(seatId);
      if (existingFixedSeat) {
        return res.status(400).json({ error: "이 좌석은 이미 고정석으로 지정되어 있습니다" });
      }

      // Check if student already has a fixed seat
      const studentFixedSeat = await storage.getStudentActiveFixedSeat(studentId, centerId);
      if (studentFixedSeat) {
        return res.status(400).json({ error: "이 학생은 이미 고정석이 있습니다" });
      }

      // Always set assignedById to the verified actor's ID server-side
      const fixedSeat = await storage.createStudyCafeFixedSeat({
        seatId,
        studentId,
        centerId,
        startDate,
        endDate,
        assignedById: actorId,
      });

      res.json(fixedSeat);
    } catch (error) {
      res.status(500).json({ error: "Failed to create fixed seat" });
    }
  });

  app.patch("/api/study-cafe/fixed-seats/:id", async (req, res) => {
    try {
      const { startDate, endDate, actorId } = req.body;
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }

      // Verify actor has teacher+ role
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 고정석을 수정할 수 있습니다" });
      }

      // Get existing fixed seat to check center
      const existingFixedSeat = await storage.getStudyCafeFixedSeatById(req.params.id);
      if (!existingFixedSeat) {
        return res.status(404).json({ error: "고정석을 찾을 수 없습니다" });
      }

      // Verify actor belongs to the center (admins can access all)
      if (actor.role !== UserRole.ADMIN) {
        const actorCenters = await storage.getUserCenters(actorId);
        if (!actorCenters.some(c => c.id === existingFixedSeat.centerId)) {
          return res.status(403).json({ error: "이 센터에 대한 권한이 없습니다" });
        }
      }

      const fixedSeat = await storage.updateStudyCafeFixedSeat(req.params.id, { startDate, endDate });
      res.json(fixedSeat);
    } catch (error) {
      res.status(500).json({ error: "Failed to update fixed seat" });
    }
  });

  app.delete("/api/study-cafe/fixed-seats/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }

      // Verify actor has teacher+ role
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 고정석을 삭제할 수 있습니다" });
      }

      // Get existing fixed seat to check center
      const existingFixedSeat = await storage.getStudyCafeFixedSeatById(req.params.id);
      if (!existingFixedSeat) {
        return res.status(404).json({ error: "고정석을 찾을 수 없습니다" });
      }

      // Verify actor belongs to the center (admins can access all)
      if (actor.role !== UserRole.ADMIN) {
        const actorCenters = await storage.getUserCenters(actorId as string);
        if (!actorCenters.some(c => c.id === existingFixedSeat.centerId)) {
          return res.status(403).json({ error: "이 센터에 대한 권한이 없습니다" });
        }
      }

      await storage.deleteStudyCafeFixedSeat(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete fixed seat" });
    }
  });

  // Student Monthly Reports (학생 월간 보고서)
  app.get("/api/student-reports", async (req, res) => {
    try {
      const { centerId, year, month } = req.query;
      if (!centerId || !year || !month) {
        return res.status(400).json({ error: "centerId, year, month are required" });
      }
      const reports = await storage.getStudentMonthlyReports(
        centerId as string,
        parseInt(year as string),
        parseInt(month as string)
      );
      res.json(reports);
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ error: "Failed to fetch reports" });
    }
  });

  app.get("/api/student-reports/:id", async (req, res) => {
    try {
      const report = await storage.getStudentMonthlyReport(req.params.id);
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch report" });
    }
  });

  app.post("/api/student-reports/generate", async (req, res) => {
    try {
      const { studentId, centerId, year, month, createdById, customInstructions } = req.body;
      if (!studentId || !centerId || !year || !month || !createdById) {
        return res.status(400).json({ error: "All fields are required" });
      }

      // Limit customInstructions to 500 characters to prevent AI token overflow
      const limitedInstructions = customInstructions ? customInstructions.slice(0, 500) : undefined;

      const actor = await storage.getUser(createdById);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 보고서를 생성할 수 있습니다" });
      }

      const existingReport = await storage.getStudentMonthlyReportByMonth(studentId, year, month);
      if (existingReport) {
        return res.json(existingReport);
      }

      // Dynamic import to reduce startup memory
      const { gatherStudentData, generateReportWithAI } = await import("./services/reportGeneration");
      const studentData = await gatherStudentData(studentId, centerId, year, month);
      const reportContent = await generateReportWithAI(studentData, limitedInstructions);

      const report = await storage.createStudentMonthlyReport({
        studentId,
        centerId,
        createdById,
        year,
        month,
        reportContent,
        customInstructions: limitedInstructions || null,
        assessmentSummary: JSON.stringify(studentData.assessments),
        attendanceSummary: JSON.stringify(studentData.attendance),
        homeworkSummary: JSON.stringify(studentData.homework),
        clinicSummary: JSON.stringify(studentData.clinic),
        videoViewingSummary: JSON.stringify(studentData.videoViewing),
        studyCafeSummary: JSON.stringify(studentData.studyCafe),
        examResultsSummary: JSON.stringify(studentData.examResults),
      });

      res.json(report);
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  app.patch("/api/student-reports/:id", async (req, res) => {
    try {
      const { reportContent, actorId } = req.body;
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }

      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 보고서를 수정할 수 있습니다" });
      }

      const report = await storage.updateStudentMonthlyReport(req.params.id, { reportContent });
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: "Failed to update report" });
    }
  });

  app.post("/api/student-reports/:id/refine", async (req, res) => {
    try {
      const { actorId } = req.body;
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }

      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 보고서를 다듬을 수 있습니다" });
      }

      const report = await storage.getStudentMonthlyReport(req.params.id);
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }

      // Dynamic import to reduce startup memory
      const { refineReportWithAI } = await import("./services/reportGeneration");
      const refinedContent = await refineReportWithAI(report.reportContent);
      const updatedReport = await storage.updateStudentMonthlyReport(req.params.id, { 
        reportContent: refinedContent 
      });
      res.json(updatedReport);
    } catch (error) {
      console.error("Error refining report:", error);
      res.status(500).json({ error: "Failed to refine report" });
    }
  });

  app.post("/api/student-reports/:id/send-sms", async (req, res) => {
    try {
      const { actorId, recipients } = req.body;
      if (!actorId || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: "actorId and recipients are required" });
      }

      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 문자를 보낼 수 있습니다" });
      }

      const report = await storage.getStudentMonthlyReport(req.params.id);
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }

      const student = await storage.getUser(report.studentId);
      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }

      const includeStats = req.body.includeStats !== false;
      
      let smsContent = `[학원] ${report.year}년 ${report.month}월 ${student.name} 학생 보고서\n\n`;
      
      if (includeStats) {
        if (report.attendanceSummary) {
          try {
            const attendance = JSON.parse(report.attendanceSummary);
            smsContent += `출석률: ${attendance.attendanceRate ?? 0}%\n`;
          } catch {}
        }
        
        if (report.homeworkSummary) {
          try {
            const homework = JSON.parse(report.homeworkSummary);
            smsContent += `숙제 완료율: ${homework.completionRate ?? 0}%\n`;
          } catch {}
        }
        
        if (report.assessmentSummary) {
          try {
            const assessments = JSON.parse(report.assessmentSummary);
            if (Array.isArray(assessments) && assessments.length > 0) {
              const avgScore = Math.round(assessments.reduce((sum: number, a: any) => sum + (a.averageScore || a.score || 0), 0) / assessments.length);
              smsContent += `주간평가 평균: ${avgScore}점\n`;
            }
          } catch {}
        }

        if (report.examResultsSummary) {
          try {
            const examResults = JSON.parse(report.examResultsSummary);
            if (Array.isArray(examResults) && examResults.length > 0) {
              const scored = examResults.filter((e: any) => e.score !== null && e.score !== undefined);
              if (scored.length > 0) {
                const avgPct = Math.round(scored.reduce((sum: number, e: any) => sum + (e.score / e.maxScore) * 100, 0) / scored.length);
                smsContent += `평가관리 평균: ${avgPct}점 (${scored.length}건)\n`;
              }
            }
          } catch {}
        }
        
        smsContent += "\n";
      }
      
      smsContent += report.reportContent;

      const results: { phone: string; type: string; success: boolean; error?: string }[] = [];
      
      // Get center name for SMS sending
      const center = report.centerId ? await storage.getCenter(report.centerId) : null;
      
      for (const recipient of recipients) {
        const { phone, type } = recipient as { phone: string; type: string };
        try {
          const smsResult = await sendSms({
            to: phone.replace(/\D/g, ""),
            text: smsContent,
            centerName: center?.name,
            centerId: center?.id,
          });
          results.push({ phone, type, success: smsResult.success, error: smsResult.error });
        } catch (error) {
          results.push({ 
            phone, 
            type, 
            success: false, 
            error: error instanceof Error ? error.message : "Unknown error" 
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const smsStatus = successCount === results.length ? "sent" : 
                        successCount === 0 ? "failed" : "partial";

      await storage.updateStudentMonthlyReport(req.params.id, {
        smsSentAt: new Date(),
        smsRecipients: JSON.stringify(results),
        smsStatus,
      });

      res.json({ results, status: smsStatus });
    } catch (error) {
      console.error("Error sending SMS:", error);
      res.status(500).json({ error: "Failed to send SMS" });
    }
  });

  app.delete("/api/student-reports/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }

      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 보고서를 삭제할 수 있습니다" });
      }

      await storage.deleteStudentMonthlyReport(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete report" });
    }
  });

  // Todo APIs (업무관리)
  
  // Get all todos for a center (with optional assignee filter)
  app.get("/api/todos", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      const assigneeId = req.query.assigneeId as string | undefined;
      const date = req.query.date as string | undefined;
      
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }

      let todos;
      if (date) {
        todos = await storage.getTodosByDate(centerId, date, assigneeId);
      } else {
        todos = await storage.getTodos(centerId, assigneeId);
      }

      res.json(todos);
    } catch (error) {
      console.error("Get todos error:", error);
      res.status(500).json({ error: "Failed to get todos" });
    }
  });

  // Get a single todo
  app.get("/api/todos/:id", async (req, res) => {
    try {
      const todo = await storage.getTodo(req.params.id);
      if (!todo) {
        return res.status(404).json({ error: "Todo not found" });
      }
      res.json(todo);
    } catch (error) {
      res.status(500).json({ error: "Failed to get todo" });
    }
  });

  // Create a new todo
  app.post("/api/todos", async (req, res) => {
    try {
      const { creatorId, centerId, title, description, startDate, dueDate, priority, recurrence, assigneeIds } = req.body;
      
      if (!creatorId || !centerId || !title || !dueDate) {
        return res.status(400).json({ error: "creatorId, centerId, title, and dueDate are required" });
      }

      const creator = await storage.getUser(creatorId);
      if (!creator || creator.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 업무관리를 생성할 수 있습니다" });
      }

      // Validate assignees based on role
      const finalAssigneeIds = assigneeIds && assigneeIds.length > 0 ? assigneeIds : [creatorId];
      
      // Teachers can only assign to themselves
      if (creator.role === UserRole.TEACHER) {
        if (finalAssigneeIds.length > 1 || (finalAssigneeIds[0] !== creatorId)) {
          return res.status(403).json({ error: "선생님은 본인에게만 업무관리를 지정할 수 있습니다" });
        }
      }

      const todo = await storage.createTodo({
        centerId,
        creatorId,
        title,
        description: description || null,
        startDate: startDate || null,
        dueDate,
        priority: priority || "medium",
        recurrence: recurrence || "none",
      }, finalAssigneeIds);

      for (const assigneeId of finalAssigneeIds) {
        if (assigneeId === creatorId) continue;
        try {
          await storage.createNotification({
            userId: assigneeId,
            type: "todo_assigned",
            title: "새 일정 배정",
            message: `${creator.name}님이 "${title}" 일정을 배정했습니다. (마감: ${dueDate})`,
            relatedId: todo.id,
            relatedType: "todo",
          });
        } catch (e) {
          console.error("[TODO] Failed to send notification to assignee:", e);
        }
      }

      res.json(todo);
    } catch (error) {
      console.error("Create todo error:", error);
      res.status(500).json({ error: "Failed to create todo" });
    }
  });

  // Update a todo
  app.patch("/api/todos/:id", async (req, res) => {
    try {
      const { actorId, assigneeIds, ...data } = req.body;
      
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }

      const actor = await storage.getUser(actorId);
      const todo = await storage.getTodo(req.params.id);
      
      if (!actor || !todo) {
        return res.status(404).json({ error: "Actor or Todo not found" });
      }

      // Only creator, admin, or principal can update
      if (todo.creatorId !== actorId && actor.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "수정 권한이 없습니다" });
      }

      const updated = await storage.updateTodo(req.params.id, data, assigneeIds);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update todo" });
    }
  });

  // Delete a todo
  app.delete("/api/todos/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }

      const actor = await storage.getUser(actorId as string);
      const todo = await storage.getTodo(req.params.id);
      
      if (!actor || !todo) {
        return res.status(404).json({ error: "Actor or Todo not found" });
      }

      // Only creator, admin, or principal can delete
      if (todo.creatorId !== actorId && actor.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "삭제 권한이 없습니다" });
      }

      await storage.deleteTodo(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete todo" });
    }
  });

  // Toggle todo completion for a specific date
  app.post("/api/todos/:id/toggle-complete", async (req, res) => {
    try {
      const { assigneeId, date } = req.body;
      
      if (!assigneeId || !date) {
        return res.status(400).json({ error: "assigneeId and date are required" });
      }

      const todo = await storage.getTodo(req.params.id);
      if (!todo) {
        return res.status(404).json({ error: "Todo not found" });
      }

      // Verify the assignee is actually assigned to this todo
      const assignees = todo.assignees || [];
      const isAssigned = assignees.some(a => a.assigneeId === assigneeId);
      if (!isAssigned) {
        return res.status(403).json({ error: "이 업무관리에 지정되지 않았습니다" });
      }

      const result = await storage.toggleTodoComplete(req.params.id, assigneeId, date);
      res.json(result);
    } catch (error) {
      console.error("Toggle todo complete error:", error);
      res.status(500).json({ error: "Failed to toggle todo completion" });
    }
  });

  // Check if todo is completed for a specific date
  app.get("/api/todos/:id/is-completed", async (req, res) => {
    try {
      const { assigneeId, date } = req.query;
      
      if (!assigneeId || !date) {
        return res.status(400).json({ error: "assigneeId and date are required" });
      }

      const isCompleted = await storage.isTodoCompletedForDate(
        req.params.id, 
        assigneeId as string, 
        date as string
      );
      res.json({ isCompleted });
    } catch (error) {
      res.status(500).json({ error: "Failed to check completion status" });
    }
  });

  // One-time cleanup: Remove base64 photos from homework submissions (causes memory issues)
  app.post("/api/admin/cleanup-base64-photos", async (req, res) => {
    try {
      // Find submissions with base64 photos
      const result = await db.execute(sql`
        UPDATE homework_submissions 
        SET photos = NULL 
        WHERE photos IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM unnest(photos) AS p WHERE p LIKE 'data:%'
        )
        RETURNING id
      `);
      
      const cleanedCount = Array.isArray(result) ? result.length : 0;
      res.json({ success: true, cleanedSubmissions: cleanedCount });
    } catch (error: any) {
      console.error("[Cleanup] Error:", error);
      res.status(500).json({ error: "Cleanup failed", details: error?.message });
    }
  });

  // ============ Management Dashboard APIs (경영 대시보드) ============
  
  // Create student exit record when deleting a student
  app.post("/api/students/:id/exit-record", async (req, res) => {
    try {
      const studentId = req.params.id;
      const { reasons, notes, recordedBy, centerId } = req.body;
      
      if (!reasons || !Array.isArray(reasons) || reasons.length === 0) {
        return res.status(400).json({ error: "At least one exit reason is required" });
      }
      
      const student = await storage.getUser(studentId);
      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }
      
      const now = new Date();
      const exitMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const record = await storage.createStudentExitRecord({
        studentId,
        studentName: student.name,
        centerId,
        exitMonth,
        reasons,
        notes: notes || null,
        recordedBy,
      });
      
      // Update monthly student count for the current month
      await storage.updateMonthlyStudentCount(centerId, exitMonth);
      
      res.json(record);
    } catch (error: any) {
      console.error("Failed to create exit record:", error);
      res.status(500).json({ error: "Failed to create exit record", details: error?.message });
    }
  });
  
  // Get management dashboard metrics
  app.get("/api/management/metrics", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      const months = parseInt(req.query.months as string) || 12;
      
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      
      // Get exit summary
      const exitSummary = await storage.getMonthlyExitSummary(centerId, months);
      
      // Get or create monthly snapshots
      const now = new Date();
      const snapshots: any[] = [];
      
      for (let i = 0; i < months; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - months + 1 + i, 1);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const snapshot = await storage.getOrCreateMonthlySnapshot(centerId, monthKey);
        snapshots.push(snapshot);
      }
      
      // Combine data - iterate over snapshots to ensure all months are included
      const monthlyData = snapshots.map(snapshot => {
        const exit = exitSummary.find(e => e.month === snapshot.month);
        const studentCount = snapshot.studentCount || 0;
        const exitCount = exit?.exitCount || 0;
        const exitRatio = studentCount > 0 ? (exitCount / studentCount) * 100 : 0;
        
        return {
          month: snapshot.month,
          studentCount,
          exitCount,
          exitRatio: Math.round(exitRatio * 10) / 10,
          reasons: exit?.reasons || {},
        };
      });
      
      res.json({ monthlyData });
    } catch (error: any) {
      console.error("Failed to get management metrics:", error);
      res.status(500).json({ error: "Failed to get management metrics", details: error?.message });
    }
  });
  
  // Update current month's student count (for initialization/refresh)
  app.post("/api/management/update-student-count", async (req, res) => {
    try {
      const { centerId } = req.body;
      
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const snapshot = await storage.updateMonthlyStudentCount(centerId, month);
      res.json(snapshot);
    } catch (error: any) {
      console.error("Failed to update student count:", error);
      res.status(500).json({ error: "Failed to update student count", details: error?.message });
    }
  });
  
  // Get all exit records for a center
  app.get("/api/management/exit-records", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      
      const records = await storage.getStudentExitRecords(centerId);
      res.json(records);
    } catch (error: any) {
      console.error("Failed to get exit records:", error);
      res.status(500).json({ error: "Failed to get exit records", details: error?.message });
    }
  });

  // Get exit records by teacher
  app.get("/api/management/exit-records-by-teacher", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      const months = parseInt(req.query.months as string) || 12;
      
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      
      const records = await storage.getExitRecordsByTeacher(centerId, months);
      res.json(records);
    } catch (error: any) {
      console.error("Failed to get exit records by teacher:", error);
      res.status(500).json({ error: "Failed to get exit records by teacher", details: error?.message });
    }
  });

  // ========================================
  // Marketing Campaigns
  // ========================================
  
  // Get marketing campaigns for a center
  app.get("/api/marketing-campaigns", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      
      const campaigns = await storage.getMarketingCampaigns(centerId, year);
      res.json(campaigns);
    } catch (error: any) {
      console.error("Failed to get marketing campaigns:", error);
      res.status(500).json({ error: "Failed to get marketing campaigns", details: error?.message });
    }
  });
  
  // Get a single marketing campaign
  app.get("/api/marketing-campaigns/:id", async (req, res) => {
    try {
      const campaign = await storage.getMarketingCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error: any) {
      console.error("Failed to get marketing campaign:", error);
      res.status(500).json({ error: "Failed to get marketing campaign", details: error?.message });
    }
  });
  
  // Helper function to sync marketing campaigns to financial records
  const syncMarketingToFinance = async (centerId: string, yearMonth: string) => {
    try {
      // Get all campaigns for this center and year
      const year = parseInt(yearMonth.split("-")[0]);
      const month = parseInt(yearMonth.split("-")[1]);
      const campaigns = await storage.getMarketingCampaigns(centerId, year);
      
      // Calculate total budget for this month from campaigns
      let totalBudget = 0;
      const details: { name: string; amount: number }[] = [];
      
      for (const campaign of campaigns) {
        const startDate = new Date(campaign.startDate);
        const endDate = new Date(campaign.endDate);
        const startMonth = startDate.getMonth() + 1;
        const startYear = startDate.getFullYear();
        const endMonth = endDate.getMonth() + 1;
        const endYear = endDate.getFullYear();
        
        // Check if campaign overlaps with this month
        const targetDate = new Date(year, month - 1, 1);
        const campaignStart = new Date(startYear, startMonth - 1, 1);
        const campaignEnd = new Date(endYear, endMonth - 1, 1);
        
        if (targetDate >= campaignStart && targetDate <= campaignEnd) {
          // Calculate daily budget and days in this month
          const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          const dailyBudget = campaign.budget / durationDays;
          
          // Count days in this specific month
          let daysInMonth = 0;
          let current = new Date(startDate);
          while (current <= endDate) {
            if (current.getFullYear() === year && current.getMonth() + 1 === month) {
              daysInMonth++;
            }
            current.setDate(current.getDate() + 1);
          }
          
          const monthBudget = Math.round(dailyBudget * daysInMonth);
          if (monthBudget > 0) {
            totalBudget += monthBudget;
            details.push({
              name: `${campaign.name} (${campaign.channel})`,
              amount: monthBudget,
            });
          }
        }
      }
      
      // Update or create financial record
      const existingRecord = await storage.getMonthlyFinancialRecord(centerId, yearMonth);
      
      if (existingRecord) {
        await storage.updateMonthlyFinancialRecord(existingRecord.id, {
          expenseAdvertising: totalBudget,
          expenseAdvertisingDetails: JSON.stringify(details),
        });
      } else if (totalBudget > 0) {
        await storage.createMonthlyFinancialRecord({
          centerId,
          yearMonth,
          createdBy: "system",
          revenueTuition: 0,
          expenseAdvertising: totalBudget,
          expenseAdvertisingDetails: JSON.stringify(details),
        });
      }
    } catch (error) {
      console.error("Failed to sync marketing to finance:", error);
    }
  };

  // Create a marketing campaign
  app.post("/api/marketing-campaigns", async (req, res) => {
    try {
      const { centerId, name, channel, startDate, endDate, budget, notes, createdBy } = req.body;
      
      if (!centerId || !name || !channel || !startDate || !endDate || budget === undefined || !createdBy) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      if (budget <= 0) {
        return res.status(400).json({ error: "Budget must be greater than 0" });
      }
      
      if (new Date(endDate) < new Date(startDate)) {
        return res.status(400).json({ error: "End date must be after start date" });
      }
      
      const campaign = await storage.createMarketingCampaign({
        centerId,
        name,
        channel,
        startDate,
        endDate,
        budget,
        notes: notes || null,
        createdBy,
      });
      
      // Sync marketing to finance for all affected months
      const start = new Date(startDate);
      const end = new Date(endDate);
      let current = new Date(start.getFullYear(), start.getMonth(), 1);
      while (current <= end) {
        const yearMonth = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
        await syncMarketingToFinance(centerId, yearMonth);
        current.setMonth(current.getMonth() + 1);
      }
      
      res.json(campaign);
    } catch (error: any) {
      console.error("Failed to create marketing campaign:", error);
      res.status(500).json({ error: "Failed to create marketing campaign", details: error?.message });
    }
  });
  
  // Update a marketing campaign
  app.patch("/api/marketing-campaigns/:id", async (req, res) => {
    try {
      const { name, channel, startDate, endDate, budget, notes } = req.body;
      
      if (budget !== undefined && budget <= 0) {
        return res.status(400).json({ error: "Budget must be greater than 0" });
      }
      
      if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
        return res.status(400).json({ error: "End date must be after start date" });
      }
      
      // Get old campaign to know affected months before update
      const oldCampaign = await storage.getMarketingCampaign(req.params.id);
      
      const campaign = await storage.updateMarketingCampaign(req.params.id, {
        name,
        channel,
        startDate,
        endDate,
        budget,
        notes,
      });
      
      // Sync marketing to finance for all affected months (old and new ranges)
      if (campaign && campaign.centerId) {
        const affectedMonths = new Set<string>();
        
        // Add old campaign months
        if (oldCampaign) {
          const oldStart = new Date(oldCampaign.startDate);
          const oldEnd = new Date(oldCampaign.endDate);
          let current = new Date(oldStart.getFullYear(), oldStart.getMonth(), 1);
          while (current <= oldEnd) {
            affectedMonths.add(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`);
            current.setMonth(current.getMonth() + 1);
          }
        }
        
        // Add new campaign months
        const newStart = new Date(campaign.startDate);
        const newEnd = new Date(campaign.endDate);
        let current = new Date(newStart.getFullYear(), newStart.getMonth(), 1);
        while (current <= newEnd) {
          affectedMonths.add(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`);
          current.setMonth(current.getMonth() + 1);
        }
        
        for (const yearMonth of Array.from(affectedMonths)) {
          await syncMarketingToFinance(campaign.centerId, yearMonth);
        }
      }
      
      res.json(campaign);
    } catch (error: any) {
      console.error("Failed to update marketing campaign:", error);
      res.status(500).json({ error: "Failed to update marketing campaign", details: error?.message });
    }
  });
  
  // Delete a marketing campaign
  app.delete("/api/marketing-campaigns/:id", async (req, res) => {
    try {
      // Get campaign before deletion to know affected months
      const campaign = await storage.getMarketingCampaign(req.params.id);
      
      await storage.deleteMarketingCampaign(req.params.id);
      
      // Sync marketing to finance for all affected months
      if (campaign && campaign.centerId) {
        const start = new Date(campaign.startDate);
        const end = new Date(campaign.endDate);
        let current = new Date(start.getFullYear(), start.getMonth(), 1);
        while (current <= end) {
          const yearMonth = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
          await syncMarketingToFinance(campaign.centerId, yearMonth);
          current.setMonth(current.getMonth() + 1);
        }
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete marketing campaign:", error);
      res.status(500).json({ error: "Failed to delete marketing campaign", details: error?.message });
    }
  });
  
  // Get marketing comparison data (current year vs last year)
  app.get("/api/marketing-campaigns/comparison/:centerId", async (req, res) => {
    try {
      const centerId = req.params.centerId;
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;
      
      const currentYearCampaigns = await storage.getMarketingCampaigns(centerId, currentYear);
      const lastYearCampaigns = await storage.getMarketingCampaigns(centerId, lastYear);
      
      // Calculate monthly totals
      const calculateMonthlyTotals = (campaigns: any[]) => {
        const totals: Record<number, number> = {};
        for (let m = 1; m <= 12; m++) totals[m] = 0;
        
        for (const campaign of campaigns) {
          const startDate = new Date(campaign.startDate);
          const endDate = new Date(campaign.endDate);
          const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          const dailyBudget = campaign.budget / durationDays;
          
          let current = new Date(startDate);
          while (current <= endDate) {
            const month = current.getMonth() + 1;
            totals[month] += dailyBudget;
            current.setDate(current.getDate() + 1);
          }
        }
        
        return Object.entries(totals).map(([month, total]) => ({
          month: parseInt(month),
          total: Math.round(total),
        }));
      };
      
      const currentYearTotals = calculateMonthlyTotals(currentYearCampaigns);
      const lastYearTotals = calculateMonthlyTotals(lastYearCampaigns);
      
      const currentYearTotal = currentYearCampaigns.reduce((sum, c) => sum + c.budget, 0);
      const lastYearTotal = lastYearCampaigns.reduce((sum, c) => sum + c.budget, 0);
      
      res.json({
        currentYear,
        lastYear,
        currentYearTotal,
        lastYearTotal,
        currentYearMonthly: currentYearTotals,
        lastYearMonthly: lastYearTotals,
        currentYearCampaigns,
        lastYearCampaigns,
      });
    } catch (error: any) {
      console.error("Failed to get marketing comparison:", error);
      res.status(500).json({ error: "Failed to get marketing comparison", details: error?.message });
    }
  });

  // ========================================
  // Monthly Financial Records (월별 재무 기록)
  // ========================================
  app.get("/api/monthly-financials", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      
      const records = await storage.getMonthlyFinancialRecords(centerId, year);
      res.json(records);
    } catch (error: any) {
      console.error("Failed to get monthly financials:", error?.message);
      res.status(500).json({ error: "Failed to get monthly financials" });
    }
  });

  app.get("/api/monthly-financials/:centerId/:yearMonth", async (req, res) => {
    try {
      const { centerId, yearMonth } = req.params;
      const record = await storage.getMonthlyFinancialRecord(centerId, yearMonth);
      res.json(record || null);
    } catch (error: any) {
      console.error("Failed to get monthly financial record:", error);
      res.status(500).json({ error: "Failed to get monthly financial record" });
    }
  });

  app.post("/api/monthly-financials", async (req, res) => {
    try {
      const { centerId, yearMonth, createdBy, ...data } = req.body;
      
      if (!centerId || !yearMonth || !createdBy) {
        return res.status(400).json({ error: "centerId, yearMonth, and createdBy are required" });
      }
      
      // Check if record already exists for this month
      const existing = await storage.getMonthlyFinancialRecord(centerId, yearMonth);
      if (existing) {
        return res.status(400).json({ error: "이미 해당 월의 재무 기록이 있습니다" });
      }
      
      const record = await storage.createMonthlyFinancialRecord({
        centerId,
        yearMonth,
        createdBy,
        ...data,
      });
      res.json(record);
    } catch (error: any) {
      console.error("Failed to create monthly financial record:", error);
      res.status(500).json({ error: "Failed to create monthly financial record" });
    }
  });

  app.patch("/api/monthly-financials/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      
      const record = await storage.updateMonthlyFinancialRecord(id, data);
      res.json(record);
    } catch (error: any) {
      console.error("Failed to update monthly financial record:", error);
      res.status(500).json({ error: "Failed to update monthly financial record" });
    }
  });

  app.delete("/api/monthly-financials/:id", async (req, res) => {
    try {
      await storage.deleteMonthlyFinancialRecord(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete monthly financial record:", error);
      res.status(500).json({ error: "Failed to delete monthly financial record" });
    }
  });

  // Get student tuition revenue for a center (학생 교육비 매출 조회)
  app.get("/api/student-tuition-revenue/:centerId", async (req, res) => {
    try {
      const { centerId } = req.params;
      
      // Get all students in this center
      const allUsers = await storage.getUsers();
      const students = allUsers.filter(u => u.role === UserRole.STUDENT);
      
      // Get all classes in this center
      const allClasses = await storage.getClasses(centerId, false);
      
      // Calculate tuition for each student based on their enrollments
      const studentTuitionData = [];
      
      for (const student of students) {
        const studentEnrollments = await storage.getStudentEnrollments(student.id);
        const enrolledClasses = studentEnrollments
          .map(e => allClasses.find(c => c.id === e.classId))
          .filter((c): c is NonNullable<typeof c> => c !== undefined);
        
        if (enrolledClasses.length === 0) continue;
        
        // Calculate total tuition: baseFee for first class + additionalFee for remaining
        let totalTuition = 0;
        enrolledClasses.forEach((cls, index) => {
          if (index === 0) {
            totalTuition += cls.baseFee || 0;
          } else {
            totalTuition += cls.additionalFee || 0;
          }
        });
        
        if (totalTuition > 0) {
          studentTuitionData.push({
            studentId: student.id,
            studentName: student.name,
            school: student.school || "",
            grade: student.grade || "",
            totalTuition,
            classes: enrolledClasses.map(c => ({
              id: c.id,
              name: c.name,
              subject: c.subject,
              baseFee: c.baseFee,
              additionalFee: c.additionalFee,
            })),
          });
        }
      }
      
      res.json(studentTuitionData);
    } catch (error: any) {
      console.error("Failed to get student tuition revenue:", error);
      res.status(500).json({ error: "Failed to get student tuition revenue", details: error?.message });
    }
  });

  // Sync student tuition to financial records (학생 교육비를 재무 기록에 동기화)
  app.post("/api/sync-student-tuition/:centerId/:yearMonth", async (req, res) => {
    try {
      const { centerId, yearMonth } = req.params;
      const { actorId } = req.body;
      
      // Verify actor permission
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "관리자 또는 원장만 교육비를 동기화할 수 있습니다" });
      }
      
      // Sync all months (not just the selected month) to fix any stale data
      await autoSyncAllRevenue(centerId);
      
      // Return the result for the requested month
      const record = await storage.getMonthlyFinancialRecord(centerId, yearMonth);
      const details = record?.revenueTuitionDetails ? JSON.parse(record.revenueTuitionDetails as string) : [];
      
      res.json({ 
        success: true, 
        totalRevenue: record?.revenueTuition || 0, 
        studentCount: details.length 
      });
    } catch (error: any) {
      console.error("Failed to sync student tuition:", error);
      res.status(500).json({ error: "Failed to sync student tuition", details: error?.message });
    }
  });

  // ========================================
  // Teacher Salary Settings (선생님 급여 설정)
  // ========================================
  
  // Get salary settings for a teacher
  app.get("/api/teacher-salary-settings/:teacherId", async (req, res) => {
    try {
      const { teacherId } = req.params;
      const { centerId } = req.query;
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      const settings = await storage.getTeacherSalarySettings(teacherId, centerId as string);
      res.json(settings || null);
    } catch (error) {
      console.error("Failed to get teacher salary settings:", error);
      res.status(500).json({ error: "Failed to get teacher salary settings" });
    }
  });

  // Get all salary settings for a center
  app.get("/api/teacher-salary-settings", async (req, res) => {
    try {
      const { centerId } = req.query;
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      const settings = await storage.getTeacherSalarySettingsByCenter(centerId as string);
      res.json(settings);
    } catch (error: any) {
      console.error("Failed to get teacher salary settings:", error?.message);
      res.status(500).json({ error: "Failed to get teacher salary settings" });
    }
  });

  // Create or update salary settings (Admin/Principal only)
  app.post("/api/teacher-salary-settings", async (req, res) => {
    try {
      const { teacherId, centerId, baseSalary, classBasePay, classBasePayElementary, classBasePayMiddle, classBasePayHigh, classBasePayAdult, studentThreshold, studentThresholdElementary, studentThresholdMiddle, studentThresholdHigh, studentThresholdAdult, perStudentBonus, perStudentBonusElementary, perStudentBonusMiddle, perStudentBonusHigh, perStudentBonusAdult, actorId, employmentType, wageType, hourlyRate } = req.body;
      
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "관리자 또는 원장만 급여 설정을 수정할 수 있습니다" });
      }
      
      const existing = await storage.getTeacherSalarySettings(teacherId, centerId);
      
      const wageFields: any = {};
      if (employmentType !== undefined) wageFields.employmentType = employmentType;
      if (wageType !== undefined) wageFields.wageType = wageType;
      if (hourlyRate !== undefined) wageFields.hourlyRate = hourlyRate;
      
      if (existing) {
        const updated = await storage.updateTeacherSalarySettings(existing.id, {
          baseSalary,
          classBasePay,
          classBasePayElementary: classBasePayElementary ?? 0,
          classBasePayMiddle: classBasePayMiddle ?? 0,
          classBasePayHigh: classBasePayHigh ?? 0,
          // 성인 필드는 미전송 클라이언트(예: 사용자 관리 폼)가 값을 0으로 덮어쓰지 않도록 기존값을 보존한다.
          classBasePayAdult: classBasePayAdult ?? existing.classBasePayAdult ?? 0,
          studentThreshold,
          studentThresholdElementary: studentThresholdElementary ?? 0,
          studentThresholdMiddle: studentThresholdMiddle ?? 0,
          studentThresholdHigh: studentThresholdHigh ?? 0,
          studentThresholdAdult: studentThresholdAdult ?? existing.studentThresholdAdult ?? 0,
          perStudentBonus,
          perStudentBonusElementary: perStudentBonusElementary ?? 0,
          perStudentBonusMiddle: perStudentBonusMiddle ?? 0,
          perStudentBonusHigh: perStudentBonusHigh ?? 0,
          perStudentBonusAdult: perStudentBonusAdult ?? existing.perStudentBonusAdult ?? 0,
          ...wageFields,
        });
        res.json(updated);
      } else {
        const created = await storage.createTeacherSalarySettings({
          teacherId,
          centerId,
          baseSalary: baseSalary ?? 0,
          classBasePay: classBasePay ?? 0,
          classBasePayElementary: classBasePayElementary ?? 0,
          classBasePayMiddle: classBasePayMiddle ?? 0,
          classBasePayHigh: classBasePayHigh ?? 0,
          classBasePayAdult: classBasePayAdult ?? 0,
          studentThreshold: studentThreshold ?? 0,
          studentThresholdElementary: studentThresholdElementary ?? 0,
          studentThresholdMiddle: studentThresholdMiddle ?? 0,
          studentThresholdHigh: studentThresholdHigh ?? 0,
          studentThresholdAdult: studentThresholdAdult ?? 0,
          perStudentBonus: perStudentBonus ?? 0,
          perStudentBonusElementary: perStudentBonusElementary ?? 0,
          perStudentBonusMiddle: perStudentBonusMiddle ?? 0,
          perStudentBonusHigh: perStudentBonusHigh ?? 0,
          perStudentBonusAdult: perStudentBonusAdult ?? 0,
          ...wageFields,
        });
        res.json(created);
      }
    } catch (error) {
      console.error("Failed to save teacher salary settings:", error);
      res.status(500).json({ error: "Failed to save teacher salary settings" });
    }
  });

  app.delete("/api/teacher-salary-settings/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      
      // Require actorId and verify admin/principal role
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "관리자 또는 원장만 급여 설정을 삭제할 수 있습니다" });
      }
      
      await storage.deleteTeacherSalarySettings(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete teacher salary settings:", error);
      res.status(500).json({ error: "Failed to delete teacher salary settings" });
    }
  });

  // Teacher Salary Adjustments (급여 조정 항목)
  app.get("/api/teacher-salary-adjustments", async (req, res) => {
    try {
      const { centerId, yearMonth, teacherId } = req.query;
      
      if (!centerId || !yearMonth) {
        return res.status(400).json({ error: "centerId and yearMonth are required" });
      }
      
      if (teacherId) {
        const adjustments = await storage.getTeacherSalaryAdjustments(
          teacherId as string,
          centerId as string,
          yearMonth as string
        );
        res.json(adjustments);
      } else {
        const adjustments = await storage.getTeacherSalaryAdjustmentsByCenter(
          centerId as string,
          yearMonth as string
        );
        res.json(adjustments);
      }
    } catch (error) {
      console.error("Failed to get teacher salary adjustments:", error);
      res.status(500).json({ error: "Failed to get teacher salary adjustments" });
    }
  });

  app.post("/api/teacher-salary-adjustments", async (req, res) => {
    try {
      const { actorId } = req.query;
      
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "관리자 또는 원장만 급여를 조정할 수 있습니다" });
      }
      
      const { teacherId, centerId, yearMonth, amount, description } = req.body;
      
      if (!teacherId || !centerId || !yearMonth || amount === undefined || !description) {
        return res.status(400).json({ error: "모든 필드를 입력해주세요" });
      }
      
      const adjustment = await storage.createTeacherSalaryAdjustment({
        teacherId,
        centerId,
        yearMonth,
        amount: parseInt(amount),
        description,
        createdBy: actorId as string,
      });
      
      res.json(adjustment);
    } catch (error) {
      console.error("Failed to create teacher salary adjustment:", error);
      res.status(500).json({ error: "Failed to create teacher salary adjustment" });
    }
  });

  app.patch("/api/teacher-salary-adjustments/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "관리자 또는 원장만 급여를 조정할 수 있습니다" });
      }
      
      const { amount, description } = req.body;
      const updated = await storage.updateTeacherSalaryAdjustment(req.params.id, {
        amount: amount !== undefined ? parseInt(amount) : undefined,
        description,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Failed to update teacher salary adjustment:", error);
      res.status(500).json({ error: "Failed to update teacher salary adjustment" });
    }
  });

  app.delete("/api/teacher-salary-adjustments/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "관리자 또는 원장만 급여 조정을 삭제할 수 있습니다" });
      }
      
      await storage.deleteTeacherSalaryAdjustment(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete teacher salary adjustment:", error);
      res.status(500).json({ error: "Failed to delete teacher salary adjustment" });
    }
  });

  app.post("/api/teacher-salary-adjustments/copy-from-previous", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "관리자 또는 원장만 조정 항목을 복사할 수 있습니다" });
      }

      const { teacherId, centerId, yearMonth } = req.body;
      if (!teacherId || !centerId || !yearMonth) {
        return res.status(400).json({ error: "teacherId, centerId, yearMonth are required" });
      }

      const [yearStr, monthStr] = yearMonth.split("-");
      let prevYear = parseInt(yearStr);
      let prevMonth = parseInt(monthStr) - 1;
      if (prevMonth === 0) {
        prevMonth = 12;
        prevYear -= 1;
      }
      const prevYearMonth = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

      const prevAdjustments = await storage.getTeacherSalaryAdjustments(teacherId, centerId, prevYearMonth);
      if (prevAdjustments.length === 0) {
        return res.json({ copied: 0, message: "이전 달에 조정 항목이 없습니다" });
      }

      let copied = 0;
      for (const adj of prevAdjustments) {
        await storage.createTeacherSalaryAdjustment({
          teacherId,
          centerId,
          yearMonth,
          amount: adj.amount,
          description: adj.description,
          createdBy: actorId as string,
        });
        copied++;
      }

      res.json({ copied, message: `${copied}개의 조정 항목이 복사되었습니다` });
    } catch (error) {
      console.error("Failed to copy salary adjustments:", error);
      res.status(500).json({ error: "Failed to copy salary adjustments" });
    }
  });

  // Calculate teacher salary for a month
  // 현재 수강/시간표 기준 강사 급여 계산 (실시간)
  const computeTeacherSalary = async (teacherId: string, centerId: string): Promise<any | null> => {
      // Get salary settings
      const settings = await storage.getTeacherSalarySettings(teacherId, centerId);
      if (!settings) {
        return null;
      }
      
      // Get classes taught by this teacher in this center
      const allClasses = await storage.getClasses(centerId, false);
      const teacherClasses = allClasses.filter(c => c.teacherId === teacherId);
      
      // Calculate performance bonus for each class
      let performanceBonus = 0;
      const classBreakdown = [];
      let totalStudents = 0;
      let bonusStudents = 0;
      
      for (const cls of teacherClasses) {
        // Get students enrolled in this class
        const enrollments = await storage.getClassEnrollments(cls.id);
        const studentCount = enrollments.length;
        totalStudents += studentCount;
        
        // Get base pay based on class level (초등/중등/고등)
        const classLevel = (cls as any).classLevel || "middle";
        let classBasePay = settings.classBasePay; // fallback to legacy field
        let studentThreshold = settings.studentThreshold; // fallback to legacy field
        let perStudentBonus = settings.perStudentBonus; // fallback to legacy field
        
        // Use level-specific values if available
        if (classLevel === "elementary") {
          if (settings.classBasePayElementary > 0) classBasePay = settings.classBasePayElementary;
          if (settings.studentThresholdElementary > 0) studentThreshold = settings.studentThresholdElementary;
          if (settings.perStudentBonusElementary > 0) perStudentBonus = settings.perStudentBonusElementary;
        } else if (classLevel === "high") {
          if (settings.classBasePayHigh > 0) classBasePay = settings.classBasePayHigh;
          if (settings.studentThresholdHigh > 0) studentThreshold = settings.studentThresholdHigh;
          if (settings.perStudentBonusHigh > 0) perStudentBonus = settings.perStudentBonusHigh;
        } else if (classLevel === "middle") {
          if (settings.classBasePayMiddle > 0) classBasePay = settings.classBasePayMiddle;
          if (settings.studentThresholdMiddle > 0) studentThreshold = settings.studentThresholdMiddle;
          if (settings.perStudentBonusMiddle > 0) perStudentBonus = settings.perStudentBonusMiddle;
        } else if (classLevel === "adult") {
          if (settings.classBasePayAdult > 0) classBasePay = settings.classBasePayAdult;
          if (settings.studentThresholdAdult > 0) studentThreshold = settings.studentThresholdAdult;
          if (settings.perStudentBonusAdult > 0) perStudentBonus = settings.perStudentBonusAdult;
        }
        
        // Base pay for this class
        let classBonus = classBasePay;
        
        // Additional pay for students over threshold
        if (studentCount > studentThreshold) {
          const extraStudents = studentCount - studentThreshold;
          bonusStudents += extraStudents;
          classBonus += extraStudents * perStudentBonus;
        }
        
        performanceBonus += classBonus;
        const dayMap: Record<string, string> = { sun: "일", mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토" };
        const daysLabel = cls.days && cls.days.length > 0 ? cls.days.map(d => dayMap[d] || d).join("/") : "";
        classBreakdown.push({
          classId: cls.id,
          className: `${cls.name} ${cls.subject || ""}`.trim(),
          classLevel,
          studentCount,
          basePay: classBasePay,
          extraStudents: Math.max(0, studentCount - studentThreshold),
          extraPay: Math.max(0, studentCount - studentThreshold) * perStudentBonus,
          totalPay: classBonus,
          days: daysLabel,
        });
      }
      
      const totalSalary = settings.baseSalary + performanceBonus;
      
      return {
        baseSalary: settings.baseSalary,
        performanceBonus,
        totalSalary,
        breakdown: {
          classes: classBreakdown,
          classCount: teacherClasses.length,
          totalStudents,
          bonusStudents,
        },
      };
  };

  app.get("/api/teacher-salary-calculation/:teacherId/:yearMonth", async (req, res) => {
    try {
      const { teacherId, yearMonth } = req.params;
      const { centerId } = req.query;
      
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      
      const emptyResult = { 
        baseSalary: 0, 
        performanceBonus: 0, 
        totalSalary: 0,
        breakdown: { classes: [], classCount: 0, totalStudents: 0, bonusStudents: 0 }
      };
      
      const currentYM = getCurrentYearMonthKST();
      const snapshotKind = `teacherSalary:${teacherId}`;
      
      if (yearMonth < currentYM) {
        // 지난달: 동결된 스냅샷 우선 사용, 없으면 최초 1회 계산 후 동결
        const snapshot = await storage.getFinanceSnapshot(centerId as string, yearMonth, snapshotKind);
        if (snapshot) {
          return res.json(JSON.parse(snapshot.data));
        }
        const result = await computeTeacherSalary(teacherId, centerId as string);
        const frozen = result || emptyResult;
        await storage.upsertFinanceSnapshot(centerId as string, yearMonth, snapshotKind, JSON.stringify(frozen));
        return res.json(frozen);
      }
      
      // 이번 달(또는 미래): 실시간 계산 + 이번 달이면 스냅샷 갱신
      const result = await computeTeacherSalary(teacherId, centerId as string);
      const payload = result || emptyResult;
      if (yearMonth === currentYM) {
        storage.upsertFinanceSnapshot(centerId as string, yearMonth, snapshotKind, JSON.stringify(payload))
          .catch(err => console.error("Failed to save teacher salary snapshot:", err));
      }
      res.json(payload);
    } catch (error) {
      console.error("Failed to calculate teacher salary:", error);
      res.status(500).json({ error: "Failed to calculate teacher salary" });
    }
  });

  // ========================================
  // Teacher Work Records Scheduler
  // ========================================
  const runTeacherWorkMaintenance = async () => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = format(yesterday, "yyyy-MM-dd");
      
      // Mark records without check-out as "noCheckOut = true"
      await storage.markMissingCheckOuts(yesterdayStr);
      
      // Delete records older than 1 year
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const oneYearAgoStr = format(oneYearAgo, "yyyy-MM-dd");
      
      await storage.deleteOldTeacherWorkRecords(oneYearAgoStr);
    } catch (error) {
      console.error("[Teacher Work] Maintenance error:", error);
    }
  };
  
  // Run at startup and then every day at 00:05 (5 minutes past midnight)
  setTimeout(() => {
    runTeacherWorkMaintenance();
    setInterval(runTeacherWorkMaintenance, 24 * 60 * 60 * 1000);
  }, 5 * 60 * 1000); // Initial delay of 5 minutes

  // ========================================
  // Monthly Finance Snapshot Scheduler (월별 재무 동결 스냅샷)
  // 매일 이번 달의 인건비 계산 결과를 저장해두어, 달이 넘어가면
  // 마지막 저장분이 그대로 동결되어 이후 수강/시간표 변경의 영향을 받지 않게 한다.
  // ========================================
  const runFinanceSnapshotMaintenance = async () => {
    try {
      const currentYM = getCurrentYearMonthKST();
      const allCenters = await storage.getCenters();
      for (const center of allCenters) {
        try {
          // 1. 시급 계산용 강사별 수업 시간
          const hoursMap = await computeScheduleHoursMap(center.id, currentYM);
          await storage.upsertFinanceSnapshot(center.id, currentYM, "scheduleHours", JSON.stringify(hoursMap));

          // 2. 급여 설정이 있는 강사별 급여 계산
          const salarySettingsList = await storage.getTeacherSalarySettingsByCenter(center.id);
          for (const settings of salarySettingsList) {
            const result = await computeTeacherSalary(settings.teacherId, center.id);
            if (result) {
              await storage.upsertFinanceSnapshot(center.id, currentYM, `teacherSalary:${settings.teacherId}`, JSON.stringify(result));
            }
          }
        } catch (centerError) {
          console.error(`[Finance Snapshot] Failed for center ${center.id}:`, centerError);
        }
      }
      console.log(`[Finance Snapshot] Saved current month (${currentYM}) snapshots for ${allCenters.length} centers`);
    } catch (error) {
      console.error("[Finance Snapshot] Maintenance error:", error);
    }
  };

  // Run at startup (after short delay) and then every 12 hours
  setTimeout(() => {
    runFinanceSnapshotMaintenance();
    setInterval(runFinanceSnapshotMaintenance, 12 * 60 * 60 * 1000);
  }, 3 * 60 * 1000);

  // ========================================
  // Withdrawn Student Purge Scheduler (퇴원 1년 경과 학생 완전 폐기)
  // ========================================
  const runWithdrawnStudentPurge = async () => {
    try {
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - 1);
      const expired = await storage.getExpiredWithdrawnStudents(cutoff);
      if (expired.length === 0) return;
      console.log(`[WITHDRAWN-PURGE] Purging ${expired.length} students withdrawn before ${cutoff.toISOString()}`);
      for (const student of expired) {
        try {
          await storage.deleteUser(student.id);
          console.log(`[WITHDRAWN-PURGE] Purged student ${student.name} (${student.id})`);
        } catch (err) {
          console.error(`[WITHDRAWN-PURGE] Failed to purge student ${student.id}:`, err);
        }
      }
    } catch (error) {
      console.error("[WITHDRAWN-PURGE] Scheduler error:", error);
    }
  };
  setTimeout(() => {
    runWithdrawnStudentPurge();
    setInterval(runWithdrawnStudentPurge, 24 * 60 * 60 * 1000);
  }, 5 * 60 * 1000);

  // ========================================
  // Deleted Class Purge Scheduler (휴지통 4주 경과 수업 완전삭제)
  // ========================================
  const runDeletedClassPurge = async () => {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 28);
      const expired = await storage.getExpiredDeletedClasses(cutoff);
      if (expired.length === 0) return;
      console.log(`[CLASS-TRASH-PURGE] Purging ${expired.length} classes deleted before ${cutoff.toISOString()}`);
      for (const cls of expired) {
        try {
          await storage.deleteClass(cls.id);
          console.log(`[CLASS-TRASH-PURGE] Purged class ${cls.name} ${cls.subject} (${cls.id})`);
        } catch (err) {
          console.error(`[CLASS-TRASH-PURGE] Failed to purge class ${cls.id}:`, err);
        }
      }
    } catch (error) {
      console.error("[CLASS-TRASH-PURGE] Scheduler error:", error);
    }
  };
  setTimeout(() => {
    runDeletedClassPurge();
    setInterval(runDeletedClassPurge, 24 * 60 * 60 * 1000);
  }, 5 * 60 * 1000);

  // ========================================
  // Homework Due Date Reminder Scheduler (숙제 마감 알림)
  // ========================================
  const runHomeworkDueReminder = async () => {
    try {
      const todayKST = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
      console.log(`[HOMEWORK-REMINDER] Checking homework due today: ${todayKST}`);

      const allCenters = await storage.getCenters();
      let totalNotifications = 0;

      for (const center of allCenters) {
        const centerHomework = await storage.getHomeworkByCenter(center.id);
        const todayHomework = centerHomework.filter(h => h.dueDate === todayKST);

        if (todayHomework.length === 0) continue;

        for (const hw of todayHomework) {
          const classStudents = await storage.getClassStudents(hw.classId);
          let targetStudents = classStudents;

          if (hw.studentId) {
            targetStudents = classStudents.filter(s => s.id === hw.studentId);
          }

          for (const student of targetStudents) {
            const submission = await storage.getSubmissionByHomeworkAndStudent(hw.id, student.id);
            if (submission && (submission.status === "submitted" || submission.status === "reviewed")) {
              continue;
            }

            const existing = await db.select().from(notifications)
              .where(
                and(
                  eq(notifications.userId, student.id),
                  eq(notifications.type, "homework_reminder"),
                  eq(notifications.relatedId, hw.id),
                )
              );
            if (existing.length > 0) continue;

            const classInfo = await storage.getClass(hw.classId);
            const className = classInfo ? `${classInfo.name} ${classInfo.subject || ""}`.trim() : "";

            await storage.createNotification({
              userId: student.id,
              type: "homework_reminder",
              title: "숙제 마감일",
              message: `[${className}] "${hw.title}" 숙제 마감일입니다. 제출해 주세요!`,
              relatedId: hw.id,
              relatedType: "homework",
            });
            totalNotifications++;
          }
        }
      }

      if (totalNotifications > 0) {
        console.log(`[HOMEWORK-REMINDER] Sent ${totalNotifications} reminder(s)`);
      }
    } catch (error) {
      console.error("[HOMEWORK-REMINDER] Error:", error);
    }
  };

  setTimeout(() => {
    runHomeworkDueReminder();
    setInterval(runHomeworkDueReminder, 60 * 60 * 1000);
  }, 3 * 60 * 1000);
  console.log("[HOMEWORK-REMINDER] Scheduler started (every 1 hour)");

  // ========================================
  // Todo Due Date Reminder Scheduler (일정 마감 알림)
  // ========================================
  const runTodoDueReminder = async () => {
    try {
      const todayKST = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
      console.log(`[TODO-REMINDER] Checking todos due today: ${todayKST}`);

      const dueTodos = await db.select().from(todos).where(
        and(
          eq(todos.dueDate, todayKST),
          eq(todos.isActive, true),
        )
      );

      if (dueTodos.length === 0) return;

      let totalNotifications = 0;

      for (const todo of dueTodos) {
        const assignees = await db.select().from(todoAssignees).where(
          eq(todoAssignees.todoId, todo.id)
        );

        for (const assignee of assignees) {
          if (assignee.isCompleted) continue;

          const existing = await db.select().from(notifications).where(
            and(
              eq(notifications.userId, assignee.assigneeId),
              eq(notifications.type, "todo_reminder"),
              eq(notifications.relatedId, todo.id),
            )
          );
          if (existing.length > 0) continue;

          await storage.createNotification({
            userId: assignee.assigneeId,
            type: "todo_reminder",
            title: "일정 마감일",
            message: `"${todo.title}" 일정이 오늘 마감입니다.`,
            relatedId: todo.id,
            relatedType: "todo",
          });
          totalNotifications++;
        }
      }

      if (totalNotifications > 0) {
        console.log(`[TODO-REMINDER] Sent ${totalNotifications} reminder(s)`);
      }
    } catch (error) {
      console.error("[TODO-REMINDER] Error:", error);
    }
  };

  setTimeout(() => {
    runTodoDueReminder();
    setInterval(runTodoDueReminder, 60 * 60 * 1000);
  }, 4 * 60 * 1000);
  console.log("[TODO-REMINDER] Scheduler started (every 1 hour)");

  // ========================================
  // Attendance Records Cleanup Scheduler
  // ========================================
  const runAttendanceRecordsCleanup = async () => {
    try {
      // Delete attendance records older than 2 months
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      const twoMonthsAgoStr = format(twoMonthsAgo, "yyyy-MM-dd");
      
      const deletedCount = await storage.deleteOldAttendanceRecords(twoMonthsAgoStr);
    } catch (error) {
      console.error("[Attendance] Cleanup error:", error);
    }
  };
  
  // Run at startup and then every day
  setTimeout(() => {
    runAttendanceRecordsCleanup();
    setInterval(runAttendanceRecordsCleanup, 24 * 60 * 60 * 1000);
  }, 6 * 60 * 1000); // Initial delay of 6 minutes (after teacher work maintenance)

  // ========================================
  // Student Textbook Purchases (학생 교재비)
  // ========================================
  app.get("/api/class-textbooks", async (req, res) => {
    try {
      const { centerId, actorId } = req.query;
      if (!centerId) return res.status(400).json({ error: "centerId required" });
      if (actorId) {
        const actor = await storage.getUser(actorId as string);
        if (!actor || actor.role < UserRole.TEACHER) {
          return res.status(403).json({ error: "권한이 없습니다" });
        }
      }
      const results = await db.select().from(classTextbooks).where(eq(classTextbooks.centerId, centerId as string));
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: "Failed to get class textbooks" });
    }
  });

  app.post("/api/class-textbooks", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "원장 이상만 교재를 등록할 수 있습니다" });
      }
      const { classId, centerId, name, price } = req.body;
      if (!classId || !centerId || !name) {
        return res.status(400).json({ error: "수업, 센터, 교재명은 필수입니다" });
      }
      const [result] = await db.insert(classTextbooks).values({
        classId,
        centerId,
        name,
        price: price || 0,
        createdById: actorId as string,
      }).returning();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to create class textbook" });
    }
  });

  app.patch("/api/class-textbooks/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "원장 이상만 교재를 수정할 수 있습니다" });
      }
      const { name, price } = req.body;
      if (!name) return res.status(400).json({ error: "교재명은 필수입니다" });
      const [result] = await db.update(classTextbooks).set({ name, price: price || 0 }).where(eq(classTextbooks.id, req.params.id)).returning();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to update class textbook" });
    }
  });

  app.delete("/api/class-textbooks/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "원장 이상만 교재를 삭제할 수 있습니다" });
      }
      await db.delete(studentTextbookPurchases).where(eq(studentTextbookPurchases.classTextbookId, req.params.id));
      await db.delete(classTextbooks).where(eq(classTextbooks.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete class textbook" });
    }
  });


  app.get("/api/student-textbook-purchases", async (req, res) => {
    try {
      const { centerId, studentId } = req.query;
      
      if (studentId) {
        const purchases = await storage.getStudentTextbookPurchases(studentId as string);
        res.json(purchases);
      } else if (centerId) {
        const purchases = await storage.getStudentTextbookPurchasesByCenter(centerId as string);
        res.json(purchases);
      } else {
        return res.status(400).json({ error: "centerId or studentId is required" });
      }
    } catch (error) {
      console.error("Failed to get student textbook purchases:", error);
      res.status(500).json({ error: "Failed to get student textbook purchases" });
    }
  });

  app.post("/api/student-textbook-purchases", async (req, res) => {
    try {
      const { actorId } = req.query;
      
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 교재비를 등록할 수 있습니다" });
      }
      
      const { studentId, centerId, textbookName, price, purchaseDate, notes, classTextbookId } = req.body;
      
      if (!studentId || !centerId || !textbookName) {
        return res.status(400).json({ error: "학생, 센터, 교재명은 필수입니다" });
      }
      
      const purchase = await storage.createStudentTextbookPurchase({
        studentId,
        centerId,
        textbookName,
        price: price || 0,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
        notes,
        classTextbookId: classTextbookId || null,
        createdById: actorId as string,
      });
      
      res.json(purchase);
    } catch (error) {
      console.error("Failed to create student textbook purchase:", error);
      res.status(500).json({ error: "Failed to create student textbook purchase" });
    }
  });

  app.patch("/api/student-textbook-purchases/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 교재비를 수정할 수 있습니다" });
      }
      
      const { textbookName, price, purchaseDate, notes } = req.body;
      const updated = await storage.updateStudentTextbookPurchase(req.params.id, {
        textbookName,
        price,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
        notes,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Failed to update student textbook purchase:", error);
      res.status(500).json({ error: "Failed to update student textbook purchase" });
    }
  });

  app.delete("/api/student-textbook-purchases/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 교재비를 삭제할 수 있습니다" });
      }
      
      await storage.deleteStudentTextbookPurchase(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete student textbook purchase:", error);
      res.status(500).json({ error: "Failed to delete student textbook purchase" });
    }
  });

  // ===== Academy Calendar Events =====
  app.get("/api/academy-calendar-events", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const month = req.query.month ? parseInt(req.query.month as string) : undefined;
      
      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }
      
      const events = await storage.getAcademyCalendarEvents(centerId, year, month);
      res.json(events);
    } catch (error) {
      console.error("Failed to get academy calendar events:", error);
      res.status(500).json({ error: "Failed to get academy calendar events" });
    }
  });

  app.get("/api/academy-calendar-events/:id", async (req, res) => {
    try {
      const event = await storage.getAcademyCalendarEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      console.error("Failed to get academy calendar event:", error);
      res.status(500).json({ error: "Failed to get academy calendar event" });
    }
  });

  app.post("/api/academy-calendar-events", async (req, res) => {
    console.log("[Calendar] Creating event, actorId:", req.query.actorId, "body:", JSON.stringify(req.body));
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 일정을 등록할 수 있습니다" });
      }
      
      const { centerId, title, description, eventType, startDate, endDate, color, school, examSubjects } = req.body;
      
      // Convert empty strings to null for date fields
      const processedEndDate = endDate && endDate.trim() !== '' ? endDate : null;
      
      const event = await storage.createAcademyCalendarEvent({
        centerId,
        title,
        description: description || null,
        eventType,
        startDate,
        endDate: processedEndDate,
        color,
        school: eventType === "exam" ? (school?.trim() || null) : null,
        createdBy: actorId as string,
      });
      
      // If exam type, create exam subject schedules
      if (eventType === "exam" && examSubjects && Array.isArray(examSubjects)) {
        for (const subject of examSubjects) {
          if (subject.examDate && subject.subjects) {
            await storage.createExamSubjectSchedule({
              eventId: event.id,
              examDate: subject.examDate,
              subjects: subject.subjects,
              grade: subject.grade?.trim() || null,
              excludedStudentIds: Array.isArray(subject.excludedStudentIds) ? subject.excludedStudentIds : [],
            });
          }
        }
      }
      
      res.json(event);
    } catch (error: any) {
      console.error("Failed to create academy calendar event:", error);
      console.error("Request body was:", JSON.stringify(req.body, null, 2));
      res.status(500).json({ error: "Failed to create academy calendar event", details: error?.message });
    }
  });

  app.patch("/api/academy-calendar-events/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 일정을 수정할 수 있습니다" });
      }
      
      const { title, description, eventType, startDate, endDate, color, school, examSubjects } = req.body;
      
      // Convert empty strings to null for date fields
      const processedEndDate = endDate && endDate.trim() !== '' ? endDate : null;
      
      const event = await storage.updateAcademyCalendarEvent(req.params.id, {
        title,
        description: description || null,
        eventType,
        startDate,
        endDate: processedEndDate,
        color,
        school: eventType === "exam" ? (school?.trim() || null) : null,
      });
      
      // If exam type, update exam subject schedules
      if (eventType === "exam") {
        // Delete existing and recreate
        await storage.deleteExamSubjectSchedulesByEventId(req.params.id);
        if (examSubjects && Array.isArray(examSubjects)) {
          for (const subject of examSubjects) {
            if (subject.examDate && subject.subjects) {
              await storage.createExamSubjectSchedule({
                eventId: event.id,
                examDate: subject.examDate,
                subjects: subject.subjects,
                grade: subject.grade?.trim() || null,
                excludedStudentIds: Array.isArray(subject.excludedStudentIds) ? subject.excludedStudentIds : [],
              });
            }
          }
        }
      }
      
      res.json(event);
    } catch (error) {
      console.error("Failed to update academy calendar event:", error);
      res.status(500).json({ error: "Failed to update academy calendar event" });
    }
  });

  app.delete("/api/academy-calendar-events/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 일정을 삭제할 수 있습니다" });
      }
      
      await storage.deleteAcademyCalendarEvent(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete academy calendar event:", error);
      res.status(500).json({ error: "Failed to delete academy calendar event" });
    }
  });

  // Exam Subject Schedules
  app.get("/api/exam-subject-schedules/:eventId", async (req, res) => {
    try {
      const schedules = await storage.getExamSubjectSchedules(req.params.eventId);
      res.json(schedules);
    } catch (error) {
      console.error("Failed to get exam subject schedules:", error);
      res.status(500).json({ error: "Failed to get exam subject schedules" });
    }
  });

  // 직전 보강 명단 - 시험 과목 일정의 제외 학생/학년 수정
  app.patch("/api/exam-subject-schedules/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 수정할 수 있습니다" });
      }
      const existing = await storage.getExamSubjectScheduleById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "시험 과목 일정을 찾을 수 없습니다" });
      }
      const event = await storage.getAcademyCalendarEvent(existing.eventId);
      if (!event) {
        return res.status(404).json({ error: "연결된 일정을 찾을 수 없습니다" });
      }
      // 센터 경계 검증 (IDOR 방지)
      const actorCenters = await storage.getUserCenters(actor.id);
      if (!actorCenters.some(c => c.id === event.centerId)) {
        return res.status(403).json({ error: "해당 센터의 일정만 수정할 수 있습니다" });
      }
      const { excludedStudentIds, grade, subjects } = req.body;
      const update: Partial<{ excludedStudentIds: string[]; grade: string | null; subjects: string }> = {};
      if (excludedStudentIds !== undefined) {
        update.excludedStudentIds = Array.isArray(excludedStudentIds) ? excludedStudentIds : [];
      }
      if (grade !== undefined) update.grade = grade?.trim() || null;
      if (subjects !== undefined) update.subjects = subjects;
      const schedule = await storage.updateExamSubjectSchedule(req.params.id, update);
      res.json(schedule);
    } catch (error) {
      console.error("Failed to update exam subject schedule:", error);
      res.status(500).json({ error: "Failed to update exam subject schedule" });
    }
  });

  // ===== Feature Categories API (상위 메뉴 관리) =====
  
  // Get all feature categories
  app.get("/api/feature-categories", async (req, res) => {
    try {
      const categories = await storage.getFeatureCategories();
      res.json(categories);
    } catch (error) {
      console.error("Failed to get feature categories:", error);
      res.status(500).json({ error: "Failed to get feature categories" });
    }
  });

  // Get feature category by ID
  app.get("/api/feature-categories/:id", async (req, res) => {
    try {
      const category = await storage.getFeatureCategory(req.params.id);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      console.error("Failed to get feature category:", error);
      res.status(500).json({ error: "Failed to get feature category" });
    }
  });

  // Create feature category (Admin only)
  app.post("/api/feature-categories", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < 4) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      // Auto-generate menuKey from name if not provided
      let menuKey = req.body.menuKey;
      if (!menuKey && req.body.name) {
        menuKey = `category-${Date.now()}`;
      }
      
      // Check for duplicate menuKey
      const existing = await storage.getFeatureCategoryByMenuKey(menuKey);
      if (existing) {
        return res.status(400).json({ error: "이미 존재하는 메뉴 키입니다" });
      }
      
      // Auto-set displayOrder to end (max + 1)
      const allCategories = await storage.getFeatureCategories();
      const maxOrder = allCategories.length > 0 
        ? Math.max(...allCategories.map(c => c.displayOrder)) 
        : 0;
      const displayOrder = maxOrder + 1;
      
      const category = await storage.createFeatureCategory({ ...req.body, menuKey, displayOrder });
      res.json(category);
    } catch (error) {
      console.error("Failed to create feature category:", error);
      res.status(500).json({ error: "Failed to create feature category" });
    }
  });

  // Update feature category (Admin only)
  app.patch("/api/feature-categories/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < 4) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      // Check for duplicate menuKey if changing
      if (req.body.menuKey) {
        const existing = await storage.getFeatureCategoryByMenuKey(req.body.menuKey);
        if (existing && existing.id !== req.params.id) {
          return res.status(400).json({ error: "이미 존재하는 메뉴 키입니다" });
        }
      }
      
      const category = await storage.updateFeatureCategory(req.params.id, req.body);
      res.json(category);
    } catch (error) {
      console.error("Failed to update feature category:", error);
      res.status(500).json({ error: "Failed to update feature category" });
    }
  });

  // Delete feature category (Admin only)
  app.delete("/api/feature-categories/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < 4) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      await storage.deleteFeatureCategory(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete feature category:", error);
      res.status(500).json({ error: "Failed to delete feature category" });
    }
  });

  // ===== Feature Management API =====
  
  // Get all features (Admin only)
  app.get("/api/features", async (req, res) => {
    try {
      const features = await storage.getFeatures();
      res.json(features);
    } catch (error) {
      console.error("Failed to get features:", error);
      res.status(500).json({ error: "Failed to get features" });
    }
  });

  // Get feature by menuKey (must be before :id to avoid matching "by-menu-key" as id)
  app.get("/api/features/by-menu-key/:menuKey", async (req, res) => {
    try {
      const feature = await storage.getFeatureByMenuKey(req.params.menuKey);
      if (!feature) {
        return res.status(404).json({ error: "Feature not found" });
      }
      res.json(feature);
    } catch (error) {
      console.error("Failed to get feature by menuKey:", error);
      res.status(500).json({ error: "Failed to get feature" });
    }
  });

  // Get feature by ID
  app.get("/api/features/:id", async (req, res) => {
    try {
      const feature = await storage.getFeature(req.params.id);
      if (!feature) {
        return res.status(404).json({ error: "Feature not found" });
      }
      res.json(feature);
    } catch (error) {
      console.error("Failed to get feature:", error);
      res.status(500).json({ error: "Failed to get feature" });
    }
  });

  // Create feature (Admin only)
  app.post("/api/features", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 기능을 등록할 수 있습니다" });
      }
      
      const feature = await storage.createFeature(req.body);
      res.status(201).json(feature);
    } catch (error) {
      console.error("Failed to create feature:", error);
      res.status(500).json({ error: "Failed to create feature" });
    }
  });

  // Update feature (Admin only)
  app.patch("/api/features/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 기능을 수정할 수 있습니다" });
      }
      
      console.log("[DEBUG] Updating feature:", req.params.id);
      console.log("[DEBUG] Request body:", JSON.stringify(req.body));
      const feature = await storage.updateFeature(req.params.id, req.body);
      console.log("[DEBUG] Updated feature result:", JSON.stringify(feature));
      res.json(feature);
    } catch (error) {
      console.error("Failed to update feature:", error);
      res.status(500).json({ error: "Failed to update feature" });
    }
  });

  // Delete feature (Admin only)
  app.delete("/api/features/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 기능을 삭제할 수 있습니다" });
      }
      
      await storage.deleteFeature(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete feature:", error);
      res.status(500).json({ error: "Failed to delete feature" });
    }
  });

  // Get presigned URL for feature image upload (Admin only)
  app.post("/api/features/presigned-url", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 이미지를 업로드할 수 있습니다" });
      }

      const { fileName, contentType } = req.body;
      if (!fileName || !contentType) {
        return res.status(400).json({ error: "fileName and contentType are required" });
      }

      if (!isR2Configured()) {
        return res.status(503).json({ error: "파일 저장소가 설정되지 않았습니다." });
      }

      const fileExt = path.extname(fileName).toLowerCase().replace('.', '');
      const uniqueId = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const objectKey = `feature-images/${uniqueId}.${fileExt}`;

      const { getPresignedUploadUrl } = await import("./r2-storage");
      const { uploadUrl, publicUrl } = await getPresignedUploadUrl(objectKey);

      res.json({ uploadUrl, objectKey, publicUrl });
    } catch (error: any) {
      console.error("Failed to generate feature image upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // ===== Feature Requests API =====
  
  // Get feature requests (Admin: all, Principal: own center only)
  app.get("/api/feature-requests", async (req, res) => {
    try {
      const { actorId, centerId, status } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "원장 이상만 기능 요청을 볼 수 있습니다" });
      }
      
      // Admin can see all requests, Principal can only see their center's requests
      let requests;
      if (actor.role >= UserRole.ADMIN) {
        requests = await storage.getFeatureRequests(centerId as string | undefined);
      } else {
        if (!centerId) {
          return res.status(400).json({ error: "센터 ID가 필요합니다" });
        }
        requests = await storage.getFeatureRequests(centerId as string);
      }
      
      // Filter by status if provided
      if (status) {
        requests = requests.filter(r => r.status === status);
      }
      
      res.json(requests);
    } catch (error) {
      console.error("Failed to get feature requests:", error);
      res.status(500).json({ error: "Failed to get feature requests" });
    }
  });

  // Get pending feature requests count (Admin only - for sidebar badge)
  app.get("/api/feature-requests-pending-count", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.json({ count: 0 });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.ADMIN) {
        return res.json({ count: 0 });
      }
      
      const requests = await storage.getFeatureRequests();
      const pendingCount = requests.filter(r => r.status === "pending").length;
      res.json({ count: pendingCount });
    } catch (error) {
      console.error("Failed to get pending feature requests count:", error);
      res.json({ count: 0 });
    }
  });

  // Create feature request (Principal only)
  app.post("/api/feature-requests", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "원장만 기능을 요청할 수 있습니다" });
      }
      
      // Check if request already exists
      const existingRequests = await storage.getFeatureRequests(req.body.centerId);
      const duplicate = existingRequests.find(r => 
        r.featureId === req.body.featureId && r.status === "pending"
      );
      if (duplicate) {
        return res.status(400).json({ error: "이미 해당 기능에 대한 대기 중인 요청이 있습니다" });
      }
      
      const request = await storage.createFeatureRequest({
        ...req.body,
        requestedBy: actorId,
        status: "pending",
      });
      res.status(201).json(request);
    } catch (error) {
      console.error("Failed to create feature request:", error);
      res.status(500).json({ error: "Failed to create feature request" });
    }
  });

  // Update feature request (Admin only - for approve/reject)
  app.patch("/api/feature-requests/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 기능 요청을 처리할 수 있습니다" });
      }
      
      const existingRequest = await storage.getFeatureRequest(req.params.id);
      if (!existingRequest) {
        return res.status(404).json({ error: "요청을 찾을 수 없습니다" });
      }
      
      const updateData = {
        ...req.body,
        respondedBy: actorId,
        respondedAt: new Date(),
      };
      
      const updatedRequest = await storage.updateFeatureRequest(req.params.id, updateData);
      
      // If approved, add to center_features
      if (req.body.status === "approved") {
        const existingCenterFeature = await storage.getCenterFeature(
          existingRequest.centerId,
          existingRequest.featureId
        );
        if (!existingCenterFeature) {
          await storage.createCenterFeature({
            centerId: existingRequest.centerId,
            featureId: existingRequest.featureId,
            enabledBy: actorId as string,
          });
        }
      }
      
      res.json(updatedRequest);
    } catch (error) {
      console.error("Failed to update feature request:", error);
      res.status(500).json({ error: "Failed to update feature request" });
    }
  });
  
  // Send feature completion notification SMS
  app.post("/api/feature-requests/:id/send-completion-sms", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 문자를 보낼 수 있습니다" });
      }
      
      const featureRequest = await storage.getFeatureRequest(req.params.id);
      if (!featureRequest) {
        return res.status(404).json({ error: "요청을 찾을 수 없습니다" });
      }
      
      if (!featureRequest.phoneNumber) {
        return res.status(400).json({ error: "연락처가 없습니다" });
      }
      
      // Get center name for SMS sending
      const center = await storage.getCenter(featureRequest.centerId);
      const centerName = center?.name || "DMC센터";
      
      // Send SMS notification
      const smsResult = await sendSms({
        to: featureRequest.phoneNumber,
        text: `요청하신 기능 완성되었습니다. [이음위더스]`,
        centerName,
        centerId: featureRequest.centerId,
      });
      
      if (smsResult.success) {
        res.json({ success: true, message: "문자가 전송되었습니다" });
      } else {
        res.status(500).json({ error: smsResult.error || "문자 전송에 실패했습니다" });
      }
    } catch (error) {
      console.error("Failed to send feature completion SMS:", error);
      res.status(500).json({ error: "문자 전송에 실패했습니다" });
    }
  });

  // Generic SMS sending endpoint (Admin only)
  app.post("/api/sms/send", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 문자를 전송할 수 있습니다" });
      }

      const { to, text, centerName, useSystemCredentials } = req.body;
      if (!to || !text) {
        return res.status(400).json({ error: "수신번호와 문자 내용이 필요합니다" });
      }

      // Use system credentials for admin-initiated SMS (like registration approval notifications)
      // This ensures SMS works even for newly registered centers without their own Solapi config
      const smsResult = useSystemCredentials 
        ? await sendSystemSms({ to, text })
        : await sendSms({
            to,
            text,
            centerName: centerName || "DMC센터",
          });
      
      if (smsResult.success) {
        res.json({ success: true, message: "문자가 전송되었습니다" });
      } else {
        res.status(500).json({ error: smsResult.error || "문자 전송에 실패했습니다" });
      }
    } catch (error) {
      console.error("Failed to send SMS:", error);
      res.status(500).json({ error: "문자 전송에 실패했습니다" });
    }
  });

  // ===== Center Features API =====
  
  // Get center features
  app.get("/api/center-features/:centerId", async (req, res) => {
    try {
      const centerFeatures = await storage.getCenterFeatures(req.params.centerId);
      res.json(centerFeatures);
    } catch (error) {
      console.error("Failed to get center features:", error);
      res.status(500).json({ error: "Failed to get center features" });
    }
  });

  // Add feature to center directly (Admin only)
  app.post("/api/center-features", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 센터에 기능을 추가할 수 있습니다" });
      }
      
      // Check if already exists
      const existing = await storage.getCenterFeature(req.body.centerId, req.body.featureId);
      if (existing) {
        return res.status(400).json({ error: "이미 해당 센터에 이 기능이 활성화되어 있습니다" });
      }
      
      // If enabling clinic feature, also enable clinic teacher account type
      const feature = await storage.getFeature(req.body.featureId);
      if (feature?.menuKey === "clinic") {
        await storage.updateCenter(req.body.centerId, { clinicTeacherEnabled: true });
      }
      
      // If enabling google-calendar-timetable, automatically hide the regular timetable
      if (feature?.menuKey === "google-calendar-timetable") {
        const allFeatures = await storage.getFeatures();
        const timetableFeature = allFeatures.find(f => f.menuKey === "timetable");
        if (timetableFeature) {
          await storage.toggleCenterFeatureHidden(req.body.centerId, timetableFeature.id, true);
        }
      }
      
      const centerFeature = await storage.createCenterFeature({
        ...req.body,
        enabledBy: actorId,
      });
      res.status(201).json(centerFeature);
    } catch (error) {
      console.error("Failed to add center feature:", error);
      res.status(500).json({ error: "Failed to add center feature" });
    }
  });

  // Remove feature from center (Admin only)
  app.delete("/api/center-features/:centerId/:featureId", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 센터에서 기능을 제거할 수 있습니다" });
      }
      
      await storage.deleteCenterFeatureByIds(req.params.centerId, req.params.featureId);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to remove center feature:", error);
      res.status(500).json({ error: "Failed to remove center feature" });
    }
  });

  // Toggle feature hidden status (Principal only for their own center)
  app.patch("/api/center-features/:centerId/:featureId/toggle-hidden", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "원장 이상만 기능을 감출 수 있습니다" });
      }
      
      // Principal can only hide features for their own centers
      if (actor.role < UserRole.ADMIN) {
        const userCenters = await storage.getUserCenters(actor.id);
        const hasAccess = userCenters.some(c => c.id === req.params.centerId);
        if (!hasAccess) {
          return res.status(403).json({ error: "해당 센터의 기능을 수정할 권한이 없습니다" });
        }
      }
      
      const { isHidden } = req.body;
      await storage.toggleCenterFeatureHidden(
        req.params.centerId, 
        req.params.featureId, 
        isHidden
      );
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to toggle feature hidden:", error);
      res.status(500).json({ error: "Failed to toggle feature hidden" });
    }
  });

  // ===== Feature Suggestions API (새 기능 개발 요청) =====
  
  // Get feature suggestions (Admin: all, Principal: own center only)
  app.get("/api/feature-suggestions", async (req, res) => {
    try {
      const { actorId, centerId } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "원장 이상만 기능 요청을 조회할 수 있습니다" });
      }
      
      if (actor.role >= UserRole.ADMIN) {
        const suggestions = await storage.getFeatureSuggestions();
        res.json(suggestions);
      } else {
        const suggestions = await storage.getFeatureSuggestions(centerId as string);
        res.json(suggestions);
      }
    } catch (error) {
      console.error("Failed to get feature suggestions:", error);
      res.status(500).json({ error: "Failed to get feature suggestions" });
    }
  });

  // Create feature suggestion (Principal only)
  app.post("/api/feature-suggestions", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "원장만 기능을 요청할 수 있습니다" });
      }
      
      const suggestion = await storage.createFeatureSuggestion({
        ...req.body,
        requestedBy: actorId as string,
      });
      res.status(201).json(suggestion);
    } catch (error) {
      console.error("Failed to create feature suggestion:", error);
      res.status(500).json({ error: "Failed to create feature suggestion" });
    }
  });

  // Update feature suggestion (Admin only - for status updates)
  app.patch("/api/feature-suggestions/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 기능 요청을 처리할 수 있습니다" });
      }
      
      const existingSuggestion = await storage.getFeatureSuggestion(req.params.id);
      if (!existingSuggestion) {
        return res.status(404).json({ error: "요청을 찾을 수 없습니다" });
      }
      
      const updateData = {
        ...req.body,
        respondedBy: actorId,
        respondedAt: new Date(),
      };
      
      const updatedSuggestion = await storage.updateFeatureSuggestion(req.params.id, updateData);
      res.json(updatedSuggestion);
    } catch (error) {
      console.error("Failed to update feature suggestion:", error);
      res.status(500).json({ error: "Failed to update feature suggestion" });
    }
  });

  // Delete feature suggestion (Admin only)
  app.delete("/api/feature-suggestions/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 기능 요청을 삭제할 수 있습니다" });
      }
      
      await storage.deleteFeatureSuggestion(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete feature suggestion:", error);
      res.status(500).json({ error: "Failed to delete feature suggestion" });
    }
  });

  // ===== Face-to-Face Checks API (대면검사) =====
  
  // Get all checks for a center
  app.get("/api/face-to-face-checks", async (req, res) => {
    try {
      const centerId = req.query.centerId as string | undefined;
      if (centerId) {
        const center = await storage.getCenter(centerId);
        if (!center) {
          return res.json([]);
        }
        const checks = await storage.getFaceToFaceChecksByCenter(centerId);
        res.json(checks);
      } else {
        res.json([]);
      }
    } catch (error: any) {
      console.error("[GET face-to-face-checks] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to get checks" });
    }
  });

  // Create a new check
  app.post("/api/face-to-face-checks", async (req, res) => {
    try {
      const check = await storage.createFaceToFaceCheck(req.body);
      res.json(check);
    } catch (error) {
      res.status(500).json({ error: "Failed to create check" });
    }
  });

  // Bulk check creation for multiple students
  app.post("/api/face-to-face-checks/bulk", async (req, res) => {
    try {
      const { studentIds, ...checkData } = req.body;
      if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({ error: "studentIds array is required" });
      }
      
      const createdChecks = [];
      for (const studentId of studentIds) {
        const check = await storage.createFaceToFaceCheck({
          ...checkData,
          studentId,
        });
        createdChecks.push(check);
      }
      
      res.json(createdChecks);
    } catch (error) {
      res.status(500).json({ error: "Failed to create checks" });
    }
  });

  // Update a check
  app.patch("/api/face-to-face-checks/:id", async (req, res) => {
    try {
      const check = await storage.updateFaceToFaceCheck(req.params.id, req.body);
      res.json(check);
    } catch (error) {
      res.status(500).json({ error: "Failed to update check" });
    }
  });

  // Delete a check
  app.delete("/api/face-to-face-checks/:id", async (req, res) => {
    try {
      await storage.deleteFaceToFaceCheck(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete check" });
    }
  });

  // Get unchecked students for a check
  app.get("/api/face-to-face-checks/:id/unchecked", async (req, res) => {
    try {
      const check = await storage.getFaceToFaceCheck(req.params.id);
      if (!check) {
        return res.status(404).json({ error: "Check not found" });
      }
      
      const classData = await storage.getClass(check.classId);
      const classStudents = await storage.getClassStudents(check.classId);
      const allResults = await storage.getResultsByCenter(classData?.centerId || "");
      
      const checkResults = allResults.filter((r: any) => r.checkId === check.id);
      const checkedStudentIds = new Set(checkResults.map((r: any) => r.studentId));
      const uncheckedStudents = classStudents.filter(s => !checkedStudentIds.has(s.id));
      
      res.json(uncheckedStudents);
    } catch (error: any) {
      console.error("[GET unchecked] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to get unchecked students" });
    }
  });

  // Get all results for a center
  app.get("/api/face-to-face-check-results", async (req, res) => {
    try {
      const centerId = req.query.centerId as string | undefined;
      if (centerId) {
        const results = await storage.getResultsByCenter(centerId);
        res.json(results);
      } else {
        res.json([]);
      }
    } catch (error: any) {
      console.error("[GET check-results] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to get results" });
    }
  });

  // Create or update a check result
  app.post("/api/face-to-face-check-results", async (req, res) => {
    try {
      const { checkId, studentId, status } = req.body;
      
      // Check if result already exists for this check and student
      const existingResult = await storage.getResultByCheckAndStudent(checkId, studentId);
      
      if (existingResult) {
        // Update existing result
        const updated = await storage.updateCheckResult(existingResult.id, req.body);
        res.json(updated);
      } else {
        // Create new result
        const result = await storage.createCheckResult(req.body);
        res.json(result);
      }
    } catch (error: any) {
      console.error("[POST check-result] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to save check result" });
    }
  });

  // Update a check result
  app.patch("/api/face-to-face-check-results/:id", async (req, res) => {
    try {
      const result = await storage.updateCheckResult(req.params.id, req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to update result" });
    }
  });

  // ===== User Menu Orders API (사용자별 메뉴 순서) =====
  
  // Get user's menu order
  app.get("/api/user-menu-order", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      
      const menuOrder = await storage.getUserMenuOrder(userId as string);
      res.json(menuOrder || null);
    } catch (error) {
      console.error("Failed to get user menu order:", error);
      res.status(500).json({ error: "Failed to get user menu order" });
    }
  });

  // Save user's menu order
  app.post("/api/user-menu-order", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      
      const { menuOrder, subMenuOrder } = req.body;
      if (!menuOrder || !Array.isArray(menuOrder)) {
        return res.status(400).json({ error: "메뉴 순서 배열이 필요합니다" });
      }
      
      const subMenuOrderStr = subMenuOrder ? JSON.stringify(subMenuOrder) : undefined;
      const result = await storage.saveUserMenuOrder(userId as string, JSON.stringify(menuOrder), subMenuOrderStr);
      res.json(result);
    } catch (error) {
      console.error("Failed to save user menu order:", error);
      res.status(500).json({ error: "Failed to save user menu order" });
    }
  });

  // User Activity Logs - 사용자 활동 로그
  app.post("/api/activity-logs", async (req, res) => {
    try {
      const { userId, centerId, pagePath, sessionId, durationSeconds } = req.body;
      if (!userId || !centerId || !pagePath || !sessionId) {
        return res.status(400).json({ error: "필수 필드가 누락되었습니다" });
      }
      
      const log = await storage.createUserActivityLog({
        userId,
        centerId,
        pagePath,
        sessionId,
        durationSeconds: durationSeconds || null
      });
      res.json(log);
    } catch (error) {
      console.error("Failed to create activity log:", error);
      res.status(500).json({ error: "Failed to create activity log" });
    }
  });

  // Center Usage Statistics - 센터별 앱 사용 통계
  app.get("/api/centers/:centerId/usage-stats", async (req, res) => {
    try {
      const { centerId } = req.params;
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      
      const stats = await storage.getCenterUsageStats(centerId, year);
      res.json(stats);
    } catch (error) {
      console.error("Failed to get center usage stats:", error);
      res.status(500).json({ error: "Failed to get center usage stats" });
    }
  });

  // Get per-user usage stats for a center
  app.get("/api/centers/:centerId/user-usage-stats", async (req, res) => {
    try {
      const { centerId } = req.params;
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      
      const stats = await storage.getCenterUserUsageStats(centerId, year);
      res.json(stats);
    } catch (error) {
      console.error("Failed to get center user usage stats:", error);
      res.status(500).json({ error: "Failed to get center user usage stats" });
    }
  });

  // All centers aggregated usage stats (Admin only)
  app.get("/api/all-centers/usage-stats", async (req, res) => {
    try {
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const centers = await storage.getCenters();
      
      const monthlyAggregates: {
        [month: number]: {
          uniqueUsers: number[];
          totalSessions: number[];
          returnRates: number[];
          avgDurations: number[];
        };
      } = {};
      
      for (let i = 1; i <= 12; i++) {
        monthlyAggregates[i] = { uniqueUsers: [], totalSessions: [], returnRates: [], avgDurations: [] };
      }
      
      for (const center of centers) {
        const stats = await storage.getCenterUsageStats(center.id, year);
        if (stats && stats.monthlyStats) {
          for (const ms of stats.monthlyStats) {
            monthlyAggregates[ms.month].uniqueUsers.push(ms.uniqueUsers);
            monthlyAggregates[ms.month].totalSessions.push(ms.totalSessions);
            monthlyAggregates[ms.month].returnRates.push(ms.returnRate);
            monthlyAggregates[ms.month].avgDurations.push(ms.avgDurationMinutes);
          }
        }
      }
      
      const monthlyStats = [];
      for (let month = 1; month <= 12; month++) {
        const agg = monthlyAggregates[month];
        const count = agg.uniqueUsers.length;
        monthlyStats.push({
          month,
          avgUniqueUsers: count > 0 ? Math.round(agg.uniqueUsers.reduce((a, b) => a + b, 0) / count) : 0,
          totalUniqueUsers: agg.uniqueUsers.reduce((a, b) => a + b, 0),
          avgSessions: count > 0 ? Math.round(agg.totalSessions.reduce((a, b) => a + b, 0) / count) : 0,
          totalSessions: agg.totalSessions.reduce((a, b) => a + b, 0),
          avgReturnRate: count > 0 ? Math.round((agg.returnRates.reduce((a, b) => a + b, 0) / count) * 100) / 100 : 0,
          avgDuration: count > 0 ? Math.round((agg.avgDurations.reduce((a, b) => a + b, 0) / count) * 10) / 10 : 0,
        });
      }
      
      res.json({
        year,
        centerCount: centers.length,
        monthlyStats,
      });
    } catch (error) {
      console.error("Failed to get all centers usage stats:", error);
      res.status(500).json({ error: "Failed to get all centers usage stats" });
    }
  });

  // Retention & DAU/MAU stats for a center
  app.get("/api/centers/:centerId/retention-stats", async (req, res) => {
    try {
      const { centerId } = req.params;
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const month = parseInt(req.query.month as string) || (new Date().getMonth() + 1);
      
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0, 23, 59, 59);
      const daysInMonth = new Date(year, month, 0).getDate();
      const todayStr = new Date().toISOString().split('T')[0];
      
      // Get all logs for this center in a wider range (need 30 days after month end for Day 30)
      const extendedEnd = new Date(year, month + 1, 10, 23, 59, 59); // through ~10 days into month+2 to fully cover Day 30
      const logs = await db.select().from(userActivityLogs)
        .where(and(
          eq(userActivityLogs.centerId, centerId),
          gte(userActivityLogs.visitedAt, monthStart),
          lte(userActivityLogs.visitedAt, extendedEnd)
        ));
      
      // Build user-day map: which users visited on which dates
      const userDayMap = new Map<string, Set<string>>();
      logs.forEach(log => {
        const dateStr = new Date(log.visitedAt!).toISOString().split('T')[0];
        if (!userDayMap.has(dateStr)) userDayMap.set(dateStr, new Set());
        userDayMap.get(dateStr)!.add(log.userId);
      });
      
      // Get total members in center as of the selected month.
      // userCenters has no timestamp, so we scope by users.createdAt <= monthEnd
      // (members whose accounts existed on or before the end of the selected month).
      const centerMembers = await db.select({ userId: userCenters.userId, createdAt: users.createdAt })
        .from(userCenters)
        .innerJoin(users, eq(userCenters.userId, users.id))
        .where(and(
          eq(userCenters.centerId, centerId),
          lte(users.createdAt, monthEnd)
        ));
      const totalMembers = new Set(centerMembers.map(m => m.userId)).size;
      
      // Calculate DAU and retention for each day in the month
      const dailyStats: any[] = [];
      
      // Get unique monthly users for DAU/MAU calc
      const monthlyUsers = new Set<string>();
      logs.forEach(log => {
        const logDate = new Date(log.visitedAt!);
        if (logDate >= monthStart && logDate <= monthEnd) {
          monthlyUsers.add(log.userId);
        }
      });
      const mau = monthlyUsers.size;
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const usersOnDay = userDayMap.get(dateStr) || new Set();
        const dau = usersOnDay.size;
        
        // Day N retention: of users who visited on this day, how many came back after N days.
        // null = not yet measurable (the target date is still in the future), distinct from a measured 0%.
        let day1Retention: number | null = null;
        let day7Retention: number | null = null;
        let day30Retention: number | null = null;
        
        if (usersOnDay.size > 0) {
          const nextDay1 = new Date(year, month - 1, day + 1).toISOString().split('T')[0];
          const nextDay7 = new Date(year, month - 1, day + 7).toISOString().split('T')[0];
          const nextDay30 = new Date(year, month - 1, day + 30).toISOString().split('T')[0];
          
          const usersDay1 = userDayMap.get(nextDay1) || new Set();
          const usersDay7 = userDayMap.get(nextDay7) || new Set();
          const usersDay30 = userDayMap.get(nextDay30) || new Set();
          
          let returnedDay1 = 0, returnedDay7 = 0, returnedDay30 = 0;
          usersOnDay.forEach(userId => {
            if (usersDay1.has(userId)) returnedDay1++;
            if (usersDay7.has(userId)) returnedDay7++;
            if (usersDay30.has(userId)) returnedDay30++;
          });
          
          day1Retention = nextDay1 <= todayStr ? Math.round((returnedDay1 / usersOnDay.size) * 1000) / 10 : null;
          day7Retention = nextDay7 <= todayStr ? Math.round((returnedDay7 / usersOnDay.size) * 1000) / 10 : null;
          day30Retention = nextDay30 <= todayStr ? Math.round((returnedDay30 / usersOnDay.size) * 1000) / 10 : null;
        }
        
        const stickiness = mau > 0 ? Math.round((dau / mau) * 1000) / 10 : 0;
        
        dailyStats.push({
          date: dateStr,
          day,
          dau,
          day1Retention,
          day7Retention,
          day30Retention,
          stickiness,
        });
      }
      
      // Monthly averages
      const avgDau = dailyStats.length > 0 ? Math.round(dailyStats.reduce((s, d) => s + d.dau, 0) / dailyStats.length * 10) / 10 : 0;
      const daysWithUsers = dailyStats.filter(d => d.dau > 0);
      // Average only over measurable days (non-null); null means not yet measurable for the whole period.
      const avgRet = (key: 'day1Retention' | 'day7Retention' | 'day30Retention') => {
        const vals = daysWithUsers.map(d => d[key]).filter((v): v is number => v !== null);
        return vals.length > 0 ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length * 10) / 10 : null;
      };
      const avgDay1 = avgRet('day1Retention');
      const avgDay7 = avgRet('day7Retention');
      const avgDay30 = avgRet('day30Retention');
      const avgStickiness = mau > 0 ? Math.round((avgDau / mau) * 1000) / 10 : 0;
      
      res.json({
        year,
        month,
        totalMembers,
        mau,
        avgDau,
        avgDay1Retention: avgDay1,
        avgDay7Retention: avgDay7,
        avgDay30Retention: avgDay30,
        avgStickiness,
        dailyStats,
      });
    } catch (error) {
      console.error("Failed to get retention stats:", error);
      res.status(500).json({ error: "Failed to get retention stats" });
    }
  });

  // All centers aggregated retention stats
  app.get("/api/all-centers/retention-stats", async (req, res) => {
    try {
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const month = parseInt(req.query.month as string) || (new Date().getMonth() + 1);
      const allCenters = await storage.getCenters();
      
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0, 23, 59, 59);
      const daysInMonth = new Date(year, month, 0).getDate();
      const extendedEnd = new Date(year, month + 1, 10, 23, 59, 59);
      const todayStr = new Date().toISOString().split('T')[0];
      
      // Get all activity logs across all centers
      const allLogs = await db.select().from(userActivityLogs)
        .where(and(
          gte(userActivityLogs.visitedAt, monthStart),
          lte(userActivityLogs.visitedAt, extendedEnd)
        ));
      
      // Build user-day map (KST timezone)
      const userDayMap = new Map<string, Set<string>>();
      allLogs.forEach(log => {
        const kstDate = new Date(new Date(log.visitedAt!).getTime() + 9 * 60 * 60 * 1000);
        const dateStr = kstDate.toISOString().split('T')[0];
        if (!userDayMap.has(dateStr)) userDayMap.set(dateStr, new Set());
        userDayMap.get(dateStr)!.add(log.userId);
      });
      
      // Total members across all centers as of the selected month.
      // userCenters has no timestamp, so we scope by users.createdAt <= monthEnd
      // (members whose accounts existed on or before the end of the selected month).
      const allMembers = await db.select({ userId: userCenters.userId })
        .from(userCenters)
        .innerJoin(users, eq(userCenters.userId, users.id))
        .where(lte(users.createdAt, monthEnd));
      const uniqueMembers = new Set(allMembers.map(m => m.userId));
      const totalMembers = uniqueMembers.size;
      
      // Monthly active users (KST)
      const monthlyUsers = new Set<string>();
      allLogs.forEach(log => {
        const kstDate = new Date(new Date(log.visitedAt!).getTime() + 9 * 60 * 60 * 1000);
        const kstMonth = kstDate.getUTCMonth() + 1;
        const kstYear = kstDate.getUTCFullYear();
        if (kstYear === year && kstMonth === month) {
          monthlyUsers.add(log.userId);
        }
      });
      const mau = monthlyUsers.size;
      
      // Daily stats
      const dailyStats: any[] = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const usersOnDay = userDayMap.get(dateStr) || new Set();
        const dau = usersOnDay.size;
        
        // null = not yet measurable (target date still in the future), distinct from a measured 0%.
        let day1Retention: number | null = null, day7Retention: number | null = null, day30Retention: number | null = null;
        if (usersOnDay.size > 0) {
          const nextDay1 = new Date(year, month - 1, day + 1).toISOString().split('T')[0];
          const nextDay7 = new Date(year, month - 1, day + 7).toISOString().split('T')[0];
          const nextDay30 = new Date(year, month - 1, day + 30).toISOString().split('T')[0];
          const usersDay1 = userDayMap.get(nextDay1) || new Set();
          const usersDay7 = userDayMap.get(nextDay7) || new Set();
          const usersDay30 = userDayMap.get(nextDay30) || new Set();
          let r1 = 0, r7 = 0, r30 = 0;
          usersOnDay.forEach(uid => {
            if (usersDay1.has(uid)) r1++;
            if (usersDay7.has(uid)) r7++;
            if (usersDay30.has(uid)) r30++;
          });
          day1Retention = nextDay1 <= todayStr ? Math.round((r1 / usersOnDay.size) * 1000) / 10 : null;
          day7Retention = nextDay7 <= todayStr ? Math.round((r7 / usersOnDay.size) * 1000) / 10 : null;
          day30Retention = nextDay30 <= todayStr ? Math.round((r30 / usersOnDay.size) * 1000) / 10 : null;
        }
        
        const stickiness = mau > 0 ? Math.round((dau / mau) * 1000) / 10 : 0;
        dailyStats.push({ date: dateStr, day, dau, day1Retention, day7Retention, day30Retention, stickiness });
      }
      
      const avgDau = dailyStats.length > 0 ? Math.round(dailyStats.reduce((s, d) => s + d.dau, 0) / dailyStats.length * 10) / 10 : 0;
      const daysWithUsers = dailyStats.filter(d => d.dau > 0);
      // Average only over measurable days (non-null); null means not yet measurable for the whole period.
      const avgRet = (key: 'day1Retention' | 'day7Retention' | 'day30Retention') => {
        const vals = daysWithUsers.map(d => d[key]).filter((v): v is number => v !== null);
        return vals.length > 0 ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length * 10) / 10 : null;
      };
      const avgDay1 = avgRet('day1Retention');
      const avgDay7 = avgRet('day7Retention');
      const avgDay30 = avgRet('day30Retention');
      const avgStickiness = mau > 0 ? Math.round((avgDau / mau) * 1000) / 10 : 0;
      
      res.json({
        year, month, totalMembers, mau, avgDau, centerCount: allCenters.length,
        avgDay1Retention: avgDay1, avgDay7Retention: avgDay7, avgDay30Retention: avgDay30, avgStickiness,
        dailyStats,
      });
    } catch (error) {
      console.error("Failed to get all centers retention stats:", error);
      res.status(500).json({ error: "Failed to get retention stats" });
    }
  });

  // Monthly user count stats (all accounts by role)
  app.get("/api/all-centers/user-count-stats", async (req, res) => {
    try {
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const users = await storage.getUsers();
      const allCenters = await storage.getCenters();
      
      const monthlyStats: {
        [month: number]: {
          students: number;
          parents: number;
          teachers: number;
          principals: number;
          admins: number;
          total: number;
        };
      } = {};
      
      for (let i = 1; i <= 12; i++) {
        monthlyStats[i] = { students: 0, parents: 0, teachers: 0, principals: 0, admins: 0, total: 0 };
      }
      
      for (const user of users) {
        if (!user.createdAt) continue;
        const createdDate = new Date(user.createdAt);
        if (createdDate.getFullYear() !== year) continue;
        
        const month = createdDate.getMonth() + 1;
        monthlyStats[month].total++;
        
        switch (user.role) {
          case 1: monthlyStats[month].students++; break;
          case 0: monthlyStats[month].parents++; break;
          case 2:
          case 3: monthlyStats[month].teachers++; break;
          case 4: monthlyStats[month].principals++; break;
          case 5: monthlyStats[month].admins++; break;
        }
      }
      
      const result = [];
      for (let month = 1; month <= 12; month++) {
        result.push({ month, ...monthlyStats[month] });
      }
      
      // Count principals by summing up all principals across all centers (same principal in multiple centers counts multiple times)
      let totalPrincipalsAcrossCenters = 0;
      for (const center of allCenters) {
        const centerUsers = await storage.getCenterUsers(center.id);
        totalPrincipalsAcrossCenters += centerUsers.filter(u => u.role === UserRole.PRINCIPAL).length;
      }
      
      const totals = {
        students: users.filter(u => u.role === 1).length,
        parents: users.filter(u => u.role === 0).length,
        teachers: users.filter(u => u.role === 2 || u.role === 3).length,
        principals: totalPrincipalsAcrossCenters, // Sum of principals across all centers
        admins: users.filter(u => u.role === 5).length,
        total: users.length,
      };
      
      res.json({ year, monthlyStats: result, totals });
    } catch (error) {
      console.error("Failed to get user count stats:", error);
      res.status(500).json({ error: "Failed to get user count stats" });
    }
  });

  // ===== Logo Help Images API (로고 도움말 이미지) =====
  
  // Get all logo help images (public - no auth required)
  app.get("/api/logo-help-images", async (req, res) => {
    try {
      const images = await storage.getLogoHelpImages();
      res.json(images);
    } catch (error) {
      console.error("Failed to get logo help images:", error);
      res.status(500).json({ error: "Failed to get logo help images" });
    }
  });

  // Upload/update logo help image (admin only)
  const logoHelpUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
  }).single("image");

  app.post("/api/logo-help-images", logoHelpUpload, async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.PRINCIPAL)) {
        return res.status(403).json({ error: "관리자 또는 원장만 접근 가능합니다" });
      }

      const { logoType, description } = req.body;
      if (!logoType) {
        return res.status(400).json({ error: "로고 타입을 지정해주세요" });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "이미지 파일을 업로드해주세요" });
      }

      if (!isR2Configured()) {
        return res.status(500).json({ error: "Object storage가 설정되지 않았습니다" });
      }

      // Delete old image if exists first
      const existing = await storage.getLogoHelpImage(logoType);
      if (existing?.imageUrl) {
        const r2PublicUrl = process.env.R2_PUBLIC_URL || '';
        const oldKey = existing.imageUrl.replace(`${r2PublicUrl}/`, '');
        try {
          await deleteObject(oldKey);
        } catch (e) {
          console.error("Failed to delete old logo help image:", e);
        }
      }

      // Upload to R2
      const ext = file.originalname.split('.').pop() || 'png';
      const key = `logo-help/${logoType}-${Date.now()}.${ext}`;
      const imageUrl = await uploadBuffer(file.buffer, key, file.mimetype);

      // Upsert to database
      const result = await storage.upsertLogoHelpImage({ logoType, imageUrl, description });
      res.json(result);
    } catch (error) {
      console.error("Failed to upload logo help image:", error);
      res.status(500).json({ error: "Failed to upload logo help image" });
    }
  });

  // Delete logo help image (admin only)
  app.delete("/api/logo-help-images/:logoType", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.PRINCIPAL)) {
        return res.status(403).json({ error: "관리자 또는 원장만 접근 가능합니다" });
      }

      const { logoType } = req.params;
      const existing = await storage.getLogoHelpImage(logoType);
      
      if (!existing) {
        return res.status(404).json({ error: "도움말 이미지를 찾을 수 없습니다" });
      }

      // Delete from R2
      if (existing.imageUrl && isR2Configured()) {
        const r2PublicUrl = process.env.R2_PUBLIC_URL || '';
        const key = existing.imageUrl.replace(`${r2PublicUrl}/`, '');
        try {
          await deleteObject(key);
        } catch (e) {
          console.error("Failed to delete logo help image from R2:", e);
        }
      }

      await storage.deleteLogoHelpImage(logoType);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete logo help image:", error);
      res.status(500).json({ error: "Failed to delete logo help image" });
    }
  });

  // ==================== SOLAPI Manuals ====================
  
  // Get all SOLAPI manuals (principal or higher)
  app.get("/api/solapi-manuals", async (req, res) => {
    try {
      const manuals = await storage.getSolapiManuals();
      res.json(manuals);
    } catch (error) {
      console.error("Failed to get SOLAPI manuals:", error);
      res.status(500).json({ error: "Failed to get SOLAPI manuals" });
    }
  });

  // Upload/update SOLAPI manual (admin only)
  const solapiManualUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
  }).single("image");

  app.post("/api/solapi-manuals", solapiManualUpload, async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      if (!user || user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 접근 가능합니다" });
      }

      const { manualType, title, linkUrl, description } = req.body;
      if (!manualType || !title) {
        return res.status(400).json({ error: "매뉴얼 유형과 제목은 필수입니다" });
      }

      let imageUrl: string | undefined;

      // Handle image upload to R2
      if (req.file && isR2Configured()) {
        const key = `solapi-manuals/${manualType}-${Date.now()}.${req.file.originalname.split('.').pop()}`;
        const uploadedUrl = await uploadBuffer(req.file.buffer, key, req.file.mimetype);
        imageUrl = uploadedUrl;

        // Delete old image if exists
        const existing = await storage.getSolapiManual(manualType);
        if (existing?.imageUrl) {
          const r2PublicUrl = process.env.R2_PUBLIC_URL || '';
          const oldKey = existing.imageUrl.replace(`${r2PublicUrl}/`, '');
          try {
            await deleteObject(oldKey);
          } catch (e) {
            console.error("Failed to delete old SOLAPI manual image:", e);
          }
        }
      }

      const result = await storage.upsertSolapiManual({
        manualType,
        title,
        linkUrl: linkUrl || null,
        imageUrl: imageUrl || (await storage.getSolapiManual(manualType))?.imageUrl || null,
        description: description || null,
      });

      res.json(result);
    } catch (error) {
      console.error("Failed to upload SOLAPI manual:", error);
      res.status(500).json({ error: "Failed to upload SOLAPI manual" });
    }
  });

  // Delete SOLAPI manual (admin only)
  app.delete("/api/solapi-manuals/:manualType", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      if (!user || user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 접근 가능합니다" });
      }

      const { manualType } = req.params;
      const existing = await storage.getSolapiManual(manualType);
      
      if (!existing) {
        return res.status(404).json({ error: "매뉴얼을 찾을 수 없습니다" });
      }

      // Delete from R2
      if (existing.imageUrl && isR2Configured()) {
        const r2PublicUrl = process.env.R2_PUBLIC_URL || '';
        const key = existing.imageUrl.replace(`${r2PublicUrl}/`, '');
        try {
          await deleteObject(key);
        } catch (e) {
          console.error("Failed to delete SOLAPI manual image from R2:", e);
        }
      }

      await storage.deleteSolapiManual(manualType);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete SOLAPI manual:", error);
      res.status(500).json({ error: "Failed to delete SOLAPI manual" });
    }
  });

  // Student Presentation Videos API (수업 발표영상)
  app.get("/api/student-presentation-videos", async (req, res) => {
    try {
      const { centerId, classId, studentId } = req.query;
      if (!centerId) {
        return res.status(400).json({ error: "센터 ID가 필요합니다" });
      }
      const videos = await storage.getStudentPresentationVideos(
        centerId as string,
        classId as string | undefined,
        studentId as string | undefined
      );
      res.json(videos);
    } catch (error) {
      console.error("Failed to get student presentation videos:", error);
      res.status(500).json({ error: "수업 발표영상 목록을 가져오는데 실패했습니다" });
    }
  });

  app.get("/api/student-presentation-videos/:id", async (req, res) => {
    try {
      const video = await storage.getStudentPresentationVideo(req.params.id);
      if (!video) {
        return res.status(404).json({ error: "영상을 찾을 수 없습니다" });
      }
      res.json(video);
    } catch (error) {
      console.error("Failed to get student presentation video:", error);
      res.status(500).json({ error: "수업 발표영상을 가져오는데 실패했습니다" });
    }
  });

  app.post("/api/student-presentation-videos", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.PRINCIPAL && user.role !== UserRole.TEACHER)) {
        return res.status(403).json({ error: "선생님 이상만 등록할 수 있습니다" });
      }

      const { studentId, classId, centerId, title, youtubeUrl, description } = req.body;
      if (!studentId || !classId || !centerId || !title || !youtubeUrl) {
        return res.status(400).json({ error: "필수 정보가 누락되었습니다" });
      }

      const video = await storage.createStudentPresentationVideo({
        studentId,
        classId,
        centerId,
        title,
        youtubeUrl,
        description,
        createdBy: actorId,
      });
      res.json(video);
    } catch (error) {
      console.error("Failed to create student presentation video:", error);
      res.status(500).json({ error: "수업 발표영상 등록에 실패했습니다" });
    }
  });

  app.patch("/api/student-presentation-videos/:id", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.PRINCIPAL && user.role !== UserRole.TEACHER)) {
        return res.status(403).json({ error: "선생님 이상만 수정할 수 있습니다" });
      }

      const video = await storage.updateStudentPresentationVideo(req.params.id, req.body);
      res.json(video);
    } catch (error) {
      console.error("Failed to update student presentation video:", error);
      res.status(500).json({ error: "수업 발표영상 수정에 실패했습니다" });
    }
  });

  app.delete("/api/student-presentation-videos/:id", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.PRINCIPAL && user.role !== UserRole.TEACHER)) {
        return res.status(403).json({ error: "선생님 이상만 삭제할 수 있습니다" });
      }

      await storage.deleteStudentPresentationVideo(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete student presentation video:", error);
      res.status(500).json({ error: "수업 발표영상 삭제에 실패했습니다" });
    }
  });

  // ==================== Exams API (평가관리) ====================

  // Get all exams for a center
  app.get("/api/exams", async (req, res) => {
    try {
      const { centerId } = req.query;
      if (!centerId) {
        return res.status(400).json({ error: "센터 ID가 필요합니다" });
      }
      const examList = await storage.getExams(centerId as string);
      
      // Enrich with participant counts and class info
      const enrichedExams = await Promise.all(examList.map(async (exam) => {
        const participants = await storage.getExamParticipants(exam.id);
        const classInfo = exam.classId ? await storage.getClass(exam.classId) : null;
        return {
          ...exam,
          participantCount: participants.length,
          className: classInfo?.name || null,
        };
      }));
      
      res.json(enrichedExams);
    } catch (error) {
      console.error("Failed to get exams:", error);
      res.status(500).json({ error: "시험 목록을 가져오는데 실패했습니다" });
    }
  });

  // Get single exam with participants and papers
  app.get("/api/exams/:id", async (req, res) => {
    try {
      const exam = await storage.getExam(req.params.id);
      if (!exam) {
        return res.status(404).json({ error: "시험을 찾을 수 없습니다" });
      }
      
      const participants = await storage.getExamParticipants(exam.id);
      const papers = await storage.getExamPapers(exam.id);
      
      // Enrich participants with student info
      const enrichedParticipants = await Promise.all(participants.map(async (p) => {
        const student = await storage.getUser(p.studentId);
        const studentPapers = papers.filter(paper => paper.studentId === p.studentId);
        return {
          ...p,
          studentName: student?.name || "Unknown",
          studentGrade: student?.grade || null,
          papers: studentPapers,
        };
      }));
      
      res.json({
        ...exam,
        participants: enrichedParticipants,
      });
    } catch (error) {
      console.error("Failed to get exam:", error);
      res.status(500).json({ error: "시험 정보를 가져오는데 실패했습니다" });
    }
  });

  // Create exam
  app.post("/api/exams", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.PRINCIPAL && user.role !== UserRole.TEACHER)) {
        return res.status(403).json({ error: "선생님 이상만 시험을 생성할 수 있습니다" });
      }

      const { centerId, classId, name, scope, examDate, maxScore, participantIds } = req.body;
      if (!centerId || !name || !examDate) {
        return res.status(400).json({ error: "필수 정보가 누락되었습니다" });
      }

      const exam = await storage.createExam({
        centerId,
        classId: classId || null,
        name,
        scope: scope || null,
        examDate,
        maxScore: maxScore || 100,
        createdBy: actorId,
      });

      // Add participants if provided
      if (participantIds && Array.isArray(participantIds)) {
        for (const studentId of participantIds) {
          await storage.createExamParticipant({
            examId: exam.id,
            studentId,
            score: null,
          });
        }
      }

      res.json(exam);
    } catch (error) {
      console.error("Failed to create exam:", error);
      res.status(500).json({ error: "시험 생성에 실패했습니다" });
    }
  });

  // Update exam
  app.patch("/api/exams/:id", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.PRINCIPAL && user.role !== UserRole.TEACHER)) {
        return res.status(403).json({ error: "선생님 이상만 시험을 수정할 수 있습니다" });
      }

      const { name, scope, examDate, maxScore, classId } = req.body;
      const exam = await storage.updateExam(req.params.id, { name, scope, examDate, maxScore, classId });
      res.json(exam);
    } catch (error) {
      console.error("Failed to update exam:", error);
      res.status(500).json({ error: "시험 수정에 실패했습니다" });
    }
  });

  // Delete exam
  app.delete("/api/exams/:id", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.PRINCIPAL && user.role !== UserRole.TEACHER)) {
        return res.status(403).json({ error: "선생님 이상만 시험을 삭제할 수 있습니다" });
      }

      await storage.deleteExam(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete exam:", error);
      res.status(500).json({ error: "시험 삭제에 실패했습니다" });
    }
  });

  // Get exam participants
  app.get("/api/exams/:id/participants", async (req, res) => {
    try {
      const examId = req.params.id;
      const participants = await storage.getExamParticipants(examId);
      
      // Enrich with student info
      const enrichedParticipants = await Promise.all(participants.map(async (p) => {
        const student = await storage.getUser(p.studentId);
        return {
          ...p,
          studentName: student?.name || "알 수 없음",
          studentGrade: student?.grade || null,
        };
      }));
      
      res.json(enrichedParticipants);
    } catch (error) {
      console.error("Failed to get exam participants:", error);
      res.status(500).json({ error: "응시자 목록을 가져오는데 실패했습니다" });
    }
  });

  // Get exam papers
  app.get("/api/exams/:id/papers", async (req, res) => {
    try {
      const examId = req.params.id;
      const papers = await storage.getExamPapers(examId);
      res.json(papers);
    } catch (error) {
      console.error("Failed to get exam papers:", error);
      res.status(500).json({ error: "시험지 목록을 가져오는데 실패했습니다" });
    }
  });

  // Add participants to exam
  app.post("/api/exams/:id/participants", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.PRINCIPAL && user.role !== UserRole.TEACHER)) {
        return res.status(403).json({ error: "선생님 이상만 응시자를 추가할 수 있습니다" });
      }

      const { studentIds } = req.body;
      if (!studentIds || !Array.isArray(studentIds)) {
        return res.status(400).json({ error: "학생 ID 목록이 필요합니다" });
      }

      const examId = req.params.id;
      const existingParticipants = await storage.getExamParticipants(examId);
      const existingStudentIds = new Set(existingParticipants.map(p => p.studentId));

      const newParticipants = [];
      for (const studentId of studentIds) {
        if (!existingStudentIds.has(studentId)) {
          const participant = await storage.createExamParticipant({
            examId,
            studentId,
            score: null,
          });
          newParticipants.push(participant);
        }
      }

      res.json({ added: newParticipants.length, participants: newParticipants });
    } catch (error) {
      console.error("Failed to add exam participants:", error);
      res.status(500).json({ error: "응시자 추가에 실패했습니다" });
    }
  });

  // Remove participant from exam
  app.delete("/api/exam-participants/:id", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.PRINCIPAL && user.role !== UserRole.TEACHER)) {
        return res.status(403).json({ error: "선생님 이상만 응시자를 삭제할 수 있습니다" });
      }

      await storage.deleteExamParticipant(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete exam participant:", error);
      res.status(500).json({ error: "응시자 삭제에 실패했습니다" });
    }
  });

  // Update participant score
  app.patch("/api/exam-participants/:id/score", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.PRINCIPAL && user.role !== UserRole.TEACHER)) {
        return res.status(403).json({ error: "선생님 이상만 점수를 입력할 수 있습니다" });
      }

      const { score } = req.body;
      const participant = await storage.updateExamParticipantScore(req.params.id, score);
      res.json(participant);
    } catch (error) {
      console.error("Failed to update exam participant score:", error);
      res.status(500).json({ error: "점수 입력에 실패했습니다" });
    }
  });

  // Get student's exams (for student view)
  app.get("/api/student-exams", async (req, res) => {
    try {
      const { studentId } = req.query;
      if (!studentId) {
        return res.status(400).json({ error: "학생 ID가 필요합니다" });
      }

      const participants = await storage.getExamParticipantsByStudent(studentId as string);
      const papers = await storage.getExamPapersByStudent(studentId as string);

      // Enrich with exam info and stats
      const enrichedExams = await Promise.all(participants.map(async (p) => {
        const exam = await storage.getExam(p.examId);
        const studentPapers = papers.filter(paper => paper.examId === p.examId);
        
        // Get all participants for this exam to calculate stats
        const allParticipants = await storage.getExamParticipants(p.examId);
        const scores = allParticipants
          .map(ap => ap.score)
          .filter((s): s is number => s !== null);
        
        const stats = scores.length > 0 ? {
          maxScore: Math.max(...scores),
          minScore: Math.min(...scores),
          avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10,
          participantCount: allParticipants.length,
        } : null;
        
        return {
          ...p,
          exam,
          papers: studentPapers,
          stats,
        };
      }));

      res.json(enrichedExams);
    } catch (error) {
      console.error("Failed to get student exams:", error);
      res.status(500).json({ error: "시험 목록을 가져오는데 실패했습니다" });
    }
  });

  // Upload exam paper image (R2)
  app.post("/api/exam-papers", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.PRINCIPAL && user.role !== UserRole.TEACHER)) {
        return res.status(403).json({ error: "선생님 이상만 시험지를 업로드할 수 있습니다" });
      }

      const { examId, studentId, objectKey, imageUrl } = req.body;
      if (!examId || !studentId || !objectKey || !imageUrl) {
        return res.status(400).json({ error: "필수 정보가 누락되었습니다" });
      }

      // Set expiration to 45 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 45);

      const paper = await storage.createExamPaper({
        examId,
        studentId,
        objectKey,
        imageUrl,
        expiresAt,
      });

      res.json(paper);
    } catch (error) {
      console.error("Failed to create exam paper:", error);
      res.status(500).json({ error: "시험지 업로드에 실패했습니다" });
    }
  });

  // Delete exam paper
  app.delete("/api/exam-papers/:id", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.PRINCIPAL && user.role !== UserRole.TEACHER)) {
        return res.status(403).json({ error: "선생님 이상만 시험지를 삭제할 수 있습니다" });
      }

      await storage.deleteExamPaper(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete exam paper:", error);
      res.status(500).json({ error: "시험지 삭제에 실패했습니다" });
    }
  });

  // ===== Google Calendar Integration =====
  
  // Get Google Calendar auth URL
  app.get("/api/google-calendar/auth-url", async (req, res) => {
    try {
      const { google } = await import("googleapis");
      const centerId = req.query.centerId as string;
      const actorId = req.query.actorId as string;
      
      if (!centerId || !actorId) {
        return res.status(400).json({ error: "centerId와 actorId가 필요합니다" });
      }
      
      const user = await storage.getUser(actorId);
      if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.PRINCIPAL)) {
        return res.status(403).json({ error: "원장 이상만 구글 캘린더를 연동할 수 있습니다" });
      }
      
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = `${process.env.PUBLIC_URL || 'https://' + (process.env.REPL_SLUG || 'academy') + '.replit.app'}/api/google-calendar/callback`;
      
      if (!clientId || !clientSecret) {
        return res.status(400).json({ error: "Google OAuth가 설정되지 않았습니다" });
      }
      
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
      
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: ["https://www.googleapis.com/auth/calendar.readonly"],
        state: centerId,
        prompt: "consent",
      });
      
      res.json({ authUrl, redirectUri });
    } catch (error) {
      console.error("Failed to generate auth URL:", error);
      res.status(500).json({ error: "인증 URL 생성에 실패했습니다" });
    }
  });
  
  // Google Calendar OAuth callback
  app.get("/api/google-calendar/callback", async (req, res) => {
    try {
      const { google } = await import("googleapis");
      const code = req.query.code as string;
      const centerId = req.query.state as string;
      
      if (!code || !centerId) {
        return res.redirect("/?error=google_auth_failed");
      }
      
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = `${process.env.PUBLIC_URL || 'https://' + (process.env.REPL_SLUG || 'academy') + '.replit.app'}/api/google-calendar/callback`;
      
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
      
      const { tokens } = await oauth2Client.getToken(code);
      
      if (!tokens.access_token || !tokens.refresh_token) {
        return res.redirect("/?error=google_auth_failed");
      }
      
      const expiresAt = new Date(tokens.expiry_date || Date.now() + 3600000);
      
      await storage.upsertGoogleCalendarToken({
        centerId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
      });
      
      res.redirect("/google-calendar-timetable?connected=true");
    } catch (error) {
      console.error("Failed to handle OAuth callback:", error);
      res.redirect("/?error=google_auth_failed");
    }
  });
  
  // Get Google Calendar connection status
  app.get("/api/google-calendar/status", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      if (!centerId) {
        return res.status(400).json({ error: "centerId가 필요합니다" });
      }
      
      const token = await storage.getGoogleCalendarToken(centerId);
      res.json({ connected: !!token });
    } catch (error) {
      console.error("Failed to get calendar status:", error);
      res.status(500).json({ error: "상태 확인에 실패했습니다" });
    }
  });
  
  // Disconnect Google Calendar
  app.delete("/api/google-calendar/disconnect", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      const actorId = req.query.actorId as string;
      
      if (!centerId || !actorId) {
        return res.status(400).json({ error: "centerId와 actorId가 필요합니다" });
      }
      
      const user = await storage.getUser(actorId);
      if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.PRINCIPAL)) {
        return res.status(403).json({ error: "원장 이상만 연동을 해제할 수 있습니다" });
      }
      
      await storage.deleteGoogleCalendarToken(centerId);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to disconnect calendar:", error);
      res.status(500).json({ error: "연동 해제에 실패했습니다" });
    }
  });
  
  // Get calendar events for a week
  app.get("/api/google-calendar/events", async (req, res) => {
    try {
      const { google } = await import("googleapis");
      const centerId = req.query.centerId as string;
      const weekStart = req.query.weekStart as string; // ISO date string
      
      if (!centerId) {
        return res.status(400).json({ error: "centerId가 필요합니다" });
      }
      
      const token = await storage.getGoogleCalendarToken(centerId);
      if (!token) {
        return res.status(400).json({ error: "구글 캘린더가 연동되지 않았습니다" });
      }
      
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
      oauth2Client.setCredentials({
        access_token: token.accessToken,
        refresh_token: token.refreshToken,
      });
      
      // Refresh token if expired
      if (new Date() > token.expiresAt) {
        try {
          const { credentials } = await oauth2Client.refreshAccessToken();
          await storage.upsertGoogleCalendarToken({
            centerId,
            accessToken: credentials.access_token!,
            refreshToken: credentials.refresh_token || token.refreshToken,
            expiresAt: new Date(credentials.expiry_date || Date.now() + 3600000),
          });
          oauth2Client.setCredentials(credentials);
        } catch (refreshError) {
          console.error("Failed to refresh token:", refreshError);
          return res.status(401).json({ error: "토큰 갱신에 실패했습니다. 다시 연동해주세요." });
        }
      }
      
      const calendar = google.calendar({ version: "v3", auth: oauth2Client });
      
      const startDate = weekStart ? new Date(weekStart) : new Date();
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 7);
      
      const response = await calendar.events.list({
        calendarId: token.calendarId || "primary",
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        timeZone: "Asia/Seoul",
      });
      
      const events = response.data.items?.map(event => ({
        id: event.id,
        recurringEventId: event.recurringEventId || null,
        title: event.summary || "(제목 없음)",
        description: event.description || "",
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        location: event.location || "",
      })) || [];
      
      res.json(events);
    } catch (error) {
      console.error("Failed to fetch calendar events:", error);
      res.status(500).json({ error: "일정을 가져오는데 실패했습니다" });
    }
  });
  
  // Get events for a specific student (for student timetable view)
  app.get("/api/google-calendar/my-events", async (req, res) => {
    try {
      const { google } = await import("googleapis");
      const centerId = req.query.centerId as string;
      const studentId = req.query.studentId as string;
      const weekStart = req.query.weekStart as string;
      
      if (!centerId || !studentId) {
        return res.status(400).json({ error: "centerId와 studentId가 필요합니다" });
      }
      
      const token = await storage.getGoogleCalendarToken(centerId);
      if (!token) {
        return res.status(400).json({ error: "구글 캘린더가 연동되지 않았습니다" });
      }
      
      // Get student's enrolled event IDs
      const studentEvents = await storage.getGoogleCalendarStudentEvents(centerId, studentId);
      const enrolledEventIds = studentEvents.map(e => e.eventId);
      
      if (enrolledEventIds.length === 0) {
        return res.json([]);
      }
      
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
      oauth2Client.setCredentials({
        access_token: token.accessToken,
        refresh_token: token.refreshToken,
      });
      
      // Refresh token if expired
      if (new Date() > token.expiresAt) {
        try {
          const { credentials } = await oauth2Client.refreshAccessToken();
          await storage.upsertGoogleCalendarToken({
            centerId,
            accessToken: credentials.access_token!,
            refreshToken: credentials.refresh_token || token.refreshToken,
            expiresAt: new Date(credentials.expiry_date || Date.now() + 3600000),
          });
          oauth2Client.setCredentials(credentials);
        } catch (refreshError) {
          console.error("Failed to refresh token:", refreshError);
          return res.status(401).json({ error: "토큰 갱신에 실패했습니다. 다시 연동해주세요." });
        }
      }
      
      const calendar = google.calendar({ version: "v3", auth: oauth2Client });
      
      // Get events for the specified week (or default to current week)
      const startDate = weekStart ? new Date(weekStart) : new Date();
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 7);
      
      const response = await calendar.events.list({
        calendarId: token.calendarId || "primary",
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        timeZone: "Asia/Seoul",
      });
      
      // Filter to only enrolled events (check both event ID and recurring event ID for recurring events)
      const events = (response.data.items || [])
        .filter(event => {
          const eventId = event.id || "";
          const recurringId = event.recurringEventId || "";
          // Match if enrolled in this specific event instance or in the recurring event series
          return enrolledEventIds.includes(eventId) || 
                 (recurringId && enrolledEventIds.includes(recurringId));
        })
        .map(event => ({
          id: event.id,
          title: event.summary || "(제목 없음)",
          description: event.description || "",
          start: event.start?.dateTime || event.start?.date,
          end: event.end?.dateTime || event.end?.date,
          location: event.location || "",
        }));
      
      res.json(events);
    } catch (error) {
      console.error("Failed to fetch student events:", error);
      res.status(500).json({ error: "일정을 가져오는데 실패했습니다" });
    }
  });

  // Get students for a calendar event (class)
  app.get("/api/google-calendar/events/:eventId/students", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      const { eventId } = req.params;
      
      if (!centerId) {
        return res.status(400).json({ error: "centerId가 필요합니다" });
      }
      
      const classStudents = await storage.getGoogleCalendarClassStudents(centerId, eventId);
      
      // Get student details
      const studentIds = classStudents.map(cs => cs.studentId);
      const students = [];
      for (const studentId of studentIds) {
        const student = await storage.getUser(studentId);
        if (student) {
          students.push({
            id: student.id,
            name: student.name,
            grade: student.grade,
          });
        }
      }
      
      res.json(students);
    } catch (error) {
      console.error("Failed to get event students:", error);
      res.status(500).json({ error: "학생 목록을 가져오는데 실패했습니다" });
    }
  });
  
  // Add student to a calendar event
  app.post("/api/google-calendar/events/:eventId/students", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      const { eventId } = req.params;
      const { centerId, studentId } = req.body;
      
      if (!actorId || !centerId || !studentId) {
        return res.status(400).json({ error: "필수 정보가 누락되었습니다" });
      }
      
      const user = await storage.getUser(actorId);
      if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.PRINCIPAL && user.role !== UserRole.TEACHER)) {
        return res.status(403).json({ error: "선생님 이상만 학생을 추가할 수 있습니다" });
      }
      
      const result = await storage.addGoogleCalendarClassStudent({
        centerId,
        eventId,
        studentId,
      });
      
      res.json(result);
    } catch (error) {
      console.error("Failed to add student to event:", error);
      res.status(500).json({ error: "학생 추가에 실패했습니다" });
    }
  });
  
  // Remove student from a calendar event
  app.delete("/api/google-calendar/events/:eventId/students/:studentId", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      const centerId = req.query.centerId as string;
      const { eventId, studentId } = req.params;
      
      if (!actorId || !centerId) {
        return res.status(400).json({ error: "필수 정보가 누락되었습니다" });
      }
      
      const user = await storage.getUser(actorId);
      if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.PRINCIPAL && user.role !== UserRole.TEACHER)) {
        return res.status(403).json({ error: "선생님 이상만 학생을 제거할 수 있습니다" });
      }
      
      await storage.removeGoogleCalendarClassStudent(centerId, eventId, studentId);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to remove student from event:", error);
      res.status(500).json({ error: "학생 제거에 실패했습니다" });
    }
  });

  // Get all event colors for a center
  app.get("/api/google-calendar/event-colors", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      if (!centerId) {
        return res.status(400).json({ error: "centerId가 필요합니다" });
      }
      const colors = await storage.getGoogleCalendarEventColors(centerId);
      res.json(colors);
    } catch (error) {
      console.error("Failed to get event colors:", error);
      res.status(500).json({ error: "색깔 정보를 가져오는데 실패했습니다" });
    }
  });

  // Set event color
  app.post("/api/google-calendar/events/:eventId/color", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      const { eventId } = req.params;
      const { centerId, colorIndex } = req.body;
      
      if (!actorId || !centerId || colorIndex === undefined) {
        return res.status(400).json({ error: "필수 정보가 누락되었습니다" });
      }
      
      // Validate colorIndex (0-11)
      if (typeof colorIndex !== 'number' || colorIndex < 0 || colorIndex > 11) {
        return res.status(400).json({ error: "유효하지 않은 색깔입니다 (0-11)" });
      }
      
      const user = await storage.getUser(actorId);
      if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.PRINCIPAL && user.role !== UserRole.TEACHER)) {
        return res.status(403).json({ error: "선생님 이상만 색깔을 변경할 수 있습니다" });
      }
      
      const result = await storage.upsertGoogleCalendarEventColor({
        centerId,
        eventId,
        colorIndex,
      });
      res.json(result);
    } catch (error) {
      console.error("Failed to set event color:", error);
      res.status(500).json({ error: "색깔 설정에 실패했습니다" });
    }
  });

  // Get event teachers (담당 선생님 목록)
  app.get("/api/google-calendar/event-teachers", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      if (!centerId) {
        return res.status(400).json({ error: "센터 ID가 필요합니다" });
      }
      
      const teachers = await storage.getGoogleCalendarEventTeachers(centerId);
      res.json(teachers);
    } catch (error) {
      console.error("Failed to fetch event teachers:", error);
      res.status(500).json({ error: "담당 선생님 정보를 가져오는데 실패했습니다" });
    }
  });

  // Set event teacher (이벤트에 담당 선생님 할당)
  app.post("/api/google-calendar/events/:eventId/teacher", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      const { eventId } = req.params;
      const { centerId, teacherId } = req.body;
      
      if (!actorId || !centerId) {
        return res.status(400).json({ error: "필수 정보가 누락되었습니다" });
      }
      
      const user = await storage.getUser(actorId);
      if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.PRINCIPAL && user.role !== UserRole.TEACHER)) {
        return res.status(403).json({ error: "선생님 이상만 담당 선생님을 변경할 수 있습니다" });
      }
      
      const result = await storage.upsertGoogleCalendarEventTeacher({
        centerId,
        eventId,
        teacherId: teacherId || null,
      });
      res.json(result);
    } catch (error) {
      console.error("Failed to set event teacher:", error);
      res.status(500).json({ error: "담당 선생님 설정에 실패했습니다" });
    }
  });

  // ===== Teacher-Student Communication (교사-학생 소통) =====
  
  app.get("/api/teacher-student-messages/unread-total", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      const centerId = req.query.centerId as string;
      if (!actorId || !centerId) return res.status(400).json({ error: "필수 정보가 누락되었습니다" });

      const user = await storage.getUser(actorId);
      if (!user) return res.status(403).json({ error: "권한이 없습니다" });

      let conversations: any[] = [];
      if (user.role === UserRole.PRINCIPAL || user.role === UserRole.ADMIN) {
        conversations = await storage.getAllTeacherStudentConversations(centerId);
      } else if (user.role === UserRole.TEACHER) {
        conversations = await storage.getTeacherStudentConversations(centerId, actorId);
      } else if (user.role === UserRole.STUDENT || user.role === UserRole.PARENT) {
        const effectiveId = user.role === UserRole.PARENT ? (req.query.childId as string || actorId) : actorId;
        const allMessages = await storage.getStudentAllMessages(centerId, effectiveId);
        const unread = allMessages.filter((m: any) => m.receiverId === effectiveId && !m.isRead);
        return res.json({ unreadCount: unread.length });
      }

      const totalUnread = conversations.reduce((sum: number, c: any) => sum + (c.unreadCount || 0), 0);
      res.json({ unreadCount: totalUnread });
    } catch (error) {
      res.status(500).json({ error: "Failed to get unread count" });
    }
  });

  // Get conversations list for a teacher
  // 학생/학부모 화면용: 해당 학생이 대화 가능한 선생님 목록
  // (담임 + 수강 수업 담당 + 기존 대화 이력이 있는 선생님). 호출 시 고아 대화 자동 복구(이관)도 수행하므로
  // 부작용이 있는 작업이라 POST로 노출한다.
  app.post("/api/students/:studentId/communication-teachers", async (req, res) => {
    try {
      const studentId = req.params.studentId;
      const actorId = (req.query.actorId as string) || (req.body?.actorId as string);
      const centerId = (req.query.centerId as string) || (req.body?.centerId as string);
      if (!actorId || !centerId || !studentId) {
        return res.status(400).json({ error: "필수 정보가 누락되었습니다" });
      }
      const actor = await storage.getUser(actorId);
      if (!actor) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }

      // 접근 권한: 본인 학생 / 연결된 학부모 / 같은 센터 소속 교직원만 허용
      const isSelf = actor.id === studentId;
      let authorized = isSelf;
      if (!authorized && actor.role === UserRole.PARENT) {
        const student = await storage.getUser(studentId);
        const linked = Array.isArray(actor.linkedStudentIds) && actor.linkedStudentIds.includes(studentId);
        authorized = linked || student?.parentId === actor.id;
      }
      if (!authorized && (actor.role === UserRole.PRINCIPAL || actor.role === UserRole.ADMIN || actor.role === UserRole.TEACHER)) {
        const actorCenters = await storage.getUserCenters(actorId);
        authorized = actorCenters.some(c => c.id === centerId);
      }
      if (!authorized) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }

      // 이미 담당이 바뀌어 고아가 된 대화를 가능한 범위에서 자동 복구(이관)
      try {
        await reconcileStudentOrphanConversations(centerId, studentId);
      } catch (reconcileErr) {
        console.error("[TeacherComm] 고아 대화 복구 실패:", reconcileErr);
      }

      const { connected } = await getConnectedTeacherIdsForStudent(centerId, studentId);
      const teacherIdSet = new Set<string>(connected);
      // 복구 후에도 남아있는 이력 선생님까지 포함하여 숨김 방지
      const msgs = await storage.getStudentAllMessages(centerId, studentId);
      msgs.forEach(m => teacherIdSet.add(m.teacherId));

      const teacherUsers = await Promise.all(
        Array.from(teacherIdSet).map(id => storage.getUser(id))
      );
      const result = teacherUsers.filter((u): u is NonNullable<typeof u> => !!u);
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch communication teachers:", error);
      res.status(500).json({ error: "선생님 목록을 가져오는데 실패했습니다" });
    }
  });

  app.get("/api/teacher-student-messages/conversations", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      const centerId = req.query.centerId as string;
      const teacherId = req.query.teacherId as string;
      
      if (!actorId || !centerId) {
        return res.status(400).json({ error: "필수 정보가 누락되었습니다" });
      }
      
      const user = await storage.getUser(actorId);
      if (!user) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }
      
      // Principal can view all conversations
      if (user.role === UserRole.PRINCIPAL || user.role === UserRole.ADMIN) {
        const conversations = await storage.getAllTeacherStudentConversations(centerId);
        res.json(conversations);
      } else if (user.role === UserRole.TEACHER) {
        // Teacher can only view their own conversations
        const conversations = await storage.getTeacherStudentConversations(centerId, actorId);
        res.json(conversations);
      } else {
        return res.status(403).json({ error: "권한이 없습니다" });
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
      res.status(500).json({ error: "대화 목록을 가져오는데 실패했습니다" });
    }
  });
  
  // Get messages for a specific conversation
  app.get("/api/teacher-student-messages", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      const centerId = req.query.centerId as string;
      const teacherId = req.query.teacherId as string;
      const studentId = req.query.studentId as string;
      
      if (!actorId || !centerId || !studentId) {
        return res.status(400).json({ error: "필수 정보가 누락되었습니다" });
      }
      
      const user = await storage.getUser(actorId);
      if (!user) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }
      
      // Principal/Admin with teacherId "all" can view ALL messages for a student
      if ((user.role === UserRole.PRINCIPAL || user.role === UserRole.ADMIN) && (!teacherId || teacherId === "all")) {
        // 원장/관리자가 본인이 실제 수신자인 메시지는 읽음 처리하여 미읽음(빨간 1)이 소거되도록 한다.
        // (다른 선생님이 수신자인 메시지는 그대로 두어 담당 선생님이 직접 읽어야 0이 된다.)
        await storage.markStudentMessagesAsReadForReceiver(centerId, studentId, actorId);
        const messages = await storage.getStudentAllMessages(centerId, studentId);
        res.json(messages);
        return;
      }

      if (!teacherId) {
        return res.status(400).json({ error: "필수 정보가 누락되었습니다" });
      }
      
      // Check permissions: only teacher in conversation, student in conversation, or principal/admin
      if (user.role === UserRole.STUDENT) {
        if (user.id !== studentId) {
          return res.status(403).json({ error: "본인의 대화만 확인할 수 있습니다" });
        }
        // 담임 선생님, 수강 중 수업의 담당 선생님, 또는 기존 대화 이력이 있는 선생님과의 대화는 열람 가능
        const { connected } = await getConnectedTeacherIdsForStudent(centerId, studentId);
        let canView = connected.has(teacherId);
        if (!canView) {
          const history = await storage.getTeacherStudentMessages(centerId, teacherId, studentId);
          canView = history.length > 0;
        }
        if (!canView) {
          return res.status(403).json({ error: "담임 선생님 또는 담당 선생님과의 대화만 확인할 수 있습니다" });
        }
      }
      if (user.role === UserRole.PARENT) {
        // 연결된 자녀의 대화만 열람 가능
        const child = await storage.getUser(studentId);
        const linked = (Array.isArray(user.linkedStudentIds) && user.linkedStudentIds.includes(studentId))
          || child?.parentId === user.id;
        if (!linked) {
          return res.status(403).json({ error: "연결된 자녀의 대화만 확인할 수 있습니다" });
        }
        const { connected } = await getConnectedTeacherIdsForStudent(centerId, studentId);
        let canView = connected.has(teacherId);
        if (!canView) {
          const history = await storage.getTeacherStudentMessages(centerId, teacherId, studentId);
          canView = history.length > 0;
        }
        if (!canView) {
          return res.status(403).json({ error: "담임 선생님 또는 담당 선생님과의 대화만 확인할 수 있습니다" });
        }
      }
      if (user.role === UserRole.TEACHER) {
        if (user.id !== teacherId) {
          return res.status(403).json({ error: "본인의 대화만 확인할 수 있습니다" });
        }
        const student = await storage.getUser(studentId);
        if (!student) {
          return res.status(404).json({ error: "학생을 찾을 수 없습니다" });
        }
        const teacherClasses = await storage.getClasses(centerId);
        const myClasses = teacherClasses.filter(c => c.teacherId === teacherId);
        const enrollments = await storage.getStudentEnrollments(studentId);
        const isMyStudent = student.homeroomTeacherId === teacherId || 
          enrollments.some(e => myClasses.some(c => c.id === e.classId));
        if (!isMyStudent) {
          return res.status(403).json({ error: "담당 학생이 아닙니다" });
        }
      }
      // Principal/Admin can view all conversations
      
      const messages = await storage.getTeacherStudentMessages(centerId, teacherId, studentId);
      
      // Mark messages as read
      await storage.markMessagesAsRead(centerId, teacherId, studentId, actorId);
      
      res.json(messages);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
      res.status(500).json({ error: "메시지를 가져오는데 실패했습니다" });
    }
  });
  
  // Send a message
  app.post("/api/teacher-student-messages", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      const { centerId, teacherId, studentId, content, imageObjectKey } = req.body;
      
      if (!actorId || !centerId || !teacherId || !studentId || (!content && !imageObjectKey)) {
        return res.status(400).json({ error: "필수 정보가 누락되었습니다" });
      }
      
      // 이미지 objectKey 검증: 해당 센터의 chat prefix만 허용, URL은 서버에서 재구성
      let imageUrl: string | null = null;
      if (imageObjectKey) {
        const allowedPrefixes = [`centers/${centerId}/chat/`, "chat/"];
        const isValidKey = typeof imageObjectKey === "string" &&
          !imageObjectKey.includes("..") &&
          allowedPrefixes.some(p => imageObjectKey.startsWith(p));
        if (!isValidKey) {
          return res.status(400).json({ error: "유효하지 않은 이미지입니다" });
        }
        const { getPublicUrl } = await import("./r2-storage");
        imageUrl = getPublicUrl(imageObjectKey);
      }
      
      // Validate content length
      if (content && content.length > 2000) {
        return res.status(400).json({ error: "메시지는 2000자를 초과할 수 없습니다" });
      }
      
      const user = await storage.getUser(actorId);
      if (!user) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }
      
      // Determine sender and receiver with authorization checks
      let senderId: string;
      let receiverId: string;
      
      if (user.role === UserRole.STUDENT || user.role === UserRole.PARENT) {
        const actualStudentId = user.role === UserRole.PARENT ? studentId : user.id;
        if (user.role === UserRole.STUDENT && user.id !== studentId) {
          return res.status(403).json({ error: "권한이 없습니다" });
        }
        const enrollments = await storage.getStudentEnrollments(actualStudentId);
        const allClasses = await storage.getClasses(centerId);
        const enrolledClassIds = enrollments.map(e => e.classId);
        const enrolledClassTeacherIds = allClasses
          .filter(c => enrolledClassIds.includes(c.id))
          .map(c => c.teacherId)
          .filter((id): id is string => id !== null);
        
        const studentUser = await storage.getUser(actualStudentId);
        const canMessageTeacher = studentUser?.homeroomTeacherId === teacherId || 
          enrolledClassTeacherIds.includes(teacherId);
        
        if (!canMessageTeacher) {
          return res.status(403).json({ error: "담임 선생님이나 수강 중인 수업의 선생님에게만 메시지를 보낼 수 있습니다" });
        }
        senderId = actualStudentId;
        receiverId = teacherId;
      } else if (user.role === UserRole.TEACHER) {
        // Verify teacher has access to this student
        const student = await storage.getUser(studentId);
        if (!student) {
          return res.status(404).json({ error: "학생을 찾을 수 없습니다" });
        }
        const teacherClasses = await storage.getClasses(centerId);
        const myClasses = teacherClasses.filter(c => c.teacherId === user.id);
        const enrollments = await storage.getStudentEnrollments(studentId);
        const isMyStudent = student.homeroomTeacherId === user.id || 
          enrollments.some(e => myClasses.some(c => c.id === e.classId));
        if (!isMyStudent) {
          return res.status(403).json({ error: "담당 학생에게만 메시지를 보낼 수 있습니다" });
        }
        senderId = actorId;
        receiverId = studentId;
      } else if (user.role === UserRole.PRINCIPAL || user.role === UserRole.ADMIN) {
        // Principal/Admin can send messages on behalf of themselves
        senderId = actorId;
        receiverId = studentId;
      } else {
        return res.status(403).json({ error: "권한이 없습니다" });
      }
      
      const message = await storage.createTeacherStudentMessage({
        centerId,
        senderId,
        receiverId,
        teacherId,
        studentId,
        content: content || "",
        imageUrl: imageUrl || null,
        imageObjectKey: imageObjectKey || null,
        isRead: false,
      });

      // 채팅 이미지는 2주(14일) 후 R2에서 자동 삭제
      if (imageObjectKey) {
        try {
          await storage.scheduleObjectDeletion(imageObjectKey, "chat-image", centerId, 14);
        } catch (schedErr) {
          console.error("[TeacherComm] Failed to schedule image deletion:", schedErr);
        }
      }

      try {
        const sender = await storage.getUser(senderId);
        const senderName = sender?.name || "알 수 없음";
        const baseContent = content || (imageUrl ? "[사진]" : "");
        const shortContent = baseContent.length > 50 ? baseContent.substring(0, 50) + "..." : baseContent;
        console.log(`[TeacherComm] Creating notification for receiverId=${receiverId}, sender=${senderName}`);
        await storage.createNotification({
          userId: receiverId,
          type: "teacher_communication",
          title: `${senderName}님의 메시지`,
          message: shortContent,
          relatedId: centerId,
          relatedType: "teacher_communication",
        });
        console.log(`[TeacherComm] Notification created successfully for receiverId=${receiverId}`);
      } catch (notifErr) {
        console.error("[TeacherComm] Failed to create notification:", notifErr);
      }

      res.json(message);
    } catch (error) {
      console.error("Failed to send message:", error);
      res.status(500).json({ error: "메시지 전송에 실패했습니다" });
    }
  });
  
  // Mark messages as read
  app.patch("/api/teacher-student-messages/read", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      const { centerId, teacherId, studentId } = req.body;
      
      if (!actorId || !centerId || !teacherId || !studentId) {
        return res.status(400).json({ error: "필수 정보가 누락되었습니다" });
      }
      
      const actor = await storage.getUser(actorId);
      if (!actor) return res.status(403).json({ error: "권한이 없습니다" });

      // 관리자/원장은 열람만 가능하므로 읽음 처리를 하지 않는다.
      // 미읽음 알림은 실제 수신자(담당 선생님 또는 학생/학부모)가 직접 봤을 때만 소거된다.
      if (actor.role < UserRole.PRINCIPAL) {
        await storage.markMessagesAsRead(centerId, teacherId, studentId, actorId);
      }
      // 교사소통 메시지 읽음 처리 시 관련 인앱 알림도 동기화
      try {
        const userNotifs = await storage.getNotifications(actorId);
        const commNotifs = userNotifs.filter(n => n.type === "teacher_communication" && !n.isRead);
        for (const n of commNotifs) {
          await storage.markNotificationAsRead(n.id);
        }
      } catch {}
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to mark messages as read:", error);
      res.status(500).json({ error: "읽음 처리에 실패했습니다" });
    }
  });

  // Set chat password (student only)
  app.post("/api/users/:userId/chat-password", async (req, res) => {
    try {
      const { userId } = req.params;
      const { password } = req.body;
      
      if (!password || password.length < 4) {
        return res.status(400).json({ error: "비밀번호는 4자리 이상이어야 합니다" });
      }
      
      const user = await storage.getUser(userId);
      if (!user || user.role !== UserRole.STUDENT) {
        return res.status(403).json({ error: "학생만 비밀번호를 설정할 수 있습니다" });
      }
      
      await storage.updateUser(userId, { chatPassword: password });
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to set chat password:", error);
      res.status(500).json({ error: "비밀번호 설정에 실패했습니다" });
    }
  });

  // Verify chat password (student only)
  app.post("/api/users/:userId/verify-chat-password", async (req, res) => {
    try {
      const { userId } = req.params;
      const { password } = req.body;
      
      const user = await storage.getUser(userId);
      if (!user || user.role !== UserRole.STUDENT) {
        return res.status(403).json({ error: "학생만 확인할 수 있습니다" });
      }
      
      const isValid = user.chatPassword === password;
      res.json({ valid: isValid });
    } catch (error) {
      console.error("Failed to verify chat password:", error);
      res.status(500).json({ error: "비밀번호 확인에 실패했습니다" });
    }
  });

  // Remove chat password (student only)
  app.delete("/api/users/:userId/chat-password", async (req, res) => {
    try {
      const { userId } = req.params;
      
      const user = await storage.getUser(userId);
      if (!user || user.role !== UserRole.STUDENT) {
        return res.status(403).json({ error: "학생만 비밀번호를 삭제할 수 있습니다" });
      }
      
      await storage.updateUser(userId, { chatPassword: null });
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to remove chat password:", error);
      res.status(500).json({ error: "비밀번호 삭제에 실패했습니다" });
    }
  });

  // Agree to electronic information consent (전자정보 이용 동의)
  app.post("/api/users/:userId/consent", async (req, res) => {
    try {
      const { userId } = req.params;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }
      
      await storage.updateUser(userId, { consentAgreedAt: new Date() });
      res.json({ success: true, consentAgreedAt: new Date() });
    } catch (error) {
      console.error("Failed to save consent:", error);
      res.status(500).json({ error: "동의 저장에 실패했습니다" });
    }
  });

  // =====================================================
  // Daily Notices (알림장) API
  // =====================================================
  
  // Get daily notice for a specific student and date
  app.get("/api/daily-notices", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      const studentId = req.query.studentId as string;
      const noticeDate = req.query.noticeDate as string;
      const userId = req.query.userId as string;
      
      if (!centerId || !studentId || !noticeDate) {
        return res.status(400).json({ error: "필수 정보가 누락되었습니다" });
      }
      
      // Access control: if userId provided, check permissions
      if (userId) {
        const user = await storage.getUser(userId);
        if (user) {
          // Students can only view their own notices
          if (user.role === UserRole.STUDENT && studentId !== user.id) {
            return res.status(403).json({ error: "접근 권한이 없습니다" });
          }
          // Parents can only view linked student notices
          if (user.role === UserRole.PARENT) {
            const linkedStudentIds = user.linkedStudentIds || [];
            if (!linkedStudentIds.includes(studentId)) {
              return res.status(403).json({ error: "접근 권한이 없습니다" });
            }
          }
        }
      }
      
      const notice = await storage.getDailyNotice(centerId, studentId, noticeDate);
      res.json(notice || null);
    } catch (error) {
      console.error("Failed to get daily notice:", error);
      res.status(500).json({ error: "알림장을 불러오는데 실패했습니다" });
    }
  });
  
  // Get all daily notices for a student
  app.get("/api/daily-notices/student/:studentId", async (req, res) => {
    try {
      const { studentId } = req.params;
      const centerId = req.query.centerId as string;
      const userId = req.query.userId as string;
      
      if (!centerId) {
        return res.status(400).json({ error: "센터 정보가 필요합니다" });
      }
      
      // Access control: if userId provided, check permissions
      if (userId) {
        const user = await storage.getUser(userId);
        if (user) {
          // Students can only view their own notices
          if (user.role === UserRole.STUDENT && studentId !== user.id) {
            return res.status(403).json({ error: "접근 권한이 없습니다" });
          }
          // Parents can only view linked student notices
          if (user.role === UserRole.PARENT) {
            const linkedStudentIds = user.linkedStudentIds || [];
            if (!linkedStudentIds.includes(studentId)) {
              return res.status(403).json({ error: "접근 권한이 없습니다" });
            }
          }
        }
      }
      
      const notices = await storage.getDailyNoticesByStudent(centerId, studentId);
      res.json(notices);
    } catch (error) {
      console.error("Failed to get daily notices:", error);
      res.status(500).json({ error: "알림장 목록을 불러오는데 실패했습니다" });
    }
  });
  
  // Get all daily notices for a center on a specific date (teachers and above only)
  app.get("/api/daily-notices/center/:centerId", async (req, res) => {
    try {
      const { centerId } = req.params;
      const noticeDate = req.query.noticeDate as string;
      const userId = req.query.userId as string;
      
      if (!noticeDate) {
        return res.status(400).json({ error: "날짜 정보가 필요합니다" });
      }
      
      // Access control: verify user is teacher or above
      if (userId) {
        const user = await storage.getUser(userId);
        if (!user || user.role < UserRole.TEACHER) {
          return res.status(403).json({ error: "접근 권한이 없습니다" });
        }
        // Verify user belongs to this center (except admin who can access all)
        if (user.role !== UserRole.ADMIN) {
          const userCenters = await storage.getUserCenters(user.id);
          const userCenterIds = userCenters.map(c => c.id);
          if (!userCenterIds.includes(centerId)) {
            return res.status(403).json({ error: "해당 센터에 대한 접근 권한이 없습니다" });
          }
        }
      }
      
      const notices = await storage.getDailyNoticesByCenter(centerId, noticeDate);
      res.json(notices);
    } catch (error) {
      console.error("Failed to get daily notices:", error);
      res.status(500).json({ error: "알림장 목록을 불러오는데 실패했습니다" });
    }
  });
  
  // Create or update daily notice (teachers and above only)
  app.post("/api/daily-notices", async (req, res) => {
    try {
      const { centerId, studentId, noticeDate, additionalNote, createdBy } = req.body;
      
      if (!createdBy) {
        return res.status(400).json({ error: "사용자 정보가 필요합니다" });
      }
      
      // Verify user exists and is teacher or above
      const user = await storage.getUser(createdBy);
      if (!user) {
        return res.status(400).json({ error: "사용자를 찾을 수 없습니다" });
      }
      
      // Only teachers and above can create/update notices
      if (user.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "접근 권한이 없습니다" });
      }
      
      if (!centerId || !studentId || !noticeDate) {
        return res.status(400).json({ error: "필수 정보가 누락되었습니다" });
      }
      
      // Verify user belongs to this center (except admin who can access all)
      if (user.role !== UserRole.ADMIN) {
        const userCenters = await storage.getUserCenters(user.id);
        const userCenterIds = userCenters.map(c => c.id);
        if (!userCenterIds.includes(centerId)) {
          return res.status(403).json({ error: "해당 센터에 대한 접근 권한이 없습니다" });
        }
      }
      
      // Verify the student belongs to the same center
      const student = await storage.getUser(studentId);
      if (!student || student.role !== UserRole.STUDENT) {
        return res.status(400).json({ error: "유효하지 않은 학생입니다" });
      }
      
      // Check if notice already exists
      const existingNotice = await storage.getDailyNotice(centerId, studentId, noticeDate);
      
      if (existingNotice) {
        // Update existing notice
        const updated = await storage.updateDailyNotice(existingNotice.id, { additionalNote });
        res.json(updated);
      } else {
        // Create new notice - use session user ID for createdBy
        const notice = await storage.createDailyNotice({
          centerId,
          studentId,
          noticeDate,
          additionalNote,
          createdBy: user.id,
        });
        res.json(notice);
      }
    } catch (error) {
      console.error("Failed to save daily notice:", error);
      res.status(500).json({ error: "알림장 저장에 실패했습니다" });
    }
  });
  
  // Send daily notice SMS to parents
  app.post("/api/daily-notices/send-sms", async (req, res) => {
    try {
      const { actorId, centerId, studentIds, date, message } = req.body;
      if (!actorId || !centerId || !studentIds || !date || !message) {
        return res.status(400).json({ error: "필수 정보가 누락되었습니다" });
      }
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 문자를 보낼 수 있습니다" });
      }

      const center = await storage.getCenter(centerId);
      if (!center) {
        return res.status(404).json({ error: "센터를 찾을 수 없습니다" });
      }

      const results: { studentId: string; studentName: string; phone: string; success: boolean; error?: string }[] = [];

      for (const studentId of studentIds) {
        const student = await storage.getUser(studentId);
        if (!student || student.role !== UserRole.STUDENT) continue;
        const studentCenters = await storage.getUserCenters(studentId);
        if (!studentCenters.some(c => c.id === centerId)) continue;

        const parentPhone = student.motherPhone || student.fatherPhone || student.phone;
        if (!parentPhone) {
          results.push({ studentId, studentName: student.name, phone: "", success: false, error: "학부모 연락처 없음" });
          // 연락처가 없어 발송하지 못한 경우도 발송내역에 실패로 남긴다.
          try {
            await storage.createSmsHistory({
              centerId,
              sentBy: actorId,
              studentId,
              recipientPhone: "",
              recipientType: "student",
              message,
              status: "failed",
              errorMessage: "학부모 연락처 없음",
              category: "daily_notice",
              referenceId: date,
            });
          } catch (histErr: any) {
            console.error(`[알림장SMS] 이력 저장 실패(연락처없음) student=${studentId}: ${histErr?.message || histErr}`);
          }
          continue;
        }

        let smsResult: { success: boolean; error?: string };
        try {
          smsResult = await sendSms({ to: parentPhone, text: message, centerName: center.name, centerId: center.id });
        } catch (sendErr: any) {
          smsResult = { success: false, error: sendErr?.message || "발송 중 오류 발생" };
        }
        results.push({
          studentId,
          studentName: student.name,
          phone: parentPhone.slice(0, 3) + "****" + parentPhone.slice(-4),
          success: smsResult.success,
          error: smsResult.error,
        });

        const recipientType = parentPhone === student.motherPhone
          ? "mother"
          : parentPhone === student.fatherPhone
            ? "father"
            : "student";
        try {
          await storage.createSmsHistory({
            centerId,
            sentBy: actorId,
            studentId,
            recipientPhone: parentPhone,
            recipientType,
            message,
            status: smsResult.success ? "sent" : "failed",
            errorMessage: smsResult.success ? undefined : (smsResult.error || "발송 실패"),
            category: "daily_notice",
            referenceId: date,
          });
        } catch (histErr: any) {
          console.error(`[알림장SMS] 이력 저장 실패 student=${studentId}: ${histErr?.message || histErr}`);
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      res.json({ 
        success: true, 
        message: `${successCount}명 발송 완료${failCount > 0 ? `, ${failCount}명 실패` : ""}`,
        results,
      });
    } catch (error) {
      console.error("Failed to send daily notice SMS:", error);
      res.status(500).json({ error: "문자 발송에 실패했습니다" });
    }
  });

  // Delete daily notice (teachers and above only)
  app.delete("/api/daily-notices/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.query.userId as string;
      
      if (!userId) {
        return res.status(400).json({ error: "사용자 정보가 필요합니다" });
      }
      
      // Verify user exists and is teacher or above
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(400).json({ error: "사용자를 찾을 수 없습니다" });
      }
      
      // Only teachers and above can delete notices
      if (user.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "접근 권한이 없습니다" });
      }
      
      // Load notice to verify center membership
      const notice = await storage.getDailyNoticeById(id);
      if (!notice) {
        return res.status(404).json({ error: "알림장을 찾을 수 없습니다" });
      }
      
      // Verify user belongs to this center (except admin who can access all)
      if (user.role !== UserRole.ADMIN) {
        const userCenters = await storage.getUserCenters(user.id);
        const userCenterIds = userCenters.map(c => c.id);
        if (!userCenterIds.includes(notice.centerId)) {
          return res.status(403).json({ error: "해당 센터에 대한 접근 권한이 없습니다" });
        }
      }
      
      await storage.deleteDailyNotice(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete daily notice:", error);
      res.status(500).json({ error: "알림장 삭제에 실패했습니다" });
    }
  });

  // ============ Video Sessions (실시간 화상강의) ============

  // Get video sessions for a center (teachers/principals)
  app.get("/api/video-sessions", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      if (!centerId) {
        return res.status(400).json({ error: "센터 ID가 필요합니다" });
      }
      const sessions = await storage.getVideoSessions(centerId);
      
      // Enrich with host and class info
      const enrichedSessions = await Promise.all(sessions.map(async (session) => {
        const host = await storage.getUser(session.hostId);
        const classInfo = await storage.getClass(session.classId);
        const participants = await storage.getVideoSessionParticipants(session.id);
        return {
          ...session,
          hostName: host?.name || "Unknown",
          className: classInfo ? `${classInfo.name}${classInfo.subject ? ` ${classInfo.subject}반` : ""}` : "Unknown",
          participantCount: participants.length,
        };
      }));
      
      res.json(enrichedSessions);
    } catch (error) {
      console.error("Failed to get video sessions:", error);
      res.status(500).json({ error: "화상강의 목록을 불러오는데 실패했습니다" });
    }
  });

  // Get active video sessions for a student
  app.get("/api/video-sessions/student/:studentId", async (req, res) => {
    try {
      const { studentId } = req.params;
      const sessions = await storage.getActiveVideoSessionsForStudent(studentId);
      
      // Enrich with host and class info
      const enrichedSessions = await Promise.all(sessions.map(async (session) => {
        const host = await storage.getUser(session.hostId);
        const classInfo = await storage.getClass(session.classId);
        return {
          ...session,
          hostName: host?.name || "Unknown",
          className: classInfo ? `${classInfo.name}${classInfo.subject ? ` ${classInfo.subject}반` : ""}` : "Unknown",
        };
      }));
      
      res.json(enrichedSessions);
    } catch (error) {
      console.error("Failed to get student video sessions:", error);
      res.status(500).json({ error: "화상강의 목록을 불러오는데 실패했습니다" });
    }
  });

  // Get single video session with participants
  app.get("/api/video-sessions/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const session = await storage.getVideoSession(id);
      if (!session) {
        return res.status(404).json({ error: "화상강의를 찾을 수 없습니다" });
      }
      
      const host = await storage.getUser(session.hostId);
      const classInfo = await storage.getClass(session.classId);
      const participants = await storage.getVideoSessionParticipants(session.id);
      
      // Get student info for each participant
      const enrichedParticipants = await Promise.all(participants.map(async (p) => {
        const student = await storage.getUser(p.studentId);
        return {
          ...p,
          studentName: student?.name || "Unknown",
          studentGrade: student?.grade || "",
        };
      }));
      
      res.json({
        ...session,
        hostName: host?.name || "Unknown",
        className: classInfo ? `${classInfo.name}${classInfo.subject ? ` ${classInfo.subject}반` : ""}` : "Unknown",
        participants: enrichedParticipants,
      });
    } catch (error) {
      console.error("Failed to get video session:", error);
      res.status(500).json({ error: "화상강의 정보를 불러오는데 실패했습니다" });
    }
  });

  // Create video session (teachers/principals only)
  app.post("/api/video-sessions", async (req, res) => {
    try {
      const { centerId, classId, title, hostId, studentIds } = req.body;
      
      if (!centerId || !classId || !title || !hostId) {
        return res.status(400).json({ error: "필수 정보가 누락되었습니다" });
      }
      
      // Verify host is teacher or above
      const host = await storage.getUser(hostId);
      if (!host || host.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "화상강의 개설 권한이 없습니다" });
      }
      
      // Generate unique room name
      const roomName = `primemath-${centerId.slice(0, 8)}-${Date.now()}`;
      
      // Create session
      const session = await storage.createVideoSession({
        centerId,
        classId,
        title,
        roomName,
        hostId,
        status: "scheduled",
        scheduledAt: null,
        startedAt: null,
        endedAt: null,
      });
      
      // Add participants
      if (studentIds && Array.isArray(studentIds)) {
        for (const studentId of studentIds) {
          await storage.addVideoSessionParticipant({
            sessionId: session.id,
            studentId,
            joinedAt: null,
            leftAt: null,
          });
        }
      }
      
      res.json(session);
    } catch (error) {
      console.error("Failed to create video session:", error);
      res.status(500).json({ error: "화상강의 생성에 실패했습니다" });
    }
  });

  // Start video session (host only)
  app.post("/api/video-sessions/:id/start", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.query.userId as string;
      
      const session = await storage.getVideoSession(id);
      if (!session) {
        return res.status(404).json({ error: "화상강의를 찾을 수 없습니다" });
      }
      
      // Verify requester is the host or admin
      if (userId) {
        const user = await storage.getUser(userId);
        if (!user || (user.role < UserRole.ADMIN && session.hostId !== userId)) {
          return res.status(403).json({ error: "화상강의 시작 권한이 없습니다" });
        }
      }
      
      const updated = await storage.updateVideoSession(id, {
        status: "active",
        startedAt: new Date(),
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Failed to start video session:", error);
      res.status(500).json({ error: "화상강의 시작에 실패했습니다" });
    }
  });

  // End video session (host only)
  app.post("/api/video-sessions/:id/end", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.query.userId as string;
      
      const session = await storage.getVideoSession(id);
      if (!session) {
        return res.status(404).json({ error: "화상강의를 찾을 수 없습니다" });
      }
      
      // Verify requester is the host or admin
      if (userId) {
        const user = await storage.getUser(userId);
        if (!user || (user.role < UserRole.ADMIN && session.hostId !== userId)) {
          return res.status(403).json({ error: "화상강의 종료 권한이 없습니다" });
        }
      }
      
      const updated = await storage.updateVideoSession(id, {
        status: "ended",
        endedAt: new Date(),
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Failed to end video session:", error);
      res.status(500).json({ error: "화상강의 종료에 실패했습니다" });
    }
  });

  // Delete video session (teacher/principal only)
  app.delete("/api/video-sessions/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.query.userId as string;
      
      // Verify requester is teacher or above
      if (userId) {
        const user = await storage.getUser(userId);
        if (!user || user.role < UserRole.TEACHER) {
          return res.status(403).json({ error: "화상강의 삭제 권한이 없습니다" });
        }
      }
      
      await storage.deleteVideoSession(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete video session:", error);
      res.status(500).json({ error: "화상강의 삭제에 실패했습니다" });
    }
  });

  // Add participants to session
  app.post("/api/video-sessions/:id/participants", async (req, res) => {
    try {
      const { id } = req.params;
      const { studentIds } = req.body;
      
      if (!studentIds || !Array.isArray(studentIds)) {
        return res.status(400).json({ error: "학생 ID 목록이 필요합니다" });
      }
      
      const session = await storage.getVideoSession(id);
      if (!session) {
        return res.status(404).json({ error: "화상강의를 찾을 수 없습니다" });
      }
      
      for (const studentId of studentIds) {
        await storage.addVideoSessionParticipant({
          sessionId: id,
          studentId,
          joinedAt: null,
          leftAt: null,
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to add participants:", error);
      res.status(500).json({ error: "참여자 추가에 실패했습니다" });
    }
  });

  // Remove participant from session
  app.delete("/api/video-sessions/:id/participants/:studentId", async (req, res) => {
    try {
      const { id, studentId } = req.params;
      await storage.removeVideoSessionParticipant(id, studentId);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to remove participant:", error);
      res.status(500).json({ error: "참여자 제거에 실패했습니다" });
    }
  });

  // Record participant join
  app.post("/api/video-sessions/:id/join", async (req, res) => {
    try {
      const { id } = req.params;
      const { participantId } = req.body;
      
      const participants = await storage.getVideoSessionParticipants(id);
      const participant = participants.find(p => p.id === participantId);
      
      if (participant) {
        await storage.updateVideoSessionParticipant(participantId, {
          joinedAt: new Date(),
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to record join:", error);
      res.status(500).json({ error: "참여 기록에 실패했습니다" });
    }
  });

  // ============ SMS Setup Guide Steps (SMS 연결 가이드) ============
  
  // Multer for SMS guide images
  const smsGuideUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
  }).single("image");
  
  // Get all SMS setup guide steps (anyone can view)
  app.get("/api/sms-setup-guide", async (req, res) => {
    try {
      const steps = await storage.getSmsSetupGuideSteps();
      res.json(steps);
    } catch (error) {
      console.error("Failed to get SMS setup guide steps:", error);
      res.status(500).json({ error: "가이드를 불러오는데 실패했습니다" });
    }
  });

  // Create SMS setup guide step (admin only)
  app.post("/api/sms-setup-guide", smsGuideUpload, async (req, res) => {
    try {
      const userId = req.query.userId as string;
      
      if (!userId) {
        return res.status(400).json({ error: "사용자 정보가 필요합니다" });
      }
      
      const user = await storage.getUser(userId);
      if (!user || user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 접근할 수 있습니다" });
      }
      
      const { stepNumber, title, description, linkUrl, linkText } = req.body;
      
      if (!stepNumber || !title) {
        return res.status(400).json({ error: "단계 번호와 제목은 필수입니다" });
      }

      let imageUrl: string | undefined;
      
      // Handle image upload to R2
      if (req.file && isR2Configured()) {
        const key = `sms-setup-guide/step-${stepNumber}-${Date.now()}.${req.file.originalname.split('.').pop()}`;
        imageUrl = await uploadBuffer(req.file.buffer, key, req.file.mimetype);
      }
      
      const step = await storage.createSmsSetupGuideStep({
        stepNumber: parseInt(stepNumber),
        title,
        description: description || null,
        imageUrl: imageUrl || null,
        linkUrl: linkUrl || null,
        linkText: linkText || null,
        isActive: true,
      });
      res.json(step);
    } catch (error) {
      console.error("Failed to create SMS setup guide step:", error);
      res.status(500).json({ error: "가이드 단계 생성에 실패했습니다" });
    }
  });

  // Update SMS setup guide step (admin only)
  app.put("/api/sms-setup-guide/:id", smsGuideUpload, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.query.userId as string;
      
      if (!userId) {
        return res.status(400).json({ error: "사용자 정보가 필요합니다" });
      }
      
      const user = await storage.getUser(userId);
      if (!user || user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 접근할 수 있습니다" });
      }
      
      const { stepNumber, title, description, linkUrl, linkText, imageUrl: existingImageUrl } = req.body;
      
      let imageUrl: string | undefined;
      
      // Handle image upload to R2
      if (req.file && isR2Configured()) {
        const key = `sms-setup-guide/step-${stepNumber || id}-${Date.now()}.${req.file.originalname.split('.').pop()}`;
        imageUrl = await uploadBuffer(req.file.buffer, key, req.file.mimetype);
        
        // Delete old image if exists
        const existing = await storage.getSmsSetupGuideStep(id);
        if (existing?.imageUrl) {
          const r2PublicUrl = process.env.R2_PUBLIC_URL || '';
          const oldKey = existing.imageUrl.replace(`${r2PublicUrl}/`, '');
          try {
            await deleteObject(oldKey);
          } catch (e) {
            console.error("Failed to delete old SMS guide image:", e);
          }
        }
      }
      
      const updateData: any = {};
      if (stepNumber) updateData.stepNumber = parseInt(stepNumber);
      if (title) updateData.title = title;
      if (description !== undefined) updateData.description = description || null;
      if (linkUrl !== undefined) updateData.linkUrl = linkUrl || null;
      if (linkText !== undefined) updateData.linkText = linkText || null;
      if (imageUrl) updateData.imageUrl = imageUrl;
      else if (existingImageUrl !== undefined) updateData.imageUrl = existingImageUrl || null;
      
      const step = await storage.updateSmsSetupGuideStep(id, updateData);
      res.json(step);
    } catch (error) {
      console.error("Failed to update SMS setup guide step:", error);
      res.status(500).json({ error: "가이드 단계 수정에 실패했습니다" });
    }
  });

  // Delete SMS setup guide step (admin only)
  app.delete("/api/sms-setup-guide/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.query.userId as string;
      
      if (!userId) {
        return res.status(400).json({ error: "사용자 정보가 필요합니다" });
      }
      
      const user = await storage.getUser(userId);
      if (!user || user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 접근할 수 있습니다" });
      }
      
      // Delete image from R2 if exists
      const existing = await storage.getSmsSetupGuideStep(id);
      if (existing?.imageUrl && isR2Configured()) {
        const r2PublicUrl = process.env.R2_PUBLIC_URL || '';
        const oldKey = existing.imageUrl.replace(`${r2PublicUrl}/`, '');
        try {
          await deleteObject(oldKey);
        } catch (e) {
          console.error("Failed to delete SMS guide image:", e);
        }
      }
      
      await storage.deleteSmsSetupGuideStep(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete SMS setup guide step:", error);
      res.status(500).json({ error: "가이드 단계 삭제에 실패했습니다" });
    }
  });

  // Get SOLAPI signup URL (public)
  app.get("/api/sms-settings/signup-url", async (req, res) => {
    try {
      const url = await storage.getSystemSetting("solapiSignupUrl");
      res.json({ url: url || "https://console.solapi.com/signup" });
    } catch (error) {
      console.error("Failed to get SOLAPI signup URL:", error);
      res.status(500).json({ error: "설정을 불러오는데 실패했습니다" });
    }
  });

  // Set SOLAPI signup URL (admin only)
  app.put("/api/sms-settings/signup-url", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      
      if (!userId) {
        return res.status(400).json({ error: "사용자 정보가 필요합니다" });
      }
      
      const user = await storage.getUser(userId);
      if (!user || user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 접근할 수 있습니다" });
      }
      
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: "URL이 필요합니다" });
      }
      
      await storage.setSystemSetting("solapiSignupUrl", url);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to set SOLAPI signup URL:", error);
      res.status(500).json({ error: "설정 저장에 실패했습니다" });
    }
  });

  // Get API creation guide settings (public)
  app.get("/api/sms-settings/api-creation-guide", async (req, res) => {
    try {
      const url = await storage.getSystemSetting("solapiApiCreationUrl");
      const imageUrlsJson = await storage.getSystemSetting("solapiApiCreationImageUrls");
      const description = await storage.getSystemSetting("solapiApiCreationDescription");
      
      // Parse imageUrls from JSON, fallback to legacy single image
      let imageUrls: string[] = [];
      if (imageUrlsJson) {
        try {
          imageUrls = JSON.parse(imageUrlsJson);
        } catch {
          imageUrls = [];
        }
      } else {
        // Fallback: check for legacy single image
        const legacyImageUrl = await storage.getSystemSetting("solapiApiCreationImageUrl");
        if (legacyImageUrl) {
          imageUrls = [legacyImageUrl];
        }
      }
      
      res.json({ 
        url: url || "https://console.solapi.com/credentials", 
        imageUrls,
        description: description || null
      });
    } catch (error) {
      console.error("Failed to get API creation guide:", error);
      res.status(500).json({ error: "설정을 불러오는데 실패했습니다" });
    }
  });

  // Multer for API creation guide images (multiple)
  const apiCreationGuideUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
  }).array("images", 10);

  // Get business info URL (public)
  app.get("/api/sms-settings/business-info-url", async (req, res) => {
    try {
      const url = await storage.getSystemSetting("solapiBusinessInfoUrl");
      res.json({ url: url || "https://console.solapi.com/business" });
    } catch (error) {
      console.error("Failed to get business info URL:", error);
      res.status(500).json({ error: "설정을 불러오는데 실패했습니다" });
    }
  });

  // Set business info URL (admin only)
  app.put("/api/sms-settings/business-info-url", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) return res.status(400).json({ error: "사용자 정보가 필요합니다" });
      
      const user = await storage.getUser(userId);
      if (!user || user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 접근할 수 있습니다" });
      }
      
      const { url } = req.body;
      if (url) {
        await storage.setSystemSetting("solapiBusinessInfoUrl", url);
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to set business info URL:", error);
      res.status(500).json({ error: "설정 저장에 실패했습니다" });
    }
  });

  // Get sender number setup URL (public)
  app.get("/api/sms-settings/sender-number-url", async (req, res) => {
    try {
      const url = await storage.getSystemSetting("solapiSenderNumberUrl");
      res.json({ url: url || "https://console.solapi.com/senderids" });
    } catch (error) {
      console.error("Failed to get sender number URL:", error);
      res.status(500).json({ error: "설정을 불러오는데 실패했습니다" });
    }
  });

  // Set sender number setup URL (admin only)
  app.put("/api/sms-settings/sender-number-url", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) return res.status(400).json({ error: "사용자 정보가 필요합니다" });
      
      const user = await storage.getUser(userId);
      if (!user || user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 접근할 수 있습니다" });
      }
      
      const { url } = req.body;
      if (url) {
        await storage.setSystemSetting("solapiSenderNumberUrl", url);
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to set sender number URL:", error);
      res.status(500).json({ error: "설정 저장에 실패했습니다" });
    }
  });

  // Get credentials input guide settings (public)
  app.get("/api/sms-settings/credentials-guide", async (req, res) => {
    try {
      const url = await storage.getSystemSetting("solapiCredentialsUrl");
      const imageUrlsJson = await storage.getSystemSetting("solapiCredentialsImageUrls");
      const description = await storage.getSystemSetting("solapiCredentialsDescription");
      
      // Parse imageUrls from JSON, fallback to legacy single image
      let imageUrls: string[] = [];
      if (imageUrlsJson) {
        try {
          imageUrls = JSON.parse(imageUrlsJson);
        } catch {
          imageUrls = [];
        }
      } else {
        // Fallback: check for legacy single image
        const legacyImageUrl = await storage.getSystemSetting("solapiCredentialsImageUrl");
        if (legacyImageUrl) {
          imageUrls = [legacyImageUrl];
        }
      }
      
      res.json({ 
        url: url || "https://console.solapi.com/credentials", 
        imageUrls,
        description: description || null
      });
    } catch (error) {
      console.error("Failed to get credentials guide:", error);
      res.status(500).json({ error: "설정을 불러오는데 실패했습니다" });
    }
  });

  // Multer for credentials guide images (multiple)
  const credentialsGuideUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
  }).array("images", 10);

  // Set credentials input guide settings (admin only)
  app.put("/api/sms-settings/credentials-guide", credentialsGuideUpload, async (req, res) => {
    try {
      const userId = req.query.userId as string;
      
      if (!userId) {
        return res.status(400).json({ error: "사용자 정보가 필요합니다" });
      }
      
      const user = await storage.getUser(userId);
      if (!user || user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 접근할 수 있습니다" });
      }
      
      const { url, description } = req.body;
      
      if (url) {
        await storage.setSystemSetting("solapiCredentialsUrl", url);
      }
      if (description !== undefined) {
        await storage.setSystemSetting("solapiCredentialsDescription", description || "");
      }

      // Handle multiple image uploads to R2
      const files = req.files as Express.Multer.File[];
      if (files && files.length > 0 && isR2Configured()) {
        // Get existing image URLs
        const existingUrlsJson = await storage.getSystemSetting("solapiCredentialsImageUrls");
        let existingUrls: string[] = [];
        if (existingUrlsJson) {
          try {
            existingUrls = JSON.parse(existingUrlsJson);
          } catch {
            existingUrls = [];
          }
        }
        
        // Upload new images
        const newUrls: string[] = [];
        for (const file of files) {
          const key = `sms-settings/credentials-guide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${file.originalname.split('.').pop()}`;
          const imageUrl = await uploadBuffer(file.buffer, key, file.mimetype);
          newUrls.push(imageUrl);
        }
        
        // Combine with existing URLs
        const allUrls = [...existingUrls, ...newUrls];
        await storage.setSystemSetting("solapiCredentialsImageUrls", JSON.stringify(allUrls));
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to set credentials guide:", error);
      res.status(500).json({ error: "설정 저장에 실패했습니다" });
    }
  });

  // Delete a single credentials guide image (admin only)
  app.delete("/api/sms-settings/credentials-guide/image", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      const imageUrl = req.query.imageUrl as string;
      
      if (!userId) {
        return res.status(400).json({ error: "사용자 정보가 필요합니다" });
      }
      
      if (!imageUrl) {
        return res.status(400).json({ error: "이미지 URL이 필요합니다" });
      }
      
      const user = await storage.getUser(userId);
      if (!user || user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 접근할 수 있습니다" });
      }
      
      // Get existing image URLs
      const existingUrlsJson = await storage.getSystemSetting("solapiCredentialsImageUrls");
      let existingUrls: string[] = [];
      if (existingUrlsJson) {
        try {
          existingUrls = JSON.parse(existingUrlsJson);
        } catch {
          existingUrls = [];
        }
      }
      
      // Remove the image from the list
      const updatedUrls = existingUrls.filter(url => url !== imageUrl);
      
      // Delete from R2
      if (isR2Configured()) {
        const r2PublicUrl = process.env.R2_PUBLIC_URL || '';
        const key = imageUrl.replace(`${r2PublicUrl}/`, '');
        try {
          await deleteObject(key);
        } catch (e) {
          console.error("Failed to delete credentials guide image from R2:", e);
        }
      }
      
      // Save updated list
      await storage.setSystemSetting("solapiCredentialsImageUrls", JSON.stringify(updatedUrls));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete credentials guide image:", error);
      res.status(500).json({ error: "이미지 삭제에 실패했습니다" });
    }
  });

  // Set API creation guide settings (admin only)
  app.put("/api/sms-settings/api-creation-guide", apiCreationGuideUpload, async (req, res) => {
    try {
      const userId = req.query.userId as string;
      
      if (!userId) {
        return res.status(400).json({ error: "사용자 정보가 필요합니다" });
      }
      
      const user = await storage.getUser(userId);
      if (!user || user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 접근할 수 있습니다" });
      }
      
      const { url, description } = req.body;
      
      if (url) {
        await storage.setSystemSetting("solapiApiCreationUrl", url);
      }
      if (description !== undefined) {
        await storage.setSystemSetting("solapiApiCreationDescription", description || "");
      }

      // Handle multiple image uploads to R2
      const files = req.files as Express.Multer.File[];
      if (files && files.length > 0 && isR2Configured()) {
        // Get existing image URLs
        const existingUrlsJson = await storage.getSystemSetting("solapiApiCreationImageUrls");
        let existingUrls: string[] = [];
        if (existingUrlsJson) {
          try {
            existingUrls = JSON.parse(existingUrlsJson);
          } catch {
            existingUrls = [];
          }
        }
        
        // Upload new images
        const newUrls: string[] = [];
        for (const file of files) {
          const key = `sms-settings/api-creation-guide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${file.originalname.split('.').pop()}`;
          const imageUrl = await uploadBuffer(file.buffer, key, file.mimetype);
          newUrls.push(imageUrl);
        }
        
        // Combine with existing URLs
        const allUrls = [...existingUrls, ...newUrls];
        await storage.setSystemSetting("solapiApiCreationImageUrls", JSON.stringify(allUrls));
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to set API creation guide:", error);
      res.status(500).json({ error: "설정 저장에 실패했습니다" });
    }
  });

  // Delete a single API creation guide image (admin only)
  app.delete("/api/sms-settings/api-creation-guide/image", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      const imageUrl = req.query.imageUrl as string;
      
      if (!userId) {
        return res.status(400).json({ error: "사용자 정보가 필요합니다" });
      }
      
      if (!imageUrl) {
        return res.status(400).json({ error: "이미지 URL이 필요합니다" });
      }
      
      const user = await storage.getUser(userId);
      if (!user || user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 접근할 수 있습니다" });
      }
      
      // Get existing image URLs
      const existingUrlsJson = await storage.getSystemSetting("solapiApiCreationImageUrls");
      let existingUrls: string[] = [];
      if (existingUrlsJson) {
        try {
          existingUrls = JSON.parse(existingUrlsJson);
        } catch {
          existingUrls = [];
        }
      }
      
      // Remove the image from the list
      const updatedUrls = existingUrls.filter(url => url !== imageUrl);
      
      // Delete from R2
      if (isR2Configured()) {
        const r2PublicUrl = process.env.R2_PUBLIC_URL || '';
        const key = imageUrl.replace(`${r2PublicUrl}/`, '');
        try {
          await deleteObject(key);
        } catch (e) {
          console.error("Failed to delete API creation guide image from R2:", e);
        }
      }
      
      // Save updated list
      await storage.setSystemSetting("solapiApiCreationImageUrls", JSON.stringify(updatedUrls));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete API creation guide image:", error);
      res.status(500).json({ error: "이미지 삭제에 실패했습니다" });
    }
  });

  // Test SMS endpoint for principals
  app.post("/api/sms-settings/test-sms", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      const centerId = req.query.centerId as string;
      
      if (!userId || !centerId) {
        return res.status(400).json({ error: "사용자 및 센터 정보가 필요합니다" });
      }
      
      const user = await storage.getUser(userId);
      if (!user || (user.role !== UserRole.PRINCIPAL && user.role !== UserRole.ADMIN)) {
        return res.status(403).json({ error: "원장 또는 관리자만 테스트할 수 있습니다" });
      }
      
      // Get user's phone number
      const userPhone = user.phone;
      if (!userPhone) {
        return res.status(400).json({ error: "핸드폰 번호가 등록되지 않았습니다. 계정 설정에서 핸드폰 번호를 등록해주세요." });
      }
      
      // Send test SMS
      const center = await storage.getCenter(centerId);
      const result = await sendSms({
        to: userPhone,
        text: "[이음위더스] 문자 연결 완료 되었습니다.",
        centerName: center?.name,
        centerId,
      });
      
      if (result.success) {
        res.json({ success: true, message: "테스트 문자가 발송되었습니다" });
      } else {
        res.status(400).json({ error: result.error || "문자 발송에 실패했습니다" });
      }
    } catch (error) {
      console.error("Failed to send test SMS:", error);
      res.status(500).json({ error: "문자 발송 중 오류가 발생했습니다" });
    }
  });

  // Send test SMS with custom recipient (for testing after connection complete)
  app.post("/api/sms-settings/send-test-sms", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      const centerId = req.query.centerId as string;
      const { recipientPhone, message } = req.body;
      
      if (!userId || !centerId) {
        return res.status(400).json({ error: "사용자 및 센터 정보가 필요합니다" });
      }
      
      if (!recipientPhone) {
        return res.status(400).json({ error: "수신자 번호가 필요합니다" });
      }
      
      const user = await storage.getUser(userId);
      if (!user || (user.role !== UserRole.PRINCIPAL && user.role !== UserRole.ADMIN)) {
        return res.status(403).json({ error: "원장 또는 관리자만 테스트할 수 있습니다" });
      }
      
      // Send test SMS to custom recipient
      const center = await storage.getCenter(centerId);
      const result = await sendSms({
        to: recipientPhone,
        text: message || "문자 연결이 완료되었습니다. [이음위더스]",
        centerName: center?.name,
        centerId,
      });
      
      if (result.success) {
        res.json({ success: true, message: "테스트 문자가 발송되었습니다" });
      } else {
        res.status(400).json({ error: result.error || "문자 발송에 실패했습니다" });
      }
    } catch (error) {
      console.error("Failed to send test SMS:", error);
      res.status(500).json({ error: "문자 발송 중 오류가 발생했습니다" });
    }
  });

  // ============ Student Cumulative Data (학생 누적데이터) ============
  
  // Get monthly cumulative data for a student (2 years)
  app.get("/api/student-cumulative-data/:studentId", async (req, res) => {
    try {
      const { studentId } = req.params;
      const centerId = req.query.centerId as string;
      
      if (!centerId) {
        return res.status(400).json({ error: "센터 정보가 필요합니다" });
      }
      
      // Calculate date range (2 years from now)
      const now = new Date();
      const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), 1);
      const startDate = format(twoYearsAgo, "yyyy-MM-dd");
      const endDate = format(now, "yyyy-MM-dd");
      
      // Get all assessments for the student in date range
      const assessmentResults = await db.execute(sql`
        SELECT 
          TO_CHAR(assessment_date, 'YYYY-MM') as month,
          AVG(CAST(score AS FLOAT) / CAST(max_score AS FLOAT) * 100) as avg_score
        FROM assessments
        WHERE student_id = ${studentId}
          AND assessment_date >= ${startDate}::date
          AND assessment_date <= ${endDate}::date
        GROUP BY TO_CHAR(assessment_date, 'YYYY-MM')
        ORDER BY month
      `);
      
      // Get homework completion rates
      const homeworkResults = await db.execute(sql`
        SELECT 
          TO_CHAR(h.due_date, 'YYYY-MM') as month,
          AVG(COALESCE(hs.completion_rate, 0)) as avg_completion
        FROM homework h
        LEFT JOIN homework_submissions hs ON h.id = hs.homework_id AND hs.student_id = ${studentId}
        WHERE h.due_date >= ${startDate}::date
          AND h.due_date <= ${endDate}::date
          AND (h.student_id IS NULL OR h.student_id = ${studentId})
        GROUP BY TO_CHAR(h.due_date, 'YYYY-MM')
        ORDER BY month
      `);
      
      // Get attendance late ratio
      const attendanceResults = await db.execute(sql`
        SELECT 
          TO_CHAR(check_in_date, 'YYYY-MM') as month,
          COUNT(*) as total_count,
          SUM(CASE WHEN was_late = true OR attendance_status = 'late' THEN 1 ELSE 0 END) as late_count
        FROM attendance_records
        WHERE student_id = ${studentId}
          AND center_id = ${centerId}
          AND check_in_date >= ${startDate}::date
          AND check_in_date <= ${endDate}::date
        GROUP BY TO_CHAR(check_in_date, 'YYYY-MM')
        ORDER BY month
      `);
      
      // Process results into monthly data
      const monthlyData: Record<string, { assessment: number | null; homework: number | null; lateRatio: number | null }> = {};
      
      // Generate all months in range
      const current = new Date(twoYearsAgo);
      while (current <= now) {
        const monthKey = format(current, "yyyy-MM");
        monthlyData[monthKey] = { assessment: null, homework: null, lateRatio: null };
        current.setMonth(current.getMonth() + 1);
      }
      
      // Fill in assessment data
      for (const row of assessmentResults as any[]) {
        if (monthlyData[row.month]) {
          monthlyData[row.month].assessment = Math.round(parseFloat(row.avg_score) * 10) / 10;
        }
      }
      
      // Fill in homework data
      for (const row of homeworkResults as any[]) {
        if (monthlyData[row.month]) {
          monthlyData[row.month].homework = Math.round(parseFloat(row.avg_completion) * 10) / 10;
        }
      }
      
      // Fill in attendance data
      for (const row of attendanceResults as any[]) {
        if (monthlyData[row.month]) {
          const total = parseInt(row.total_count);
          const late = parseInt(row.late_count);
          monthlyData[row.month].lateRatio = total > 0 ? Math.round((late / total) * 1000) / 10 : 0;
        }
      }
      
      // Convert to array format for frontend
      const data = Object.entries(monthlyData).map(([month, values]) => ({
        month,
        ...values
      }));
      
      res.json(data);
    } catch (error) {
      console.error("Failed to get student cumulative data:", error);
      res.status(500).json({ error: "누적 데이터 조회에 실패했습니다" });
    }
  });
  
  // Get cumulative data for multiple students (for teacher/principal view)
  app.get("/api/cumulative-data/by-class/:classId", async (req, res) => {
    try {
      const { classId } = req.params;
      const centerId = req.query.centerId as string;
      
      if (!centerId) {
        return res.status(400).json({ error: "센터 정보가 필요합니다" });
      }
      
      // Get all students enrolled in this class
      const classEnrollments = await storage.getClassEnrollments(classId);
      const studentIds = classEnrollments.map(e => e.studentId);
      
      if (studentIds.length === 0) {
        return res.json([]);
      }
      
      const now = new Date();
      const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), 1);
      const startDate = format(twoYearsAgo, "yyyy-MM-dd");
      const endDate = format(now, "yyyy-MM-dd");
      
      // Get student info
      const students = await Promise.all(studentIds.map(id => storage.getUser(id)));
      const validStudents = students.filter(Boolean) as User[];
      
      // Get aggregated data per student
      const result = await Promise.all(validStudents.map(async (student) => {
        // Assessment average (last 2 years)
        const assessmentRes = await db.execute(sql`
          SELECT AVG(CAST(score AS FLOAT) / CAST(max_score AS FLOAT) * 100) as avg_score
          FROM assessments
          WHERE student_id = ${student.id}
            AND assessment_date >= ${startDate}::date
        `);
        
        // Homework completion average
        const homeworkRes = await db.execute(sql`
          SELECT AVG(COALESCE(hs.completion_rate, 0)) as avg_completion
          FROM homework h
          LEFT JOIN homework_submissions hs ON h.id = hs.homework_id AND hs.student_id = ${student.id}
          WHERE h.due_date >= ${startDate}::date
            AND (h.student_id IS NULL OR h.student_id = ${student.id})
        `);
        
        // Late ratio
        const attendanceRes = await db.execute(sql`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN was_late = true OR attendance_status = 'late' THEN 1 ELSE 0 END) as late
          FROM attendance_records
          WHERE student_id = ${student.id}
            AND center_id = ${centerId}
            AND check_in_date >= ${startDate}::date
        `);
        
        const assessmentRow = (assessmentRes as any[])[0];
        const homeworkRow = (homeworkRes as any[])[0];
        const attendanceRow = (attendanceRes as any[])[0];
        
        const total = attendanceRow?.total ? parseInt(attendanceRow.total) : 0;
        const late = attendanceRow?.late ? parseInt(attendanceRow.late) : 0;
        
        return {
          studentId: student.id,
          studentName: student.name,
          grade: student.grade,
          avgAssessment: assessmentRow?.avg_score ? Math.round(parseFloat(assessmentRow.avg_score) * 10) / 10 : null,
          avgHomework: homeworkRow?.avg_completion ? Math.round(parseFloat(homeworkRow.avg_completion) * 10) / 10 : null,
          lateRatio: total > 0 ? Math.round((late / total) * 1000) / 10 : 0,
          attendanceCount: total
        };
      }));
      
      res.json(result);
    } catch (error) {
      console.error("Failed to get class cumulative data:", error);
      res.status(500).json({ error: "반별 누적 데이터 조회에 실패했습니다" });
    }
  });
  
  // Get all students' cumulative data for a teacher
  app.get("/api/cumulative-data/by-teacher/:teacherId", async (req, res) => {
    try {
      const { teacherId } = req.params;
      const centerId = req.query.centerId as string;
      
      if (!centerId) {
        return res.status(400).json({ error: "센터 정보가 필요합니다" });
      }
      
      // Get all classes taught by this teacher
      const allClasses = await storage.getClasses(centerId);
      const teacherClasses = allClasses.filter(c => c.teacherId === teacherId);
      
      if (teacherClasses.length === 0) {
        return res.json({ classes: [], students: [] });
      }
      
      // Get unique students from all classes
      const studentSet = new Set<string>();
      const classStudentMap: Record<string, string[]> = {};
      
      for (const cls of teacherClasses) {
        const enrollments = await storage.getClassEnrollments(cls.id);
        classStudentMap[cls.id] = enrollments.map(e => e.studentId);
        enrollments.forEach(e => studentSet.add(e.studentId));
      }
      
      const studentIds = Array.from(studentSet);
      
      const now = new Date();
      const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), 1);
      const startDate = format(twoYearsAgo, "yyyy-MM-dd");
      
      // Get student info and data
      const students = await Promise.all(studentIds.map(id => storage.getUser(id)));
      const validStudents = students.filter(Boolean) as User[];
      
      const studentData = await Promise.all(validStudents.map(async (student) => {
        const assessmentRes = await db.execute(sql`
          SELECT AVG(CAST(score AS FLOAT) / CAST(max_score AS FLOAT) * 100) as avg_score
          FROM assessments
          WHERE student_id = ${student.id}
            AND assessment_date >= ${startDate}::date
        `);
        
        const homeworkRes = await db.execute(sql`
          SELECT AVG(COALESCE(hs.completion_rate, 0)) as avg_completion
          FROM homework h
          LEFT JOIN homework_submissions hs ON h.id = hs.homework_id AND hs.student_id = ${student.id}
          WHERE h.due_date >= ${startDate}::date
            AND (h.student_id IS NULL OR h.student_id = ${student.id})
        `);
        
        const attendanceRes = await db.execute(sql`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN was_late = true OR attendance_status = 'late' THEN 1 ELSE 0 END) as late
          FROM attendance_records
          WHERE student_id = ${student.id}
            AND center_id = ${centerId}
            AND check_in_date >= ${startDate}::date
        `);
        
        const assessmentRow = (assessmentRes as any[])[0];
        const homeworkRow = (homeworkRes as any[])[0];
        const attendanceRow = (attendanceRes as any[])[0];
        
        const total = attendanceRow?.total ? parseInt(attendanceRow.total) : 0;
        const late = attendanceRow?.late ? parseInt(attendanceRow.late) : 0;
        
        // Find which classes this student belongs to
        const studentClasses = Object.entries(classStudentMap)
          .filter(([_, ids]) => ids.includes(student.id))
          .map(([classId]) => classId);
        
        return {
          studentId: student.id,
          studentName: student.name,
          grade: student.grade,
          classIds: studentClasses,
          avgAssessment: assessmentRow?.avg_score ? Math.round(parseFloat(assessmentRow.avg_score) * 10) / 10 : null,
          avgHomework: homeworkRow?.avg_completion ? Math.round(parseFloat(homeworkRow.avg_completion) * 10) / 10 : null,
          lateRatio: total > 0 ? Math.round((late / total) * 1000) / 10 : 0,
          attendanceCount: total
        };
      }));
      
      res.json({
        classes: teacherClasses.map(c => ({ id: c.id, name: c.name, subject: c.subject })),
        students: studentData
      });
    } catch (error) {
      console.error("Failed to get teacher cumulative data:", error);
      res.status(500).json({ error: "선생님 학생 데이터 조회에 실패했습니다" });
    }
  });
  
  // Get all students' cumulative data for a center (Principal/Admin view)
  app.get("/api/cumulative-data/by-center/:centerId", async (req, res) => {
    try {
      const { centerId } = req.params;
      
      if (!centerId) {
        return res.status(400).json({ error: "센터 정보가 필요합니다" });
      }
      
      // Get all students in this center
      const allUsers = await storage.getUsers(centerId);
      const studentUsers = allUsers.filter(u => u.role === 1); // UserRole.STUDENT = 1
      
      if (studentUsers.length === 0) {
        return res.json([]);
      }
      
      const now = new Date();
      const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), 1);
      const startDate = format(twoYearsAgo, "yyyy-MM-dd");
      
      // Get aggregated data per student
      const studentData = await Promise.all(studentUsers.map(async (student) => {
        const assessmentRes = await db.execute(sql`
          SELECT AVG(CAST(score AS FLOAT) / CAST(max_score AS FLOAT) * 100) as avg_score
          FROM assessments
          WHERE student_id = ${student.id}
            AND assessment_date >= ${startDate}::date
        `);
        
        const homeworkRes = await db.execute(sql`
          SELECT AVG(COALESCE(hs.completion_rate, 0)) as avg_completion
          FROM homework h
          LEFT JOIN homework_submissions hs ON h.id = hs.homework_id AND hs.student_id = ${student.id}
          WHERE h.due_date >= ${startDate}::date
            AND (h.student_id IS NULL OR h.student_id = ${student.id})
        `);
        
        const attendanceRes = await db.execute(sql`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN was_late = true OR attendance_status = 'late' THEN 1 ELSE 0 END) as late
          FROM attendance_records
          WHERE student_id = ${student.id}
            AND center_id = ${centerId}
            AND check_in_date >= ${startDate}::date
        `);
        
        const assessmentRow = (assessmentRes as any[])[0];
        const homeworkRow = (homeworkRes as any[])[0];
        const attendanceRow = (attendanceRes as any[])[0];
        
        const total = attendanceRow?.total ? parseInt(attendanceRow.total) : 0;
        const late = attendanceRow?.late ? parseInt(attendanceRow.late) : 0;
        
        return {
          studentId: student.id,
          studentName: student.name,
          grade: student.grade,
          avgAssessment: assessmentRow?.avg_score ? Math.round(parseFloat(assessmentRow.avg_score) * 10) / 10 : null,
          avgHomework: homeworkRow?.avg_completion ? Math.round(parseFloat(homeworkRow.avg_completion) * 10) / 10 : null,
          lateRatio: total > 0 ? Math.round((late / total) * 1000) / 10 : 0,
          attendanceCount: total
        };
      }));
      
      res.json(studentData);
    } catch (error) {
      console.error("Failed to get center cumulative data:", error);
      res.status(500).json({ error: "센터 누적 데이터 조회에 실패했습니다" });
    }
  });

  // Install guide image settings
  const installGuideImageKeys = [
    "install_guide_step1_browser",
    "install_guide_step2_menu",
    "install_guide_step4_iphone_share",
    "install_guide_step5_iphone_add",
    "install_guide_step4_galaxy_menu",
    "install_guide_step5_galaxy_add",
  ];

  // Get all install guide images
  app.get("/api/install-guide/images", async (_req, res) => {
    try {
      const settings = await db.execute(sql`
        SELECT key, value, updated_at FROM system_settings 
        WHERE key IN (
          'install_guide_step1_browser',
          'install_guide_step2_menu',
          'install_guide_step4_iphone_share',
          'install_guide_step5_iphone_add',
          'install_guide_step4_galaxy_menu',
          'install_guide_step5_galaxy_add'
        )
      `);
      
      const images: Record<string, string> = {};
      for (const row of settings as any[]) {
        const shortKey = row.key.replace("install_guide_", "");
        let imageUrl = row.value;
        
        // Convert R2 URL to proxy URL with cache busting
        if (imageUrl && typeof imageUrl === 'string') {
          // Convert R2 direct URL to proxy URL
          const r2Match = imageUrl.match(/https?:\/\/pub-[^\/]+\.r2\.dev\/(.+)/);
          if (r2Match) {
            const objectPath = r2Match[1];
            const version = row.updated_at ? new Date(row.updated_at).getTime() : Date.now();
            imageUrl = `/api/r2-proxy/${objectPath}?v=${version}`;
          }
        }
        
        images[shortKey] = imageUrl;
      }
      
      res.json(images);
    } catch (error) {
      console.error("Failed to get install guide images:", error);
      res.status(500).json({ error: "설치 가이드 이미지를 불러오는데 실패했습니다" });
    }
  });

  // Update install guide image (Admin only)
  app.post("/api/install-guide/images", async (req, res) => {
    try {
      const { key, url, actorId } = req.body;
      console.log("[InstallGuide] Saving image:", { key, url: url?.substring(0, 50), actorId });
      
      if (!actorId) {
        console.log("[InstallGuide] No actorId provided");
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      if (!user || user.role !== UserRole.ADMIN) {
        console.log("[InstallGuide] Not admin:", user?.role);
        return res.status(403).json({ error: "관리자만 설정할 수 있습니다" });
      }
      const fullKey = `install_guide_${key}`;
      
      if (!installGuideImageKeys.includes(fullKey)) {
        console.log("[InstallGuide] Invalid key:", fullKey);
        return res.status(400).json({ error: "잘못된 키입니다" });
      }

      await db.execute(sql`
        INSERT INTO system_settings (key, value, updated_at)
        VALUES (${fullKey}, ${url}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = ${url}, updated_at = NOW()
      `);

      console.log("[InstallGuide] Image saved successfully:", fullKey);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to update install guide image:", error);
      res.status(500).json({ error: "설치 가이드 이미지 저장에 실패했습니다" });
    }
  });

  // Get R2 upload URL for install guide images (kept for backward compatibility)
  app.get("/api/install-guide/upload-url", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      if (!user || user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 업로드할 수 있습니다" });
      }

      if (!isR2Configured()) {
        return res.status(500).json({ error: "R2 스토리지가 설정되지 않았습니다" });
      }

      const result = await getUploadUrl("image/png", "install-guide");
      res.json(result);
    } catch (error) {
      console.error("Failed to get upload URL:", error);
      res.status(500).json({ error: "업로드 URL 생성에 실패했습니다" });
    }
  });

  // Server-side upload endpoint for install guide images (uses Cloudflare R2)
  const installGuideUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('이미지 파일만 업로드 가능합니다') as any, false);
      }
    },
  });

  app.post("/api/install-guide/upload", installGuideUpload.single("file"), async (req, res) => {
    try {
      const actorId = req.body.actorId || req.query.actorId;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      if (!user || user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 업로드할 수 있습니다" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "파일이 없습니다" });
      }

      if (!isR2Configured()) {
        return res.status(500).json({ error: "R2 스토리지가 설정되지 않았습니다. R2 환경변수를 확인해주세요." });
      }

      const ext = req.file.originalname.split('.').pop() || 'png';
      const objectKey = `install-guide/${randomUUID()}.${ext}`;
      const publicUrl = await uploadBuffer(
        req.file.buffer,
        objectKey,
        req.file.mimetype
      );

      res.json({ publicUrl, objectKey });
    } catch (error: any) {
      console.error("Failed to upload install guide image:", error);
      // Provide more detailed error message
      const errorMessage = error?.Code === 'Unauthorized' 
        ? "R2 인증 실패. R2 API 키를 확인해주세요."
        : "이미지 업로드에 실패했습니다";
      res.status(500).json({ error: errorMessage });
    }
  });

  // ==================== Bug Reports (오류 제보) ====================
  
  // Get all bug reports (Admin only)
  app.get("/api/bug-reports", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      if (!user || user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 조회할 수 있습니다" });
      }

      const reports = await db.select().from(bugReports).orderBy(desc(bugReports.createdAt));
      
      // Enrich with reporter and center info
      const enrichedReports = await Promise.all(reports.map(async (report) => {
        const reporter = await storage.getUser(report.reporterId);
        const center = await storage.getCenter(report.centerId);
        return {
          ...report,
          reporterName: reporter?.name || "알 수 없음",
          centerName: center?.name || "알 수 없음",
        };
      }));
      
      res.json(enrichedReports);
    } catch (error) {
      console.error("Failed to get bug reports:", error);
      res.status(500).json({ error: "오류 제보 목록을 불러오는데 실패했습니다" });
    }
  });

  // Get bug reports by center (Principal)
  app.get("/api/bug-reports/center/:centerId", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.PRINCIPAL)) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }

      // For principals, verify they belong to this center
      if (user.role === UserRole.PRINCIPAL) {
        const userCenterLinks = await db.select().from(userCenters)
          .where(eq(userCenters.userId, actorId));
        const userCenterIds = userCenterLinks.map(uc => uc.centerId);
        if (!userCenterIds.includes(req.params.centerId)) {
          return res.status(403).json({ error: "해당 센터에 대한 권한이 없습니다" });
        }
      }

      const reports = await db.select().from(bugReports)
        .where(eq(bugReports.centerId, req.params.centerId))
        .orderBy(desc(bugReports.createdAt));
      
      res.json(reports);
    } catch (error) {
      console.error("Failed to get bug reports by center:", error);
      res.status(500).json({ error: "오류 제보 목록을 불러오는데 실패했습니다" });
    }
  });

  // Create bug report (Principal)
  app.post("/api/bug-reports", async (req, res) => {
    try {
      const { centerId, title, description } = req.body;
      const actorId = req.body.reporterId || req.query.actorId as string;
      
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      if (!user || user.role !== UserRole.PRINCIPAL) {
        return res.status(403).json({ error: "원장만 오류를 제보할 수 있습니다" });
      }
      
      // Verify the principal belongs to this center
      const userCenterLinks = await db.select().from(userCenters)
        .where(eq(userCenters.userId, actorId));
      const userCenterIds = userCenterLinks.map(uc => uc.centerId);
      if (!userCenterIds.includes(centerId)) {
        return res.status(403).json({ error: "해당 센터에 대한 권한이 없습니다" });
      }
      
      if (!title || !description) {
        return res.status(400).json({ error: "제목과 설명을 입력해주세요" });
      }

      const [report] = await db.insert(bugReports).values({
        centerId,
        reporterId: actorId, // Use actorId instead of body reporterId
        title,
        description,
        status: "pending",
      }).returning();
      
      res.json(report);
    } catch (error) {
      console.error("Failed to create bug report:", error);
      res.status(500).json({ error: "오류 제보에 실패했습니다" });
    }
  });

  // Update bug report status (Admin only - mark as resolved)
  app.patch("/api/bug-reports/:id", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      if (!user || user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 수정할 수 있습니다" });
      }

      const { status, adminNote } = req.body;
      
      const updateData: any = {
        updatedAt: new Date(),
      };
      
      if (status !== undefined) {
        updateData.status = status;
        if (status === "resolved") {
          updateData.resolvedAt = new Date();
          updateData.resolvedBy = actorId;
        } else {
          updateData.resolvedAt = null;
          updateData.resolvedBy = null;
        }
      }
      
      if (adminNote !== undefined) {
        updateData.adminNote = adminNote;
      }

      const [report] = await db.update(bugReports)
        .set(updateData)
        .where(eq(bugReports.id, req.params.id))
        .returning();
      
      if (!report) {
        return res.status(404).json({ error: "오류 제보를 찾을 수 없습니다" });
      }
      
      res.json(report);
    } catch (error) {
      console.error("Failed to update bug report:", error);
      res.status(500).json({ error: "오류 제보 수정에 실패했습니다" });
    }
  });

  // Delete bug report (Admin only)
  app.delete("/api/bug-reports/:id", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) {
        return res.status(401).json({ error: "인증이 필요합니다" });
      }
      const user = await storage.getUser(actorId);
      if (!user || user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "관리자만 삭제할 수 있습니다" });
      }

      await db.delete(bugReports).where(eq(bugReports.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete bug report:", error);
      res.status(500).json({ error: "오류 제보 삭제에 실패했습니다" });
    }
  });

  // ========== SEMESTER ANNOUNCEMENTS (새 학기 수업 안내) ==========

  app.get("/api/semester-announcements", async (req, res) => {
    try {
      const centerId = req.query.centerId as string;
      const actorId = req.query.actorId as string;
      if (!centerId) return res.status(400).json({ error: "centerId is required" });
      
      let announcements = await storage.getSemesterAnnouncements(centerId);
      
      if (actorId && actorId !== "undefined" && actorId !== "null") {
        const user = await storage.getUser(actorId);
        if (!user || user.role < UserRole.TEACHER) {
          announcements = announcements.filter(a => a.status === "published");
        }
      } else {
        announcements = announcements.filter(a => a.status === "published");
      }
      
      res.json(announcements);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get announcements", details: error?.message });
    }
  });

  app.get("/api/semester-announcements/:id", async (req, res) => {
    try {
      const announcement = await storage.getSemesterAnnouncement(req.params.id);
      if (!announcement) return res.status(404).json({ error: "Announcement not found" });
      
      const actorId = req.query.actorId as string;
      if (actorId) {
        const user = await storage.getUser(actorId);
        if (user && user.role < UserRole.TEACHER && announcement.status !== "published") {
          return res.status(403).json({ error: "접근 권한이 없습니다" });
        }
      } else if (announcement.status !== "published") {
        return res.status(403).json({ error: "접근 권한이 없습니다" });
      }
      
      res.json(announcement);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get announcement", details: error?.message });
    }
  });

  app.post("/api/semester-announcements", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const user = await storage.getUser(actorId as string);
      if (!user || user.role < UserRole.TEACHER) return res.status(403).json({ error: "권한이 없습니다" });
      const announcement = await storage.createSemesterAnnouncement({ ...req.body, createdById: actorId as string });
      res.json(announcement);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create announcement", details: error?.message });
    }
  });

  app.patch("/api/semester-announcements/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const user = await storage.getUser(actorId as string);
      if (!user || user.role < UserRole.TEACHER) return res.status(403).json({ error: "권한이 없습니다" });
      
      const updateData: any = { ...req.body };
      if (req.body.status === "published") {
        updateData.publishedAt = new Date();
      }
      const announcement = await storage.updateSemesterAnnouncement(req.params.id, updateData);
      res.json(announcement);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update announcement", details: error?.message });
    }
  });

  app.delete("/api/semester-announcements/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const user = await storage.getUser(actorId as string);
      if (!user || user.role < UserRole.TEACHER) return res.status(403).json({ error: "권한이 없습니다" });
      await storage.deleteSemesterAnnouncement(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete announcement", details: error?.message });
    }
  });

  // Semester Announcement Classes
  app.get("/api/semester-announcements/:announcementId/classes", async (req, res) => {
    try {
      const classes = await storage.getSemesterAnnouncementClasses(req.params.announcementId);
      res.json(classes);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get classes", details: error?.message });
    }
  });

  app.post("/api/semester-announcements/:announcementId/classes", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const user = await storage.getUser(actorId as string);
      if (!user || user.role < UserRole.TEACHER) return res.status(403).json({ error: "권한이 없습니다" });
      const cls = await storage.createSemesterAnnouncementClass({ ...req.body, announcementId: req.params.announcementId });
      res.json(cls);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create class", details: error?.message });
    }
  });

  app.post("/api/semester-announcements/:announcementId/import-current-classes", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const user = await storage.getUser(actorId as string);
      if (!user || user.role < UserRole.TEACHER) return res.status(403).json({ error: "권한이 없습니다" });
      const announcement = await storage.getSemesterAnnouncement(req.params.announcementId);
      if (!announcement) return res.status(404).json({ error: "안내를 찾을 수 없습니다" });
      const actorCenters = await storage.getUserCenters(actorId as string);
      if (!actorCenters.some((c) => c.id === announcement.centerId)) {
        return res.status(403).json({ error: "해당 센터에 대한 권한이 없습니다" });
      }
      const result = await storage.importCurrentClassesToAnnouncement(
        req.params.announcementId,
        announcement.centerId,
        actorId as string,
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to import current classes", details: error?.message });
    }
  });

  app.patch("/api/semester-announcement-classes/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const user = await storage.getUser(actorId as string);
      if (!user || user.role < UserRole.TEACHER) return res.status(403).json({ error: "권한이 없습니다" });
      const cls = await storage.updateSemesterAnnouncementClass(req.params.id, req.body);
      res.json(cls);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update class", details: error?.message });
    }
  });

  app.delete("/api/semester-announcement-classes/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const user = await storage.getUser(actorId as string);
      if (!user || user.role < UserRole.TEACHER) return res.status(403).json({ error: "권한이 없습니다" });
      await storage.deleteSemesterAnnouncementClass(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete class", details: error?.message });
    }
  });

  // Semester Recommendations
  app.get("/api/semester-announcements/:announcementId/recommendations", async (req, res) => {
    try {
      const studentId = req.query.studentId as string | undefined;
      const recommendations = await storage.getSemesterRecommendations(req.params.announcementId, studentId);
      res.json(recommendations);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get recommendations", details: error?.message });
    }
  });

  app.post("/api/semester-announcements/:announcementId/recommendations", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const user = await storage.getUser(actorId as string);
      if (!user || user.role < UserRole.TEACHER) return res.status(403).json({ error: "권한이 없습니다" });
      const rec = await storage.createSemesterRecommendation({ ...req.body, announcementId: req.params.announcementId, assignedById: actorId as string });
      res.json(rec);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create recommendation", details: error?.message });
    }
  });

  app.patch("/api/semester-recommendations/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const user = await storage.getUser(actorId as string);
      if (!user || user.role < UserRole.TEACHER) return res.status(403).json({ error: "권한이 없습니다" });
      const result = await storage.updateSemesterRecommendation(req.params.id, req.body);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update recommendation", details: error?.message });
    }
  });

  app.delete("/api/semester-recommendations/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const user = await storage.getUser(actorId as string);
      if (!user || user.role < UserRole.TEACHER) return res.status(403).json({ error: "권한이 없습니다" });
      await storage.deleteSemesterRecommendation(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete recommendation", details: error?.message });
    }
  });

  // Bulk recommendations (한 번에 여러 학생에게 추천 수업 배정)
  app.post("/api/semester-announcements/:announcementId/recommendations/bulk", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const user = await storage.getUser(actorId as string);
      if (!user || user.role < UserRole.TEACHER) return res.status(403).json({ error: "권한이 없습니다" });
      
      const { studentIds, announcementClassId, notes } = req.body;
      if (!Array.isArray(studentIds) || !announcementClassId) {
        return res.status(400).json({ error: "studentIds and announcementClassId are required" });
      }
      
      const results = await storage.createSemesterRecommendationsBulk(
        studentIds.map((studentId: string) => ({
          announcementId: req.params.announcementId,
          announcementClassId,
          studentId,
          assignedById: actorId as string,
          notes: notes || null,
        }))
      );
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create bulk recommendations", details: error?.message });
    }
  });

  // Semester Applications (학생 수업 신청 - 의사표시이며 실제 등록/출결에는 영향 없음)
  app.get("/api/semester-announcements/:announcementId/applications", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const user = await storage.getUser(actorId as string);
      if (!user) return res.status(401).json({ error: "인증이 필요합니다" });

      const announcement = await storage.getSemesterAnnouncement(req.params.announcementId);
      if (!announcement) return res.status(404).json({ error: "안내를 찾을 수 없습니다" });

      // 센터 경계 검증
      const actorCenters = await storage.getUserCenters(actorId as string);
      if (!actorCenters.some((c) => c.id === announcement.centerId)) {
        return res.status(403).json({ error: "해당 센터에 대한 권한이 없습니다" });
      }

      // 직원(role>=TEACHER)은 전체 조회, 학생/학부모는 본인(연결 자녀) 신청만 조회
      if (user.role >= UserRole.TEACHER) {
        const applications = await storage.getSemesterApplications(req.params.announcementId);
        return res.json(applications);
      }

      let allowedStudentId: string | undefined;
      if (user.role === UserRole.STUDENT) {
        allowedStudentId = user.id;
      } else if (user.role === UserRole.PARENT) {
        const requested = req.query.studentId as string | undefined;
        if (requested && user.linkedStudentIds?.includes(requested)) {
          allowedStudentId = requested;
        } else {
          allowedStudentId = user.linkedStudentIds?.[0];
        }
        if (!allowedStudentId) return res.json([]);
      } else {
        return res.status(403).json({ error: "권한이 없습니다" });
      }

      const applications = await storage.getSemesterApplications(req.params.announcementId, allowedStudentId);
      res.json(applications);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get applications", details: error?.message });
    }
  });

  app.post("/api/semester-announcements/:announcementId/applications", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const user = await storage.getUser(actorId as string);
      if (!user) return res.status(401).json({ error: "인증이 필요합니다" });

      const announcement = await storage.getSemesterAnnouncement(req.params.announcementId);
      if (!announcement) return res.status(404).json({ error: "안내를 찾을 수 없습니다" });

      // 센터 경계 검증 - actor가 해당 안내의 센터 소속이어야 함
      const actorCenters = await storage.getUserCenters(actorId as string);
      if (!actorCenters.some((c) => c.id === announcement.centerId)) {
        return res.status(403).json({ error: "해당 센터에 대한 권한이 없습니다" });
      }

      const { announcementClassId, studentId } = req.body;
      if (!announcementClassId || !studentId) {
        return res.status(400).json({ error: "announcementClassId and studentId are required" });
      }

      // 본인(또는 학부모의 연결 학생)만 신청 가능. 직원은 대리 신청 가능.
      if (user.role === UserRole.STUDENT) {
        if (studentId !== user.id) return res.status(403).json({ error: "본인 신청만 가능합니다" });
      } else if (user.role === UserRole.PARENT) {
        if (!user.linkedStudentIds?.includes(studentId)) {
          return res.status(403).json({ error: "연결된 자녀만 신청 가능합니다" });
        }
      } else if (user.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }

      // 해당 수업이 이 안내에 속하는지 검증
      const annClasses = await storage.getSemesterAnnouncementClasses(req.params.announcementId);
      if (!annClasses.some((c) => c.id === announcementClassId)) {
        return res.status(400).json({ error: "해당 안내의 수업이 아닙니다" });
      }

      // 멱등: 이미 신청한 경우 기존 신청을 반환
      const existing = await storage.getSemesterApplicationByKey(announcementClassId, studentId);
      if (existing) return res.json(existing);

      const application = await storage.createSemesterApplication({
        announcementId: req.params.announcementId,
        announcementClassId,
        studentId,
      });
      res.json(application);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create application", details: error?.message });
    }
  });

  app.delete("/api/semester-applications/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const user = await storage.getUser(actorId as string);
      if (!user) return res.status(401).json({ error: "인증이 필요합니다" });

      const application = await storage.getSemesterApplication(req.params.id);
      if (!application) return res.status(404).json({ error: "신청을 찾을 수 없습니다" });

      const announcement = await storage.getSemesterAnnouncement(application.announcementId);
      if (!announcement) return res.status(404).json({ error: "안내를 찾을 수 없습니다" });

      // 센터 경계 검증
      const actorCenters = await storage.getUserCenters(actorId as string);
      if (!actorCenters.some((c) => c.id === announcement.centerId)) {
        return res.status(403).json({ error: "해당 센터에 대한 권한이 없습니다" });
      }

      // 본인(또는 학부모의 연결 학생)만 취소 가능. 직원은 대리 취소 가능.
      if (user.role === UserRole.STUDENT) {
        if (application.studentId !== user.id) return res.status(403).json({ error: "본인 신청만 취소할 수 있습니다" });
      } else if (user.role === UserRole.PARENT) {
        if (!user.linkedStudentIds?.includes(application.studentId)) {
          return res.status(403).json({ error: "연결된 자녀의 신청만 취소할 수 있습니다" });
        }
      } else if (user.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }

      await storage.deleteSemesterApplication(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete application", details: error?.message });
    }
  });

  app.get("/api/tuition-sms-template/:centerId", async (req, res) => {
    try {
      const key = `tuition_sms_template_${req.params.centerId}`;
      const result = await db.execute(sql`SELECT value FROM system_settings WHERE key = ${key}`);
      const rows = (result as any).rows || (Array.isArray(result) ? result : []);
      const row = rows[0];
      res.json({ template: row ? row.value : null });
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.put("/api/tuition-sms-template/:centerId", async (req, res) => {
    try {
      const key = `tuition_sms_template_${req.params.centerId}`;
      const { template } = req.body;
      if (template === null || template === "") {
        await db.execute(sql`DELETE FROM system_settings WHERE key = ${key}`);
      } else {
        await db.execute(sql`
          INSERT INTO system_settings (key, value, updated_at)
          VALUES (${key}, ${template}, NOW())
          ON CONFLICT (key) DO UPDATE SET value = ${template}, updated_at = NOW()
        `);
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.get("/api/supplementary-classes", async (req, res) => {
    try {
      const { centerId, startDate, endDate, teacherId, actorId } = req.query;
      if (!centerId || !startDate || !endDate) {
        return res.status(400).json({ error: "centerId, startDate, endDate are required" });
      }
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.TEACHER) return res.status(403).json({ error: "권한이 없습니다" });
      const classes = await storage.getSupplementaryClasses(
        centerId as string,
        startDate as string,
        endDate as string,
        teacherId as string | undefined
      );
      const results = await Promise.all(classes.map(async (cls) => {
        const teacher = await storage.getUser(cls.teacherId);
        const students = await storage.getSupplementaryStudents(cls.id);
        return { ...cls, teacher: teacher || null, studentCount: students.length };
      }));
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get supplementary classes", details: error?.message });
    }
  });

  app.get("/api/supplementary-classes/student/:studentId", async (req, res) => {
    try {
      const { studentId } = req.params;
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate, endDate are required" });
      }
      const entries = await storage.getSupplementaryStudentsByStudent(
        studentId,
        startDate as string,
        endDate as string
      );
      const results = await Promise.all(entries.map(async (entry) => {
        const teacher = await storage.getUser(entry.supplementaryClass.teacherId);
        return { ...entry, teacher: teacher || null };
      }));
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get student supplementary classes", details: error?.message });
    }
  });

  app.get("/api/supplementary-classes/:id", async (req, res) => {
    try {
      const cls = await storage.getSupplementaryClass(req.params.id);
      if (!cls) return res.status(404).json({ error: "Supplementary class not found" });
      const students = await storage.getSupplementaryStudents(cls.id);
      const studentsWithInfo = await Promise.all(students.map(async (s) => {
        const user = await storage.getUser(s.studentId);
        return { ...s, student: user || null };
      }));
      res.json({ ...cls, students: studentsWithInfo });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get supplementary class", details: error?.message });
    }
  });

  app.post("/api/supplementary-classes", async (req, res) => {
    try {
      const { studentIds, actorId, ...classData } = req.body;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.TEACHER) return res.status(403).json({ error: "권한이 없습니다" });
      const created = await storage.createSupplementaryClass(classData);
      if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
        await storage.addSupplementaryStudents(created.id, studentIds);
      }
      res.json(created);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create supplementary class", details: error?.message });
    }
  });

  app.patch("/api/supplementary-classes/:id", async (req, res) => {
    try {
      const { studentIds, actorId, ...updateData } = req.body;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.TEACHER) return res.status(403).json({ error: "권한이 없습니다" });
      const updated = await storage.updateSupplementaryClass(req.params.id, updateData);
      if (studentIds && Array.isArray(studentIds)) {
        const existing = await storage.getSupplementaryStudents(req.params.id);
        for (const s of existing) {
          await storage.removeSupplementaryStudent(s.id);
        }
        if (studentIds.length > 0) {
          await storage.addSupplementaryStudents(req.params.id, studentIds);
        }
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update supplementary class", details: error?.message });
    }
  });

  app.delete("/api/supplementary-classes/:id", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.TEACHER) return res.status(403).json({ error: "권한이 없습니다" });
      await storage.deleteSupplementaryClass(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete supplementary class", details: error?.message });
    }
  });

  app.post("/api/supplementary-classes/:id/students", async (req, res) => {
    try {
      const { studentIds, actorId } = req.body;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.TEACHER) return res.status(403).json({ error: "권한이 없습니다" });
      if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({ error: "studentIds array is required" });
      }
      const result = await storage.addSupplementaryStudents(req.params.id, studentIds);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to add students", details: error?.message });
    }
  });

  app.delete("/api/supplementary-classes/:id/students/:studentId", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.TEACHER) return res.status(403).json({ error: "권한이 없습니다" });
      const { id, studentId } = req.params;
      const students = await storage.getSupplementaryStudents(id);
      const target = students.find(s => s.studentId === studentId);
      if (!target) return res.status(404).json({ error: "Student not found in this class" });
      await storage.removeSupplementaryStudent(target.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to remove student", details: error?.message });
    }
  });

  app.post("/api/supplementary-classes/:id/send-sms", async (req, res) => {
    const reqId = `SUP-SMS-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const { actorId } = req.body;
      console.log(`[${reqId}] 진입 classId=${req.params.id}, actorId=${actorId}`);
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const actor = await storage.getUser(actorId as string);
      if (!actor || actor.role < UserRole.TEACHER) {
        console.log(`[${reqId}] 권한 없음 actorRole=${actor?.role}`);
        return res.status(403).json({ error: "권한이 없습니다" });
      }
      const cls = await storage.getSupplementaryClass(req.params.id);
      if (!cls) {
        console.log(`[${reqId}] 보충수업 not found id=${req.params.id}`);
        return res.status(404).json({ error: "Supplementary class not found" });
      }

      const center = await storage.getCenter(cls.centerId);
      if (!center) {
        console.log(`[${reqId}] 센터 not found centerId=${cls.centerId}`);
        return res.status(404).json({ error: "Center not found" });
      }

      const centerName = center.name;
      const smsMode = (center as any).smsMode || "default";
      console.log(`[${reqId}] 센터 정보 centerId=${cls.centerId}, centerName="${centerName}", smsMode=${smsMode}`);
      if (smsMode === "credit") {
        const creditSender = (center as any).creditSenderNumber;
        console.log(`[${reqId}] 크레딧 모드 - creditSenderNumber=${creditSender ? creditSender.slice(0, 3) + "****" : "(없음)"}`);
        if (!creditSender) {
          console.log(`[${reqId}] 크레딧 모드 발신번호 미설정으로 중단`);
          return res.status(400).json({ error: "발신번호가 설정되지 않았습니다. 설정에서 발신번호를 등록해주세요." });
        }
      } else {
        const configured = await isSolapiConfigured(centerName);
        console.log(`[${reqId}] isSolapiConfigured(centerName="${centerName}") = ${configured}`);
        if (!configured) {
          console.log(`[${reqId}] SOLAPI 미설정으로 중단`);
          return res.status(400).json({ error: "이 센터의 문자 발송 설정이 등록되지 않았습니다. 설정 → 문자 발송에서 등록해주세요." });
        }
      }

      const { studentIds: targetStudentIds, message: customMessage } = req.body;
      let students = await storage.getSupplementaryStudents(cls.id);
      const totalCount = students.length;
      if (targetStudentIds && Array.isArray(targetStudentIds) && targetStudentIds.length > 0) {
        const targetSet = new Set(targetStudentIds);
        students = students.filter(s => targetSet.has(s.studentId));
      }
      console.log(`[${reqId}] 발송 대상 학생 수=${students.length} (전체 ${totalCount}명 중), customMessage=${!!customMessage}`);

      const reasonText = cls.reason && cls.reason !== "직접입력" ? cls.reason : (cls.customReason || "보충수업");

      const results: { studentId: string; success: boolean; error?: string }[] = [];

      for (let i = 0; i < students.length; i++) {
        const supStudent = students[i];
        const idx = `${i + 1}/${students.length}`;
        const student = await storage.getUser(supStudent.studentId);
        if (!student) {
          console.log(`[${reqId}] [${idx}] 학생 not found studentId=${supStudent.studentId}`);
          results.push({ studentId: supStudent.studentId, success: false, error: "Student not found" });
          continue;
        }

        const parentPhone = student.motherPhone || student.fatherPhone || student.phone;
        const phoneSrc = student.motherPhone ? "mother" : student.fatherPhone ? "father" : student.phone ? "self" : "none";
        if (!parentPhone) {
          console.log(`[${reqId}] [${idx}] 전화번호 없음 student=${student.name}(${student.id}), motherPhone=${!!student.motherPhone}, fatherPhone=${!!student.fatherPhone}, phone=${!!student.phone}`);
          results.push({ studentId: supStudent.studentId, success: false, error: "No parent phone number" });
          continue;
        }

        let smsText = customMessage;
        if (!smsText) {
          const template = center.supplementarySmsTemplate;
          if (template) {
            smsText = template
              .replace(/\{학원명\}/g, centerName)
              .replace(/\{학생명\}/g, student.name)
              .replace(/\{날짜\}/g, cls.date)
              .replace(/\{시작시간\}/g, cls.startTime)
              .replace(/\{종료시간\}/g, cls.endTime || "미정")
              .replace(/\{강의실\}/g, cls.classroom || "")
              .replace(/\{사유\}/g, reasonText)
              .replace(/\{선생님\}/g, (await storage.getUser(cls.teacherId))?.name || "");
          } else {
            const classroomInfo = cls.classroom ? `\n강의실: ${cls.classroom}` : "";
            smsText = `[${centerName}] 보충수업 안내\n학생: ${student.name}\n날짜: ${cls.date}\n시간: ${cls.startTime}~${cls.endTime || "미정"}${classroomInfo}\n사유: ${reasonText}`;
          }
        }

        const phoneMasked = parentPhone.length >= 7 ? `${parentPhone.slice(0, 3)}****${parentPhone.slice(-4)}` : "****";
        const textBytes = Buffer.byteLength(smsText, "utf-8");
        console.log(`[${reqId}] [${idx}] 발송 시도 student=${student.name}(${student.id}), phone=${phoneMasked}(${phoneSrc}), textBytes=${textBytes}`);

        let smsResult: { success: boolean; error?: string };
        try {
          smsResult = await sendSms({ to: parentPhone, text: smsText, centerName, centerId: cls.centerId });
        } catch (sendErr: any) {
          console.error(`[${reqId}] [${idx}] sendSms throw 발생 student=${student.name}(${student.id}): ${sendErr?.message || sendErr}`);
          smsResult = { success: false, error: sendErr?.message || "sendSms 예외" };
        }
        console.log(`[${reqId}] [${idx}] 발송 결과 success=${smsResult.success}${smsResult.error ? `, error="${smsResult.error}"` : ""}`);
        results.push({ studentId: supStudent.studentId, success: smsResult.success, error: smsResult.error });

        if (smsResult.success) {
          try {
            await storage.updateSupplementaryStudent(supStudent.id, { smsSent: true });
          } catch (updErr: any) {
            console.error(`[${reqId}] [${idx}] smsSent 업데이트 실패: ${updErr?.message || updErr}`);
          }
        }

        const recipientType = parentPhone === student.motherPhone ? "mother" : parentPhone === student.fatherPhone ? "father" : "student";
        try {
          await storage.createSmsHistory({
            centerId: cls.centerId,
            sentBy: actorId as string,
            studentId: supStudent.studentId,
            recipientPhone: parentPhone,
            recipientType,
            message: smsText,
            status: smsResult.success ? "sent" : "failed",
            category: "supplementary",
            referenceId: cls.id,
          });
        } catch (histErr: any) {
          console.error(`[${reqId}] [${idx}] SMS 이력 저장 실패: ${histErr?.message || histErr}`);
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;
      console.log(`[${reqId}] 완료 총 ${results.length}건 (성공=${successCount}, 실패=${failCount})`);
      if (failCount > 0) {
        const failSummary = results.filter(r => !r.success).map(r => `${r.studentId}:${r.error || "?"}`).join(" | ");
        console.log(`[${reqId}] 실패 상세: ${failSummary}`);
      }

      res.json({ results });
    } catch (error: any) {
      console.error(`[${reqId}] 핸들러 예외: ${error?.message || error}`, error?.stack);
      res.status(500).json({ error: "Failed to send SMS", details: error?.message });
    }
  });

  app.get("/api/supplementary-classes/:id/sms-history", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.TEACHER) return res.status(403).json({ error: "권한이 없습니다" });

      const records = await storage.getSmsHistoryByReference(req.params.id);
      const enriched = await Promise.all(records.map(async (r) => {
        const student = await storage.getUser(r.studentId);
        const sender = await storage.getUser(r.sentBy);
        return {
          ...r,
          studentName: student?.name || "알 수 없음",
          senderName: sender?.name || "알 수 없음",
        };
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Failed to get SMS history:", error);
      res.status(500).json({ error: "문자 내역을 불러올 수 없습니다" });
    }
  });

  app.get("/api/centers/:centerId/supplementary-sms-templates", async (req, res) => {
    try {
      const center = await storage.getCenter(req.params.centerId);
      if (!center) return res.status(404).json({ error: "Center not found" });
      res.json({
        smsTemplate: center.supplementarySmsTemplate || "",
        reminderSmsTemplate: center.supplementaryReminderSmsTemplate || "",
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get templates", details: error?.message });
    }
  });

  app.patch("/api/centers/:centerId/supplementary-sms-templates", async (req, res) => {
    try {
      const { actorId, smsTemplate, reminderSmsTemplate } = req.body;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.TEACHER) return res.status(403).json({ error: "권한이 없습니다" });
      await storage.updateCenter(req.params.centerId, {
        supplementarySmsTemplate: smsTemplate || null,
        supplementaryReminderSmsTemplate: reminderSmsTemplate || null,
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to save templates", details: error?.message });
    }
  });

  // ==================== Daily Notice SMS Template ====================
  app.get("/api/centers/:centerId/daily-notice-sms-template", async (req, res) => {
    try {
      const center = await storage.getCenter(req.params.centerId);
      if (!center) return res.status(404).json({ error: "Center not found" });
      res.json({ smsTemplate: center.dailyNoticeSmsTemplate || "" });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get template", details: error?.message });
    }
  });

  app.patch("/api/centers/:centerId/daily-notice-sms-template", async (req, res) => {
    try {
      const { actorId, smsTemplate } = req.body;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.TEACHER) return res.status(403).json({ error: "권한이 없습니다" });
      await storage.updateCenter(req.params.centerId, {
        dailyNoticeSmsTemplate: smsTemplate || null,
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to save template", details: error?.message });
    }
  });

  app.get("/api/centers/:centerId/teacher-student-tuition", async (req, res) => {
    try {
      const { actorId } = req.query;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const actor = await storage.getUser(actorId as string);
      if (!actor) return res.status(403).json({ error: "권한이 없습니다" });
      
      const centerId = req.params.centerId;
      const center = await storage.getCenter(centerId);
      if (!center || !center.tuitionVisibleToTeachers) {
        return res.json([]);
      }

      const allClasses = await storage.getClasses();
      const centerClasses = allClasses.filter((c: any) => c.centerId === centerId);
      const activeClasses = centerClasses.filter((c: any) => !c.isArchived);
      const teacherClasses = activeClasses.filter((c: any) => c.teacherId === actorId || isAssistantTeacher(c, actorId));
      
      if (teacherClasses.length === 0) return res.json([]);

      const studentIds = new Set<string>();
      for (const cls of teacherClasses) {
        const classEnrollments = await storage.getClassEnrollments(cls.id);
        classEnrollments.forEach((e: any) => studentIds.add(e.studentId));
      }

      const classMap = new Map(activeClasses.map((c: any) => [c.id, c]));

      // 학생별 가장 최근 발송된 청구서(draft 제외)를 미리 모아서 sentAmount/textbookTotal 우선 사용
      const allCenterNotifs = await storage.getTuitionNotifications(centerId);
      const latestNotifByStudent = new Map<string, any>();
      for (const n of allCenterNotifs) {
        if (n.status === "draft") continue;
        if (n.sentAmount == null) continue;
        const prev = latestNotifByStudent.get(n.studentId);
        const nTime = n.createdAt ? new Date(n.createdAt as any).getTime() : 0;
        const prevTime = prev?.createdAt ? new Date(prev.createdAt as any).getTime() : 0;
        if (!prev || nTime > prevTime) latestNotifByStudent.set(n.studentId, n);
      }

      const result = await Promise.all(Array.from(studentIds).map(async (studentId) => {
        const student = await storage.getUser(studentId);
        if (!student) return null;

        const studentEnrollments = await storage.getStudentEnrollments(studentId);
        const enrolledClasses = studentEnrollments
          .map((e: any) => classMap.get(e.classId))
          .filter(Boolean);

        if (enrolledClasses.length === 0) return null;

        const sorted = [...enrolledClasses].sort((a: any, b: any) => (b.baseFee || 0) - (a.baseFee || 0));
        const tuitionFee = sorted.reduce((sum: number, cls: any, idx: number) => {
          return sum + (idx === 0 ? (cls.baseFee || 0) : (cls.additionalFee || 0));
        }, 0);

        const textbookPurchases = await storage.getStudentTextbookPurchases(studentId, centerId);
        const textbookFee = textbookPurchases.reduce((sum: number, p: any) => sum + (p.price || 0), 0);

        const hasDiscount = student.discountRate != null && student.discountRate > 0;
        const dRate = hasDiscount ? student.discountRate! : 0;
        const dTarget = student.discountTarget || "both";

        let discountedTuition: number;
        let discountedTextbook: number;
        const latestNotif = latestNotifByStudent.get(studentId);
        if (latestNotif) {
          // 청구서가 발송된 경우: 청구된 금액(sentAmount/textbookTotal)이 실제 청구된 교육비
          discountedTuition = latestNotif.sentAmount || 0;
          discountedTextbook = latestNotif.textbookTotal || 0;
        } else {
          const effectiveTuition = student.customTuitionAmount != null ? student.customTuitionAmount : tuitionFee;
          discountedTuition = (dTarget === "tuition" || dTarget === "both") ? Math.round(effectiveTuition * (1 - dRate / 100)) : effectiveTuition;
          discountedTextbook = (dTarget === "textbook" || dTarget === "both") ? Math.round(textbookFee * (1 - dRate / 100)) : textbookFee;
        }

        const teacherClassIds = new Set(teacherClasses.map((tc: any) => tc.id));
        const teacherClassNames = studentEnrollments
          .filter((e: any) => teacherClassIds.has(e.classId))
          .map((e: any) => {
            const cls = classMap.get(e.classId);
            return cls ? `${cls.name} ${cls.subject || ""}`.trim() : "";
          })
          .filter(Boolean);

        return {
          studentId: student.id,
          studentName: student.name,
          grade: student.grade,
          tuitionFee: discountedTuition,
          textbookFee: discountedTextbook,
          totalTuition: discountedTuition + discountedTextbook,
          enrolledClassCount: enrolledClasses.length,
          teacherClassNames,
        };
      }));

      res.json(result.filter(Boolean));
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get teacher student tuition", details: error?.message });
    }
  });

  app.get("/api/centers/:centerId/teacher-search-students", async (req, res) => {
    try {
      const { actorId, query } = req.query;
      if (!actorId || !query) return res.status(400).json({ error: "필수 정보가 누락되었습니다" });

      const actor = await storage.getUser(actorId as string);
      if (!actor || (actor.role !== UserRole.TEACHER && actor.role !== UserRole.CLINIC_TEACHER)) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }

      const centerId = req.params.centerId;
      const center = await storage.getCenter(centerId);
      if (!center || !center.tuitionVisibleToTeachers) {
        return res.status(403).json({ error: "교육비 공개가 비활성화되어 있습니다" });
      }

      const allStudents = await storage.getCenterUsers(centerId, UserRole.STUDENT);
      const students = allStudents.filter((u: any) => u.name.includes(query as string));

      const allClasses = await storage.getClasses();
      const classMap = new Map(allClasses.filter((c: any) => c.centerId === centerId && !c.isArchived).map((c: any) => [c.id, c]));

      // 학생별 가장 최근 발송된 청구서(draft 제외)
      const allCenterNotifs = await storage.getTuitionNotifications(centerId);
      const latestNotifByStudent = new Map<string, any>();
      for (const n of allCenterNotifs) {
        if (n.status === "draft") continue;
        if (n.sentAmount == null) continue;
        const prev = latestNotifByStudent.get(n.studentId);
        const nTime = n.createdAt ? new Date(n.createdAt as any).getTime() : 0;
        const prevTime = prev?.createdAt ? new Date(prev.createdAt as any).getTime() : 0;
        if (!prev || nTime > prevTime) latestNotifByStudent.set(n.studentId, n);
      }

      const results = await Promise.all(students.map(async (student: any) => {
        const enrollments = await storage.getStudentEnrollments(student.id);
        const enrolledClasses = enrollments.map((e: any) => classMap.get(e.classId)).filter(Boolean);
        const sorted = [...enrolledClasses].sort((a: any, b: any) => (b.baseFee || 0) - (a.baseFee || 0));
        const tuitionFee = sorted.reduce((sum: number, cls: any, idx: number) => sum + (idx === 0 ? (cls.baseFee || 0) : (cls.additionalFee || 0)), 0);
        const textbookPurchases = await storage.getStudentTextbookPurchases(student.id, centerId);
        const textbookFee = textbookPurchases.reduce((sum: number, p: any) => sum + (p.price || 0), 0);
        const hasDiscount = student.discountRate != null && student.discountRate > 0;
        const dRate = hasDiscount ? student.discountRate! : 0;
        const dTarget = student.discountTarget || "both";

        let discountedTuition: number;
        let discountedTextbook: number;
        const latestNotif = latestNotifByStudent.get(student.id);
        if (latestNotif) {
          discountedTuition = latestNotif.sentAmount || 0;
          discountedTextbook = latestNotif.textbookTotal || 0;
        } else {
          const effectiveTuition = student.customTuitionAmount != null ? student.customTuitionAmount : tuitionFee;
          discountedTuition = (dTarget === "tuition" || dTarget === "both") ? Math.round(effectiveTuition * (1 - dRate / 100)) : effectiveTuition;
          discountedTextbook = (dTarget === "textbook" || dTarget === "both") ? Math.round(textbookFee * (1 - dRate / 100)) : textbookFee;
        }

        return {
          studentId: student.id,
          studentName: student.name,
          grade: student.grade,
          tuitionFee: discountedTuition,
          textbookFee: discountedTextbook,
          totalTuition: discountedTuition + discountedTextbook,
        };
      }));

      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to search students", details: error?.message });
    }
  });

  app.get("/api/centers/:centerId/teacher-student-notifications", async (req, res) => {
    try {
      const { actorId, studentId } = req.query;
      if (!actorId || !studentId) return res.status(400).json({ error: "필수 정보가 누락되었습니다" });
      
      const actor = await storage.getUser(actorId as string);
      if (!actor || (actor.role !== UserRole.TEACHER && actor.role !== UserRole.CLINIC_TEACHER)) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }
      
      const centerId = req.params.centerId;
      const center = await storage.getCenter(centerId);
      if (!center || !center.tuitionVisibleToTeachers) {
        return res.status(403).json({ error: "교육비 공개가 비활성화되어 있습니다" });
      }

      const allNotifications = await storage.getTuitionNotifications(centerId);
      // Exclude drafts: they are saved message text only, not actual sent notifications
      const studentNotifications = allNotifications.filter((n: any) => n.studentId === studentId && n.status !== "draft");
      res.json(studentNotifications);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get student notifications", details: error?.message });
    }
  });

  app.patch("/api/centers/:centerId/tuition-visible-to-teachers", async (req, res) => {
    try {
      const { actorId, visible } = req.body;
      if (!actorId) return res.status(401).json({ error: "인증이 필요합니다" });
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.PRINCIPAL) return res.status(403).json({ error: "권한이 없습니다" });
      await storage.updateCenter(req.params.centerId, {
        tuitionVisibleToTeachers: !!visible,
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update setting", details: error?.message });
    }
  });

  // ==================== Counseling Records ====================
  app.get("/api/counseling-records", async (req, res) => {
    try {
      const { centerId, studentId } = req.query;
      if (!centerId) return res.json([]);
      const allRecords = await db.select().from(counselingRecords).where(eq(counselingRecords.centerId, centerId as string));
      let filtered = allRecords;
      if (studentId) {
        filtered = filtered.filter(r => r.studentId === studentId);
      }
      filtered.sort((a, b) => new Date(b.counselingDate).getTime() - new Date(a.counselingDate).getTime());
      res.json(filtered);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get counseling records", details: error?.message });
    }
  });

  app.post("/api/counseling-records", async (req, res) => {
    try {
      const { centerId, studentId, teacherId, counselingDate, content } = req.body;
      if (!centerId || !studentId || !teacherId || !counselingDate || !content) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const [record] = await db.insert(counselingRecords).values({
        centerId,
        studentId,
        teacherId,
        counselingDate,
        content,
      }).returning();
      res.json(record);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create counseling record", details: error?.message });
    }
  });

  app.patch("/api/counseling-records/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { counselingDate, content } = req.body;
      const updates: any = { updatedAt: new Date() };
      if (counselingDate) updates.counselingDate = counselingDate;
      if (content !== undefined) updates.content = content;
      const [record] = await db.update(counselingRecords).set(updates).where(eq(counselingRecords.id, id)).returning();
      if (!record) return res.status(404).json({ error: "Record not found" });
      res.json(record);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update counseling record", details: error?.message });
    }
  });

  app.delete("/api/counseling-records/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(counselingRecords).where(eq(counselingRecords.id, id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete counseling record", details: error?.message });
    }
  });

  // ============================================================
  // New Consultations (신규상담) API
  // ============================================================
  app.get("/api/new-consultations", async (req, res) => {
    try {
      const { centerId } = req.query;
      if (!centerId) return res.json([]);
      const records = await db.select().from(newConsultations)
        .where(eq(newConsultations.centerId, centerId as string));
      records.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
      res.json(records);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get new consultations", details: error?.message });
    }
  });

  app.post("/api/new-consultations", async (req, res) => {
    try {
      const { centerId, studentName, gender, school, grade, targetSchool, studentPhone, parentPhone, availableDays, scores, counselingContent, createdBy } = req.body;
      if (!centerId || !studentName?.trim()) {
        return res.status(400).json({ error: "센터와 학생 이름은 필수입니다" });
      }
      const [record] = await db.insert(newConsultations).values({
        centerId,
        studentName: studentName.trim(),
        gender: gender || null,
        school: school || null,
        grade: grade || null,
        targetSchool: targetSchool || null,
        studentPhone: studentPhone || null,
        parentPhone: parentPhone || null,
        availableDays: availableDays || null,
        scores: scores || null,
        counselingContent: counselingContent || null,
        createdBy: createdBy || null,
      }).returning();
      res.json(record);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create new consultation", details: error?.message });
    }
  });

  app.patch("/api/new-consultations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const allowed = ["studentName", "gender", "school", "grade", "targetSchool", "studentPhone", "parentPhone", "availableDays", "scores", "counselingContent"] as const;
      const updates: any = { updatedAt: new Date() };
      for (const key of allowed) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
      }
      if (updates.studentName !== undefined && !String(updates.studentName).trim()) {
        return res.status(400).json({ error: "학생 이름은 필수입니다" });
      }
      const [record] = await db.update(newConsultations).set(updates).where(eq(newConsultations.id, id)).returning();
      if (!record) return res.status(404).json({ error: "상담 기록을 찾을 수 없습니다" });
      res.json(record);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update new consultation", details: error?.message });
    }
  });

  app.delete("/api/new-consultations/:id", async (req, res) => {
    try {
      await db.delete(newConsultations).where(eq(newConsultations.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete new consultation", details: error?.message });
    }
  });

  // ============================================================
  // Grade Trend (종합성적추이) API
  // ============================================================
  app.get("/api/grade-trend/:studentId", async (req, res) => {
    try {
      const { studentId } = req.params;
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const centerId = req.query.centerId as string;

      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }

      const allClasses = await storage.getClasses(centerId);
      const classIds = allClasses.filter(c => !c.isArchived).map(c => c.id);

      const studentAssessments = await db.select().from(assessments)
        .where(eq(assessments.studentId, studentId));

      const filtered = studentAssessments.filter(a => {
        const d = new Date(a.assessmentDate);
        return d.getFullYear() === year && classIds.includes(a.classId);
      });

      const calcGrowthIndex = async (targetAssessments: typeof filtered, periodKey: string) => {
        if (targetAssessments.length === 0) return null;

        const classGrouped = new Map<string, typeof targetAssessments>();
        for (const a of targetAssessments) {
          if (!classGrouped.has(a.classId)) classGrouped.set(a.classId, []);
          classGrouped.get(a.classId)!.push(a);
        }

        const classGrowthIndices: number[] = [];
        for (const [classId, studentScores] of classGrouped) {
          const studentAvg = studentScores.reduce((s, a) => s + a.score, 0) / studentScores.length;
          const allClassAssessments = await db.select().from(assessments)
            .where(eq(assessments.classId, classId));
          const classPeriodAssessments = allClassAssessments.filter(a => a.assessmentDate.startsWith(periodKey));
          if (classPeriodAssessments.length === 0) continue;
          const classAvg = classPeriodAssessments.reduce((s, a) => s + a.score, 0) / classPeriodAssessments.length;
          if (classAvg > 0) {
            classGrowthIndices.push(studentAvg / classAvg);
          }
        }

        if (classGrowthIndices.length === 0) return null;
        return Math.round((classGrowthIndices.reduce((s, v) => s + v, 0) / classGrowthIndices.length) * 100) / 100;
      };

      const monthlyData: { month: number; growthIndex: number | null }[] = [];
      for (let m = 1; m <= 12; m++) {
        const monthStr = `${year}-${String(m).padStart(2, "0")}`;
        const monthAssessments = filtered.filter(a => a.assessmentDate.startsWith(monthStr));
        const growthIndex = await calcGrowthIndex(monthAssessments, monthStr);
        monthlyData.push({ month: m, growthIndex });
      }

      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const weeklyData: { week: number; label: string; growthIndex: number | null }[] = [];

      if (year === currentYear) {
        const monthStr = `${year}-${String(currentMonth).padStart(2, "0")}`;
        const monthStart = new Date(year, currentMonth - 1, 1);
        const monthEnd = new Date(year, currentMonth, 0);
        const totalDays = monthEnd.getDate();

        let weekNum = 1;
        let weekStart = 1;
        while (weekStart <= totalDays) {
          const weekEnd = Math.min(weekStart + 6, totalDays);
          const startDate = `${monthStr}-${String(weekStart).padStart(2, "0")}`;
          const endDate = `${monthStr}-${String(weekEnd).padStart(2, "0")}`;

          const weekAssessments = filtered.filter(a => {
            return a.assessmentDate >= startDate && a.assessmentDate <= endDate;
          });

          const growthIndex = await calcGrowthIndex(weekAssessments, monthStr);
          weeklyData.push({
            week: weekNum,
            label: `${weekNum}주차 (${currentMonth}/${weekStart}~${currentMonth}/${weekEnd})`,
            growthIndex,
          });

          weekNum++;
          weekStart = weekEnd + 1;
        }
      }

      res.json({ monthly: monthlyData, weekly: weeklyData, currentMonth });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get grade trend", details: error?.message });
    }
  });

  // ============================================================
  // 숙제 완성도 API (Homework Completion Trend)
  // - 특정 학생의 월별 평균 숙제 완성도(0~100%)를 반환
  // - centerId 기준으로 해당 센터 수업의 숙제만 집계
  // ============================================================
  app.get("/api/homework-completion/:studentId", async (req, res) => {
    try {
      const { studentId } = req.params;
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const centerId = req.query.centerId as string;

      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }

      // 센터의 활성 수업 ID 목록
      const allClasses = await storage.getClasses(centerId);
      const classIds = new Set(allClasses.filter(c => !c.isArchived).map(c => c.id));

      // 해당 연도 + 센터 수업에 해당하는 숙제 필터링
      const allHomework = await db.select().from(homework);
      const yearHomework = allHomework.filter(h => {
        const d = new Date(h.dueDate);
        return d.getFullYear() === year && classIds.has(h.classId);
      });

      const homeworkIds = yearHomework.map(h => h.id);
      if (homeworkIds.length === 0) {
        const emptyData = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, completionRate: null }));
        return res.json(emptyData);
      }

      // 학생의 숙제 제출 기록 조회
      const allSubs = await db.select().from(homeworkSubmissions)
        .where(eq(homeworkSubmissions.studentId, studentId));
      const relevantSubs = allSubs.filter(s => homeworkIds.includes(s.homeworkId));

      // 월별 평균 완성도 계산
      const monthlyData: { month: number; completionRate: number | null }[] = [];
      for (let m = 1; m <= 12; m++) {
        const monthStr = `${year}-${String(m).padStart(2, "0")}`;
        const monthHomeworkIds = yearHomework
          .filter(h => h.dueDate.startsWith(monthStr))
          .map(h => h.id);

        if (monthHomeworkIds.length === 0) {
          monthlyData.push({ month: m, completionRate: null });
          continue;
        }

        const monthSubs = relevantSubs.filter(s => monthHomeworkIds.includes(s.homeworkId));

        if (monthSubs.length === 0) {
          monthlyData.push({ month: m, completionRate: 0 });
          continue;
        }

        const avgRate = Math.round(monthSubs.reduce((sum, s) => sum + (s.completionRate || 0), 0) / monthSubs.length);
        monthlyData.push({ month: m, completionRate: avgRate });
      }

      res.json(monthlyData);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get homework completion", details: error?.message });
    }
  });

  // Get latest homework completion rate for a student (직전 숙제 완성도)
  app.get("/api/homework-completion/:studentId/latest", async (req, res) => {
    try {
      const { studentId } = req.params;
      const centerId = req.query.centerId as string;
      const beforeDate = req.query.beforeDate as string; // yyyy-MM-dd

      if (!centerId) {
        return res.status(400).json({ error: "centerId is required" });
      }

      const allClasses = await storage.getClasses(centerId);
      const classMap = new Map(allClasses.map(c => [c.id, c]));

      // 학생이 실제로 수강 중인 (보관되지 않은) 수업만 대상으로 한다.
      // 그렇지 않으면 학생이 듣지 않는 다른 반의 숙제가 "직전 숙제"로
      // 잡혀 제출 기록이 없어 완성도가 표시되지 않는다.
      const studentEnrollments = await storage.getStudentEnrollments(studentId);
      const enrolledClassIds = new Set(studentEnrollments.map(e => e.classId));
      const classIds = new Set(
        allClasses.filter(c => !c.isArchived && enrolledClassIds.has(c.id)).map(c => c.id)
      );

      // ===== 사진검사 (homework) 직전 완성도 =====
      const allHomework = await db.select().from(homework);
      let photoHw = allHomework.filter(h => classIds.has(h.classId));
      if (beforeDate) {
        photoHw = photoHw.filter(h => h.dueDate <= beforeDate);
      }
      photoHw.sort((a, b) => b.dueDate.localeCompare(a.dueDate));

      const allSubs = await db.select().from(homeworkSubmissions)
        .where(eq(homeworkSubmissions.studentId, studentId));
      const subMap = new Map(allSubs.map(s => [s.homeworkId, s]));

      // 완성도(제출 평가)가 있는 가장 최근 숙제를 선택
      let photo: { completionRate: number; title: string; dueDate: string; className: string; classSubject: string } | null = null;
      for (const hw of photoHw) {
        const sub = subMap.get(hw.id);
        if (sub && sub.completionRate !== null && sub.completionRate !== undefined) {
          const cls = classMap.get(hw.classId);
          photo = {
            completionRate: sub.completionRate,
            title: hw.title,
            dueDate: hw.dueDate,
            className: cls?.name || "",
            classSubject: cls?.subject || "",
          };
          break;
        }
      }

      // ===== 대면검사 (face-to-face) 직전 완성도 =====
      const faceChecks = await storage.getStudentFaceToFaceChecks(studentId, centerId);
      let relevantFaceChecks = faceChecks.filter(c => classIds.has(c.classId));
      if (beforeDate) {
        relevantFaceChecks = relevantFaceChecks.filter(c => c.dueDate <= beforeDate);
      }
      relevantFaceChecks.sort((a, b) => b.dueDate.localeCompare(a.dueDate));

      const faceResults = await storage.getStudentCheckResults(studentId, centerId);
      const faceResultMap = new Map(faceResults.map(r => [r.checkId, r]));

      let face: { completionRate: number; title: string; dueDate: string; className: string; classSubject: string } | null = null;
      for (const chk of relevantFaceChecks) {
        const r = faceResultMap.get(chk.id);
        if (r && r.completionRate !== null && r.completionRate !== undefined) {
          const cls = classMap.get(chk.classId);
          face = {
            completionRate: r.completionRate,
            title: chk.title,
            dueDate: chk.dueDate,
            className: cls?.name || "",
            classSubject: cls?.subject || "",
          };
          break;
        }
      }

      // ===== 합산: 둘 다 있으면 평균, 아니면 있는 값 =====
      const rates: number[] = [];
      if (photo) rates.push(photo.completionRate);
      if (face) rates.push(face.completionRate);
      const averageCompletionRate = rates.length > 0
        ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length)
        : null;

      // 하위호환: 가장 최근(dueDate) 1건을 대표값으로 노출
      const primary = photo && face
        ? (photo.dueDate >= face.dueDate ? photo : face)
        : (photo || face);

      res.json({
        photo,
        face,
        averageCompletionRate,
        // 하위호환 필드
        completionRate: primary?.completionRate ?? null,
        homeworkTitle: primary?.title ?? null,
        dueDate: primary?.dueDate ?? null,
        className: primary?.className ?? "",
        classSubject: primary?.classSubject ?? "",
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get latest homework completion", details: error?.message });
    }
  });

  // ==================== School Subjects (내신 과목) API ====================
  app.get("/api/school-subjects", async (req, res) => {
    try {
      const { centerId, studentId } = req.query;
      if (!centerId) return res.status(400).json({ error: "centerId required" });
      let results = await db.select().from(schoolSubjects).where(eq(schoolSubjects.centerId, centerId as string));
      if (studentId) {
        results = results.filter(s => s.studentId === studentId);
      }
      results.sort((a, b) => a.name.localeCompare(b.name));
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get school subjects", details: error?.message });
    }
  });

  app.post("/api/school-subjects", async (req, res) => {
    try {
      const { centerId, studentId, name } = req.body;
      if (!centerId || !studentId || !name?.trim()) return res.status(400).json({ error: "centerId, studentId and name required" });
      const existing = await db.select().from(schoolSubjects).where(eq(schoolSubjects.centerId, centerId));
      if (existing.some(s => s.studentId === studentId && s.name === name.trim())) {
        return res.status(400).json({ error: "이미 존재하는 과목입니다" });
      }
      const [subject] = await db.insert(schoolSubjects).values({ centerId, studentId, name: name.trim() }).returning();
      res.json(subject);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create school subject", details: error?.message });
    }
  });

  app.delete("/api/school-subjects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const [subjectToDelete] = await db.select().from(schoolSubjects).where(eq(schoolSubjects.id, id));
      if (!subjectToDelete) return res.status(404).json({ error: "Subject not found" });
      const allGrades = await db.select().from(schoolGrades)
        .where(and(eq(schoolGrades.studentId, subjectToDelete.studentId), eq(schoolGrades.centerId, subjectToDelete.centerId)));
      const gradesUsingSubject = allGrades.filter(g => g.subject === subjectToDelete.name);
      if (gradesUsingSubject.length > 0) {
        return res.status(400).json({ error: "이 과목에 등록된 성적이 있어 삭제할 수 없습니다" });
      }
      await db.delete(schoolSubjects).where(eq(schoolSubjects.id, id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete school subject", details: error?.message });
    }
  });

  // ==================== School Grades (내신성적) API ====================
  app.get("/api/school-grades", async (req, res) => {
    try {
      const { centerId, studentId } = req.query;
      if (!centerId) return res.status(400).json({ error: "centerId required" });

      let query = db.select().from(schoolGrades).where(eq(schoolGrades.centerId, centerId as string));

      const records = await query;
      const filtered = studentId
        ? records.filter(r => r.studentId === studentId)
        : records;

      res.json(filtered);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get school grades", details: error?.message });
    }
  });

  app.post("/api/school-grades", async (req, res) => {
    try {
      const { centerId, studentId, enteredById, schoolLevel, gradeYear, semester, examType, subject, score, grade, rank, totalStudents } = req.body;
      if (!centerId || !studentId || !enteredById || !schoolLevel || !gradeYear || !semester || !examType || !subject || score === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      if (!["middle", "high"].includes(schoolLevel)) return res.status(400).json({ error: "Invalid schoolLevel" });
      if (![1, 2, 3].includes(Number(gradeYear))) return res.status(400).json({ error: "Invalid gradeYear" });
      if (![1, 2].includes(Number(semester))) return res.status(400).json({ error: "Invalid semester" });
      if (!["midterm", "final"].includes(examType)) return res.status(400).json({ error: "Invalid examType" });
      const numScore = Number(score);
      if (isNaN(numScore) || numScore < 0 || numScore > 100) return res.status(400).json({ error: "Score must be 0-100" });
      const numGrade = grade ? Number(grade) : null;
      if (numGrade !== null && (numGrade < 1 || numGrade > 9)) return res.status(400).json({ error: "Grade must be 1-9" });
      const numRank = rank ? Number(rank) : null;
      const numTotal = totalStudents ? Number(totalStudents) : null;
      if (numRank && !numTotal) return res.status(400).json({ error: "totalStudents required when rank is set" });
      if (numRank && numTotal && numRank > numTotal) return res.status(400).json({ error: "rank cannot exceed totalStudents" });

      const [record] = await db.insert(schoolGrades).values({
        centerId, studentId, enteredById, schoolLevel,
        gradeYear: Number(gradeYear), semester: Number(semester),
        examType, subject: subject.trim(), score: numScore,
        grade: numGrade,
        rank: numRank,
        totalStudents: numTotal,
      }).returning();
      res.json(record);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create school grade", details: error?.message });
    }
  });

  app.patch("/api/school-grades/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { score, grade, rank, totalStudents, subject, schoolLevel, gradeYear, semester, examType } = req.body;
      const updates: any = { updatedAt: new Date() };
      if (score !== undefined) {
        const s = Number(score);
        if (isNaN(s) || s < 0 || s > 100) return res.status(400).json({ error: "원점수는 0~100 범위여야 합니다" });
        updates.score = s;
      }
      if (grade !== undefined) {
        const g = grade ? Number(grade) : null;
        if (g !== null && (g < 1 || g > 9)) return res.status(400).json({ error: "등급은 1~9 범위여야 합니다" });
        updates.grade = g;
      }
      if (rank !== undefined) updates.rank = rank ? Number(rank) : null;
      if (totalStudents !== undefined) updates.totalStudents = totalStudents ? Number(totalStudents) : null;
      const finalRank = updates.rank !== undefined ? updates.rank : undefined;
      const finalTotal = updates.totalStudents !== undefined ? updates.totalStudents : undefined;
      if (finalRank && !finalTotal) {
        return res.status(400).json({ error: "석차를 입력하면 전체 인원도 입력해야 합니다" });
      }
      if (subject) updates.subject = subject;
      if (schoolLevel) updates.schoolLevel = schoolLevel;
      if (gradeYear !== undefined) updates.gradeYear = Number(gradeYear);
      if (semester !== undefined) updates.semester = Number(semester);
      if (examType) updates.examType = examType;

      const [record] = await db.update(schoolGrades).set(updates).where(eq(schoolGrades.id, id)).returning();
      res.json(record);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update school grade", details: error?.message });
    }
  });

  app.delete("/api/school-grades/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(schoolGrades).where(eq(schoolGrades.id, id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete school grade", details: error?.message });
    }
  });

  // Textbook Progress (교재진도표) API
  app.get("/api/textbook-progress", async (req, res) => {
    try {
      const { centerId, yearMonth } = req.query;
      if (!centerId) return res.json([]);
      const records = await storage.getTextbookProgressByCenter(centerId as string, yearMonth as string | undefined);
      res.json(records);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get textbook progress", details: error?.message });
    }
  });

  app.post("/api/textbook-progress", async (req, res) => {
    try {
      const { centerId, studentId, yearMonth, progressBook, reviewBook, homeworkCalc, homeworkBook, notes } = req.body;
      if (!centerId || !studentId) return res.status(400).json({ error: "centerId and studentId required" });
      const ym = yearMonth || new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }).substring(0, 7);
      const result = await storage.upsertTextbookProgress({ centerId, studentId, yearMonth: ym, progressBook, reviewBook, homeworkCalc, homeworkBook, notes });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to save textbook progress", details: error?.message });
    }
  });

  app.put("/api/textbook-progress/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { learningLevel, progressBook, reviewBook, homeworkCalc, homeworkBook, notes } = req.body;
      const result = await db.update(textbookProgress)
        .set({ learningLevel, progressBook, reviewBook, homeworkCalc, homeworkBook, notes, updatedAt: new Date() })
        .where(eq(textbookProgress.id, id))
        .returning();
      if (!result[0]) return res.status(404).json({ error: "Not found" });
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update textbook progress", details: error?.message });
    }
  });

  app.delete("/api/textbook-progress/:id", async (req, res) => {
    try {
      await storage.deleteTextbookProgress(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete textbook progress", details: error?.message });
    }
  });

  // ====== Work Journal (업무일지) ======
  app.get("/api/work-journals", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) return res.status(400).json({ error: "actorId is required" });
      const actor = await storage.getUser(actorId);
      if (!actor) return res.status(401).json({ error: "Unauthorized" });
      const centerId = req.query.centerId as string;
      if (!centerId) return res.status(400).json({ error: "centerId is required" });

      const teacherId = actor.role >= UserRole.PRINCIPAL ? (req.query.teacherId as string | undefined) : actor.id;
      const journals = await storage.getWorkJournals(centerId, teacherId);
      res.json(journals);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get work journals", details: error?.message });
    }
  });

  app.get("/api/work-journals/:id", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) return res.status(400).json({ error: "actorId is required" });
      const actor = await storage.getUser(actorId);
      if (!actor) return res.status(401).json({ error: "Unauthorized" });
      const journal = await storage.getWorkJournal(req.params.id);
      if (!journal) return res.status(404).json({ error: "Journal not found" });
      if (actor.role < UserRole.PRINCIPAL && journal.teacherId !== actor.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const classNotes = await storage.getWorkJournalClassNotes(journal.id);
      const studentNotes = await storage.getWorkJournalStudentNotes(journal.id);
      res.json({ ...journal, classNotes, studentNotes });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get work journal", details: error?.message });
    }
  });

  app.post("/api/work-journals", async (req, res) => {
    try {
      const { actorId, classNotes, studentNotes, ...journalData } = req.body;
      if (!actorId) return res.status(400).json({ error: "actorId is required" });
      const actor = await storage.getUser(actorId);
      if (!actor || actor.role < UserRole.TEACHER) {
        return res.status(403).json({ error: "선생님 이상만 업무일지를 작성할 수 있습니다" });
      }
      const journal = await storage.createWorkJournal({ ...journalData, teacherId: actor.id });
      if (classNotes && Array.isArray(classNotes)) {
        for (const cn of classNotes) {
          if (cn.classId && cn.notes) {
            await storage.upsertWorkJournalClassNote({ journalId: journal.id, classId: cn.classId, notes: cn.notes });
          }
        }
      }
      if (studentNotes && Array.isArray(studentNotes)) {
        for (const sn of studentNotes) {
          if (sn.studentId && sn.notes) {
            await storage.upsertWorkJournalStudentNote({ journalId: journal.id, studentId: sn.studentId, notes: sn.notes });
          }
        }
      }
      const fullJournal = await storage.getWorkJournal(journal.id);
      const savedClassNotes = await storage.getWorkJournalClassNotes(journal.id);
      const savedStudentNotes = await storage.getWorkJournalStudentNotes(journal.id);
      res.json({ ...fullJournal, classNotes: savedClassNotes, studentNotes: savedStudentNotes });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create work journal", details: error?.message });
    }
  });

  app.put("/api/work-journals/:id", async (req, res) => {
    try {
      const { actorId, classNotes, studentNotes, ...journalData } = req.body;
      if (!actorId) return res.status(400).json({ error: "actorId is required" });
      const actor = await storage.getUser(actorId);
      if (!actor) return res.status(401).json({ error: "Unauthorized" });
      const journal = await storage.getWorkJournal(req.params.id);
      if (!journal) return res.status(404).json({ error: "Journal not found" });
      if (actor.role < UserRole.PRINCIPAL && journal.teacherId !== actor.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const updated = await storage.updateWorkJournal(req.params.id, journalData);
      if (classNotes && Array.isArray(classNotes)) {
        const existingClassNotes = await storage.getWorkJournalClassNotes(journal.id);
        const incomingClassIds = classNotes.map((cn: any) => cn.classId);
        for (const ecn of existingClassNotes) {
          if (!incomingClassIds.includes(ecn.classId)) {
            await storage.deleteWorkJournalClassNote(ecn.id);
          }
        }
        for (const cn of classNotes) {
          if (cn.classId) {
            await storage.upsertWorkJournalClassNote({ journalId: journal.id, classId: cn.classId, notes: cn.notes || "" });
          }
        }
      }
      if (studentNotes && Array.isArray(studentNotes)) {
        const existingStudentNotes = await storage.getWorkJournalStudentNotes(journal.id);
        const incomingStudentIds = studentNotes.map((sn: any) => sn.studentId);
        for (const esn of existingStudentNotes) {
          if (!incomingStudentIds.includes(esn.studentId)) {
            await storage.deleteWorkJournalStudentNote(esn.id);
          }
        }
        for (const sn of studentNotes) {
          if (sn.studentId) {
            await storage.upsertWorkJournalStudentNote({ journalId: journal.id, studentId: sn.studentId, notes: sn.notes || "" });
          }
        }
      }
      const savedClassNotes = await storage.getWorkJournalClassNotes(journal.id);
      const savedStudentNotes = await storage.getWorkJournalStudentNotes(journal.id);
      res.json({ ...updated, classNotes: savedClassNotes, studentNotes: savedStudentNotes });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update work journal", details: error?.message });
    }
  });

  app.delete("/api/work-journals/:id", async (req, res) => {
    try {
      const actorId = req.query.actorId as string;
      if (!actorId) return res.status(400).json({ error: "actorId is required" });
      const actor = await storage.getUser(actorId);
      if (!actor) return res.status(401).json({ error: "Unauthorized" });
      const journal = await storage.getWorkJournal(req.params.id);
      if (!journal) return res.status(404).json({ error: "Journal not found" });
      if (actor.role < UserRole.PRINCIPAL && journal.teacherId !== actor.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      await storage.deleteWorkJournal(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete work journal", details: error?.message });
    }
  });

  registerMathWrongNoteRoutes(app);

  return httpServer;
}
