// Academy Management System - Server Entry Point v2
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDatabase, ensureDefaultFeatures, ensureMissingFeatures, ensureAdminUser, storage } from "./storage";
import { runMigrations } from "./db";
import * as fs from "fs";
import * as path from "path";
import { isR2Configured, startCleanupScheduler } from "./r2-storage";
import { startAutoLateNotificationScheduler, cleanupAutoLateLogs } from "./services/auto-late-notification";
import { startSupplementaryReminderScheduler } from "./services/supplementary-reminder";
import { startScheduledSmsScheduler } from "./services/scheduled-sms";

// Startup logging for debugging
console.log(`[STARTUP] Server starting (${process.env.NODE_ENV || "development"})`);
console.log(`[STARTUP] Node version: ${process.version}`);
console.log(`[STARTUP] Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);

if (!process.env.DATABASE_URL) {
  console.error("[FATAL] DATABASE_URL is not set! Server cannot connect to database.");
} else {
  console.log(`[STARTUP] DATABASE_URL is set (length: ${process.env.DATABASE_URL.length})`);
}

const app = express();
const httpServer = createServer(app);

// Track server initialization state
let isInitialized = false;
let initializationError: string | null = null;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Health check endpoint - must be registered FIRST before any other routes
app.get("/health", (_req, res) => {
  console.log("[DEBUG] /health check called");
  return res.status(200).json({ status: "ok" });
});

// Diagnostic endpoint for debugging 503 errors
app.get("/api/debug-status", (_req, res) => {
  const mem = process.memoryUsage();
  const status = {
    initialized: isInitialized,
    initError: initializationError,
    uptime: Math.floor(process.uptime()) + "s",
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    memory: {
      rss: (mem.rss / 1024 / 1024).toFixed(1) + "MB",
      heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(1) + "MB",
      heapTotal: (mem.heapTotal / 1024 / 1024).toFixed(1) + "MB",
    },
    dbUrlSet: !!process.env.DATABASE_URL,
    timestamp: new Date().toISOString(),
    pid: process.pid,
  };
  console.log("[DEBUG-STATUS]", JSON.stringify(status));
  return res.status(200).json(status);
});

// Block requests until initialization is complete (prevents "Cannot GET" errors)
// This middleware returns a loading page for non-API requests during startup
app.use((req, res, next) => {
  if (isInitialized) {
    return next();
  }
  
  // Allow health check through
  if (req.path === "/health" || req.path === "/api/health") {
    return next();
  }
  
  // For API requests, return 503 with JSON
  if (req.path.startsWith("/api")) {
    return res.status(503).json({ 
      error: "Server is starting up, please wait...",
      status: "initializing"
    });
  }
  
  // For page requests, return a loading HTML page that auto-refreshes (200 so health checks pass)
  return res.status(200).send(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="refresh" content="3">
      <title>서버 시작 중...</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .container {
          text-align: center;
          padding: 2rem;
        }
        .spinner {
          width: 50px;
          height: 50px;
          border: 4px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1.5rem;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
        p { opacity: 0.8; font-size: 0.9rem; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="spinner"></div>
        <h1>서버 시작 중...</h1>
        <p>잠시만 기다려주세요. 페이지가 자동으로 새로고침됩니다.</p>
      </div>
    </body>
    </html>
  `);
});

// Trust proxy headers (required for Railway/Replit environments)
app.set("trust proxy", true);

// Redirect non-www to www domain (primemathgroup.com -> www.primemathgroup.com)
app.use((req, res, next) => {
  const host = (req.headers.host || "").toLowerCase();
  const proto =
    (req.headers["x-forwarded-proto"] as string) || (req.secure ? "https" : "http");

  // primemathgroup.com -> www.primemathgroup.com
  if (host === "primemathgroup.com") {
    const redirectUrl = `${proto}://www.primemathgroup.com${req.originalUrl}`;
    return res.redirect(301, redirectUrl);
  }
  next();
});

app.use(
  express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

const isProduction = process.env.NODE_ENV === "production";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

export function debugLog(message: string, ...args: any[]) {
  console.log(message, ...args);
}

// Memory monitoring for OOM debugging
function formatBytes(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

function logMemoryUsage() {
  const mem = process.memoryUsage();
  const usage = {
    rss: formatBytes(mem.rss),           // Total memory allocated
    heapTotal: formatBytes(mem.heapTotal), // Total heap size
    heapUsed: formatBytes(mem.heapUsed),   // Actually used heap
    external: formatBytes(mem.external),   // C++ objects bound to JS
  };
  log(`Memory: RSS=${usage.rss}, HeapTotal=${usage.heapTotal}, HeapUsed=${usage.heapUsed}, External=${usage.external}`, "memory");
}

// Cleanup expired exam papers (45-day retention)
async function cleanupExpiredExamPapers() {
  console.log("[CLEANUP] Starting exam paper cleanup...");
  try {
    const expiredPapers = await storage.getExpiredExamPapers();
    console.log(`[CLEANUP] Found ${expiredPapers.length} expired papers`);
    if (expiredPapers.length === 0) {
      return;
    }

    // Delete from R2 if configured
    if (isR2Configured()) {
      const { deleteObject } = await import("./r2-storage");
      for (const paper of expiredPapers) {
        try {
          await deleteObject(paper.objectKey);
        } catch (err) {
          // Silent fail in production
        }
      }
    }

    // Delete from database
    await storage.deleteExpiredExamPapers();
    console.log("[CLEANUP] Exam paper cleanup complete");
  } catch (error) {
    console.error("[CLEANUP] Failed:", error);
  }
}

// Memory monitoring disabled for production to reduce log volume

// Disable caching for API routes
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Generate unique request ID for error correlation
let requestCounter = 0;

app.use((req, res, next) => {
  const reqPath = req.path;
  const reqId = ++requestCounter;

  // Only log errors
  res.on("error", (err) => {
    if (reqPath.startsWith("/api")) {
      console.error(`[REQ-${reqId}] ERROR in ${req.method} ${reqPath}:`, err);
    }
  });

  next();
});

// Auto-promote student grades on January 1st
async function checkAndPromoteGrades() {
  try {
    const currentYear = new Date().getFullYear();
    const lastPromotionYear = await storage.getSystemSetting("lastPromotionYear");
    
    if (!lastPromotionYear || parseInt(lastPromotionYear) < currentYear) {
      await storage.promoteAllStudentGrades();
      await storage.setSystemSetting("lastPromotionYear", currentYear.toString());
    }
  } catch (error) {
    console.error("Grade promotion error:", error);
  }
}

// Cleanup old temporary clinic resources (older than 14 days from upload)
async function cleanupOldClinicResources() {
  try {
    // Calculate cutoff date: 14 days ago from now
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const cutoffDate = fourteenDaysAgo.toISOString();
    
    const { count, filePaths } = await storage.deleteOldTemporaryClinicResources(cutoffDate);
    
    // Delete files from disk
    for (const filePath of filePaths) {
      try {
        // filePath is like "/uploads/clinic/filename.pdf", need to resolve to actual path
        const actualPath = path.join(process.cwd(), filePath.startsWith("/") ? filePath.slice(1) : filePath);
        if (fs.existsSync(actualPath)) {
          fs.unlinkSync(actualPath);
        }
      } catch (fileErr) {
        console.error(`Failed to delete file ${filePath}:`, fileErr);
      }
    }
  } catch (error) {
    console.error("Clinic resources cleanup error:", error);
  }
}

// Async initialization function - runs AFTER server starts
async function initializeApp() {
  try {
    console.log("[INIT] Starting initialization...");
    await runMigrations();
    await seedDatabase();
    await ensureAdminUser();
    await ensureDefaultFeatures();
    await ensureMissingFeatures();
    await registerRoutes(httpServer, app);
    console.log("[INIT] Initialization complete");
    
    // Cleanup old temporary clinic resources on startup
    await cleanupOldClinicResources();
    
    // Check and promote grades on startup (runs once per year)
    await checkAndPromoteGrades();
    
    // Check daily for grade promotion (in case server runs across year boundary)
    setInterval(() => {
      checkAndPromoteGrades();
    }, 24 * 60 * 60 * 1000); // 24 hours

    // Global error handler - catches all unhandled errors in routes
    app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      // Log full error with stack trace for debugging
      console.error("=".repeat(60));
      console.error(`[GLOBAL ERROR] ${req.method} ${req.path}`);
      console.error(`[GLOBAL ERROR] Status: ${status}`);
      console.error(`[GLOBAL ERROR] Message: ${message}`);
      console.error(`[GLOBAL ERROR] Stack:`, err.stack || err);
      console.error("=".repeat(60));

      // Don't throw - just respond with error
      if (!res.headersSent) {
        res.status(status).json({ error: message });
      }
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }

    // Mark initialization complete
    isInitialized = true;
    const mem = process.memoryUsage();
    console.log("[STARTUP] Server ready");
    console.log(`[STARTUP] Memory after init: RSS=${(mem.rss/1024/1024).toFixed(1)}MB, Heap=${(mem.heapUsed/1024/1024).toFixed(1)}MB`);
    
    // Periodic health log every 60s for debugging crashes
    setInterval(() => {
      const m = process.memoryUsage();
      console.log(`[HEARTBEAT] uptime=${Math.floor(process.uptime())}s rss=${(m.rss/1024/1024).toFixed(1)}MB heap=${(m.heapUsed/1024/1024).toFixed(1)}MB`);
    }, 60000);
    
    // Setup cleanup intervals (no logging)
    setInterval(() => {
      cleanupExpiredExamPapers().catch(() => {});
    }, 24 * 60 * 60 * 1000);
    
    startAutoLateNotificationScheduler(5);
    startSupplementaryReminderScheduler(10);
    startScheduledSmsScheduler(1);
    
    setInterval(() => {
      cleanupAutoLateLogs().catch(() => {});
    }, 24 * 60 * 60 * 1000);
  } catch (initError: any) {
    console.error("=".repeat(60));
    console.error("[INITIALIZATION ERROR]");
    console.error(initError.message);
    console.error(initError.stack);
    console.error("=".repeat(60));
    initializationError = initError.message;
  }
}

// Start server FIRST, then initialize app asynchronously
// This allows the deployment platform's health check to succeed quickly
const port = parseInt(process.env.PORT || "5000", 10);
console.log("[DEBUG] process.env.PORT =", process.env.PORT);
console.log("[DEBUG] Listening on PORT =", port);
console.log("[DEBUG] Bind address = 0.0.0.0");
httpServer.listen(
  {
    port,
    host: "0.0.0.0",
    reusePort: true,
  },
  () => {
    console.log(`[STARTUP] Server listening on port ${port}`);
    // Start async initialization after server is listening
    initializeApp().catch(err => {
      console.error("[FATAL] Initialization failed:", err);
      initializationError = err.message;
    });
  },
);

// Catch unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("=".repeat(60));
  console.error("[UNHANDLED REJECTION] Unhandled Promise Rejection:");
  console.error("Reason:", reason);
  console.error("Promise:", promise);
  console.error("=".repeat(60));
});

// Catch uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("=".repeat(60));
  console.error("[UNCAUGHT EXCEPTION]");
  console.error(error.message);
  console.error(error.stack);
  console.error("=".repeat(60));
});

// Handle SIGTERM - log when Railway kills the container
process.on("SIGTERM", () => {
  console.log("[SHUTDOWN] Received SIGTERM signal");
  console.log("[SHUTDOWN] Server was running for", Math.floor(process.uptime()), "seconds");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[SHUTDOWN] Received SIGINT signal");
  process.exit(0);
});
