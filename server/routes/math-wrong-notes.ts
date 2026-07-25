/**
 * 수학 오답노트 라우트
 * - 문제집 업로드 및 관리 (PDF/이미지 → 페이지별 저장)
 * - Gemini AI 기반 문제 자동 감지 (bounding box + 페이지 번호 인식)
 * - 오답노트 생성/할당/폴더 관리
 * - 크레딧 차감 (페이지당 90원)
 */
import type { Express } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { db } from "../db";
import { sql, eq, and, desc, isNull, inArray } from "drizzle-orm";
import {
  mathWorkbooks, mathWorkbookPages, mathProblems,
  mathWrongNotes, mathWrongNoteItems, mathWrongNoteStudents,
  mathWrongNoteFolders, mathWorkbookFolders,
  smsCredits, smsCreditTransactions, users, UserRole,
} from "@shared/schema";
import { uploadBuffer, deleteObject, isR2Configured, downloadBuffer } from "../r2-storage";
import { storage } from "../storage";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { convertPdfToImages } from "../services/pdf-converter";

const COST_PER_PAGE = 90; // AI 감지 페이지당 비용 (원)

// 업로드 임시 디렉토리
const tmpDir = path.join("/tmp", "math-uploads");
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

const mathUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("지원하지 않는 파일 형식입니다."));
  },
});

// Gemini AI 모델 초기화 (범용)
async function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

// Gemini AI 모델 초기화 (문제 자동 감지용 - JSON 응답, 낮은 temperature)
function getAutoDetectModel() {
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
      maxOutputTokens: 8192,
      // @ts-ignore
      thinkingConfig: { thinkingBudget: 0 },
    } as any,
  });
}

// AI 응답 JSON 파싱 (불완전한 JSON 복구 포함)
function repairJson(raw: string): any {
  let text = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try { return JSON.parse(text); } catch {}
  const open: string[] = [];
  let inString = false, escape = false;
  for (const ch of text) {
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{" || ch === "[") open.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") open.pop();
  }
  text = text.replace(/,?\s*"\w+"\s*:\s*$/, "");
  for (let i = open.length - 1; i >= 0; i--) text += open[i];
  try { return JSON.parse(text); } catch {}
  const matches = [...text.matchAll(/\{[^{}]*"problemNumber"[^{}]*\}/g)];
  if (matches.length > 0) {
    const pageNumMatch = text.match(/"pageNumber"\s*:\s*(\d+)/);
    return {
      pageNumber: pageNumMatch ? Number(pageNumMatch[1]) : null,
      problems: matches.map(m => { try { return JSON.parse(m[0]); } catch { return null; } }).filter(Boolean),
    };
  }
  throw new Error("AI 응답 파싱 실패");
}

const MAX_RETRIES = 4;
const MIN_W_RATIO = 0.05;
const MIN_H_RATIO = 0.05;
const MIN_PX = 40;
const DETECT_CONCURRENCY = 5;

const activeDetections = new Map<string, AbortController>();

function cancelDetection(workbookId: string) {
  const ctrl = activeDetections.get(workbookId);
  if (ctrl) {
    console.log(`[Auto-Detect] Cancelling detection for workbook ${workbookId}`);
    ctrl.abort();
    activeDetections.delete(workbookId);
  }
}

async function callGeminiWithRetry(model: any, prompt: any[], signal?: AbortSignal): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (signal?.aborted) throw new Error("Detection cancelled");
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err: any) {
      if (signal?.aborted) throw new Error("Detection cancelled");
      const msg = String(err?.message ?? "");
      const is429 = err?.status === 429 || msg.includes("429");
      const is503 = err?.status === 503 || msg.includes("503") || msg.includes("Service Unavailable") || msg.includes("high demand");
      const shouldRetry = (is429 || is503) && attempt < MAX_RETRIES - 1;
      if (shouldRetry) {
        let waitSec: number;
        if (is429) {
          const retryMatch = msg.match(/retry.*?(\d+(?:\.\d+)?)s/i);
          waitSec = retryMatch ? parseFloat(retryMatch[1]) + 1 : (attempt + 1) * 5;
        } else {
          const jitter = Math.random() * 1.5;
          waitSec = Math.min(2 * Math.pow(2, attempt), 10) + jitter;
        }
        console.log(`[Gemini] ${is429 ? "429" : "503"} retry ${attempt + 1}/${MAX_RETRIES}, wait ${waitSec.toFixed(1)}s`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Gemini call failed after max retries");
}

// AI 감지 결과를 px 좌표로 변환하고 최소 크기 필터링
function parseDetectedProblems(problems: any[], imageWidth: number, imageHeight: number) {
  return problems
    .filter(p => p.x_percent !== undefined && p.y_percent !== undefined)
    .filter(p => Number(p.width_percent ?? 0) >= MIN_W_RATIO && Number(p.height_percent ?? 0) >= MIN_H_RATIO)
    .map(p => {
      const x = Math.max(0, Math.round(Number(p.x_percent) * imageWidth));
      const y = Math.max(0, Math.round(Number(p.y_percent) * imageHeight));
      const w = Math.min(imageWidth - x, Math.round(Number(p.width_percent) * imageWidth));
      const h = Math.min(imageHeight - y, Math.round(Number(p.height_percent) * imageHeight));
      return {
        problemNumber: String(p.problemNumber ?? "?"),
        label: p.label || null,
        cropX: x, cropY: y, cropWidth: w, cropHeight: h,
      };
    })
    .filter(p => p.cropWidth >= MIN_PX && p.cropHeight >= MIN_PX);
}

const AUTO_DETECT_SYSTEM_PROMPT = `당신은 한국 수학 문제집 이미지에서 개별 문제의 정확한 위치(bounding box)를 찾는 전문가입니다.

## 목표
이미지에서 번호가 붙은 모든 수학 문제를 찾고, 각 문제의 **정확한 bounding box**를 퍼센트 좌표로 반환합니다.

## 반환 JSON 형식
{
  "pageNumber": 14,
  "problems": [
    {
      "problemNumber": "21",
      "label": "",
      "x_percent": 0.03,
      "y_percent": 0.18,
      "width_percent": 0.45,
      "height_percent": 0.22
    }
  ]
}

## 좌표 설명
- x_percent, y_percent: 문제 영역의 **왼쪽 상단** 꼭짓점 위치 (0.0~1.0, 이미지 전체 기준 비율)
- width_percent, height_percent: 문제 영역의 **너비와 높이** (이미지 전체 기준 비율)
- 예: x_percent=0.03, y_percent=0.20이면 이미지 왼쪽에서 3%, 위에서 20% 지점이 시작점

## 핵심 규칙

### 1. 문제 번호 찾기
- 페이지에서 **굵은 아라비아 숫자**(1, 2, 3, ... 21, 22, 23 등)를 모두 찾는다
- 이 숫자는 문제의 좌측에 크게 인쇄되어 있다
- **제외**: 페이지 번호(하단 구석 작은 숫자), "유형 01/02/03" 같은 섹션 라벨, 선택지 번호(①②③)
- **포함**: 모든 번호 문제 (대표문제, 유제, 일반 문제 모두)

### 2. Bounding Box 규칙 (가장 중요!)
각 문제의 bounding box는 **문제 번호부터 그 문제의 마지막 내용(풀이 공간, 선택지 등)까지** 포함해야 합니다:

- **시작 y**: 문제 번호 텍스트의 윗부분 (번호 위 약 1% 여유)
- **끝 y**: 다음 문제 번호가 시작되기 직전까지, 또는 페이지 하단까지
  - 선택지(①②③④⑤)가 있으면 선택지 마지막 줄 아래까지
  - 풀이 공간(빈칸)이 있으면 그 빈칸까지 포함
- **시작 x**: 해당 열(column)의 시작. 왼쪽 열이면 0.01~0.03, 오른쪽 열이면 0.50~0.52
- **너비**: 해당 열 전체 너비. 보통 0.45~0.48

### 3. 2단(2-column) 레이아웃
대부분의 문제집은 좌우 2단입니다:
- **왼쪽 열**: x_percent ≈ 0.01~0.03, width_percent ≈ 0.46
- **오른쪽 열**: x_percent ≈ 0.50~0.52, width_percent ≈ 0.46
- 왼쪽 열 문제를 먼저 번호순, 그 다음 오른쪽 열 문제를 번호순으로 반환

### 4. 문제 영역 간 겹침 없음
- 같은 열에서 인접한 두 문제의 y 범위가 겹치지 않아야 합니다
- 한 문제의 y_percent + height_percent ≈ 다음 문제의 y_percent

### 5. label
- 번호 옆에 "대표문제", "유제", "필수예제" 등이 적혀 있으면 해당 텍스트를 label에 기입
- 없으면 빈 문자열 ""

### 6. pageNumber (최우선 확인 사항!)
**반드시 이미지의 맨 아래(하단) 가장자리를 먼저 확인하세요.**
- 교재의 **쪽 번호**는 이미지 **맨 아래줄(footer)**에 인쇄되어 있습니다
- 보통 페이지 번호 옆에 교재 이름이나 출판사 정보가 함께 적혀 있습니다 (예: "8 슈퍼포스 고등수학", "32 개념원리", "55")
- 위치는 **하단 왼쪽**, **하단 가운데**, 또는 **하단 오른쪽** 중 하나입니다
- **주의: 다음은 페이지 번호가 아닙니다!**
  - 문제 번호 (1, 2, 3, ... 또는 1p-01, 2p-03 등)
  - 화면 상단의 "N/M" 형태 카운터 (예: "1/22")
  - 유형/섹션 번호
- 페이지 번호는 이미지의 y좌표 93%~100% 영역(가장 아래 부분)에 위치합니다
- 찾은 숫자를 정수로 pageNumber에 기입하세요
- 정말 없는 경우에만 null

## 주의사항
- **모든** 번호 문제를 빠짐없이 감지하세요. 누락은 가장 큰 오류입니다.
- "유형", "개념", "공식" 박스 자체는 문제가 아니지만, 그 아래에 있는 번호 문제는 반드시 감지해야 합니다.
- height_percent가 너무 작으면 문제 내용이 잘립니다. 최소 0.08 이상이어야 합니다.
- 문제에 그림/도표가 포함되어 있으면 그것도 bounding box에 포함시키세요.`;

async function verifyActor(actorId: string, minRole: number = UserRole.STUDENT) {
  if (!actorId) {
    console.log("[Math] verifyActor: no actorId");
    return null;
  }
  const actor = await storage.getUser(actorId);
  if (!actor) {
    console.log(`[Math] verifyActor: user not found for id=${actorId}`);
    return null;
  }
  if (actor.role < minRole) {
    console.log(`[Math] verifyActor: role ${actor.role} < minRole ${minRole} for user ${actor.name}`);
    return null;
  }
  return actor;
}

// 크레딧 차감 처리
async function deductCredits(centerId: string, pages: number, description: string): Promise<{ success: boolean; error?: string; balance?: number }> {
  const cost = pages * COST_PER_PAGE;
  const [credit] = await db.select().from(smsCredits).where(eq(smsCredits.centerId, centerId));
  const currentBalance = credit?.balance || 0;

  if (currentBalance < cost) {
    return { success: false, error: `충전 금액이 부족합니다. 필요: ${cost.toLocaleString()}원, 현재 잔액: ${currentBalance.toLocaleString()}원` };
  }

  const newBalance = currentBalance - cost;
  if (credit) {
    await db.update(smsCredits).set({ balance: newBalance, updatedAt: new Date() }).where(eq(smsCredits.centerId, centerId));
  }

  await db.insert(smsCreditTransactions).values({
    centerId,
    amount: -cost,
    type: "deduct",
    description,
    messageType: "ai_math",
  });

  return { success: true, balance: newBalance };
}


// 페이지 이미지에서 AI로 문제 감지 실행 (페이지 번호 + bounding box)
async function autoDetectProblems(pageId: string, imageBuffer: Buffer, width: number, height: number, signal?: AbortSignal): Promise<void> {
  try {
    if (signal?.aborted) throw new Error("Detection cancelled");
    const model = getAutoDetectModel();
    const base64Image = imageBuffer.toString("base64");
    const mimeType = "image/jpeg";

    const userPrompt = `이미지 크기: ${width} x ${height} px

이 수학 문제집 페이지를 분석해주세요.

1단계: 이미지 맨 아래 footer 영역(y 93%~100%)에서 교재의 **쪽 번호**를 찾으세요. 보통 교재명과 함께 적혀 있습니다 (예: "8 슈퍼포스 고등수학"). 문제 번호나 상단 카운터(1/22 등)와 혼동하지 마세요.
2단계: 번호가 붙은 모든 수학 문제를 찾고 각 문제의 정확한 bounding box를 반환하세요.

각 문제 영역에는 문제 번호, 지문, 수식, 보기/선택지, 그림을 모두 포함해야 합니다.
빠짐없이 모든 문제를 감지하는 것이 가장 중요합니다.`;

    console.log(`[Auto-Detect] Page ${pageId}: Calling Gemini API (image size: ${(base64Image.length / 1024).toFixed(0)}KB base64)`);
    const text = await callGeminiWithRetry(model, [
      { text: AUTO_DETECT_SYSTEM_PROMPT },
      { text: userPrompt },
      { inlineData: { mimeType, data: base64Image } },
    ], signal);

    console.log(`[Auto-Detect] Page ${pageId}: Gemini raw response (first 500 chars): ${text.slice(0, 500)}`);

    let parsed: any;
    try {
      parsed = repairJson(text);
    } catch {
      console.log(`[Auto-Detect] Page ${pageId}: JSON repair failed, raw text: ${text.slice(0, 300)}`);
      await db.update(mathWorkbookPages).set({ detectionStatus: "completed" }).where(eq(mathWorkbookPages.id, pageId));
      return;
    }

    const rawProblems = parsed?.problems;
    if (!Array.isArray(rawProblems) || rawProblems.length === 0) {
      console.log(`[Auto-Detect] Page ${pageId}: no problems found. Parsed keys: ${Object.keys(parsed || {}).join(",")}, problems type: ${typeof rawProblems}, raw response: ${text.slice(0, 300)}`);
      await db.update(mathWorkbookPages).set({ detectionStatus: "completed" }).where(eq(mathWorkbookPages.id, pageId));
      return;
    }

    console.log(`[Auto-Detect] Page ${pageId}: raw problems count=${rawProblems.length}, first: ${JSON.stringify(rawProblems[0])}`);
    const filtered = parseDetectedProblems(rawProblems, width, height);
    console.log(`[Auto-Detect] Page ${pageId}: after filter count=${filtered.length} (min_w=${MIN_W_RATIO}, min_h=${MIN_H_RATIO}, min_px=${MIN_PX})`);

    const pn = parsed.pageNumber;
    const detectedPageNum = pn != null ? Math.floor(Number(pn)) : NaN;

    for (const p of filtered) {
      await db.insert(mathProblems).values({
        pageId,
        problemNumber: p.problemNumber.slice(0, 50),
        label: p.label,
        cropX: p.cropX, cropY: p.cropY, cropWidth: p.cropWidth, cropHeight: p.cropHeight,
      });
    }
    const pageUpdate: any = { detectionStatus: "completed" };
    if (!isNaN(detectedPageNum) && detectedPageNum > 0) {
      pageUpdate.pageNumber = detectedPageNum;
    }
    await db.update(mathWorkbookPages).set(pageUpdate).where(eq(mathWorkbookPages.id, pageId));
    console.log(`[Auto-Detect] Page ${pageId}: ${filtered.length} problems detected (raw: ${rawProblems.length}, detectedPageNum: ${detectedPageNum || "N/A"})`);
  } catch (e: any) {
    console.error(`[Auto-Detect] Page ${pageId} error:`, e?.message);
    await db.update(mathWorkbookPages).set({ detectionStatus: "failed" }).where(eq(mathWorkbookPages.id, pageId)).catch(() => {});
  }
}

async function getImageBufferFromR2(r2ObjectKey: string | null, imageUrl: string): Promise<Buffer> {
  const key = r2ObjectKey || imageUrl;
  if (!key) throw new Error("No image key available");
  if (isR2Configured()) {
    return await downloadBuffer(key);
  }
  throw new Error("R2 not configured");
}

export function registerMathWrongNoteRoutes(app: Express) {

  (async () => {
    try {
      const stuckPages = await db.update(mathWorkbookPages)
        .set({ detectionStatus: null })
        .where(eq(mathWorkbookPages.detectionStatus, "pending"))
        .returning({ id: mathWorkbookPages.id });
      if (stuckPages.length > 0) {
        console.log(`[Math-Init] Reset ${stuckPages.length} stuck "pending" pages to null`);
      }
    } catch (e: any) {
      console.error(`[Math-Init] Error resetting pending pages:`, e?.message);
    }
  })();

  app.get("/api/math-workbooks", async (req, res) => {
    try {
      const { centerId, actorId } = req.query as { centerId: string; actorId: string };
      if (!centerId || !actorId) return res.status(400).json({ error: "centerId and actorId required" });
      const actor = await verifyActor(actorId);
      if (!actor) return res.status(401).json({ error: "Unauthorized" });

      const workbooks = await db.select().from(mathWorkbooks)
        .where(and(eq(mathWorkbooks.centerId, centerId), isNull(mathWorkbooks.deletedAt)))
        .orderBy(desc(mathWorkbooks.createdAt));

      const result = await Promise.all(workbooks.map(async (wb) => {
        const pages = await db.select().from(mathWorkbookPages).where(eq(mathWorkbookPages.workbookId, wb.id));
        const wrongNotes = await db.select().from(mathWrongNotes)
          .where(and(eq(mathWrongNotes.workbookId, wb.id), isNull(mathWrongNotes.deletedAt)));
        const creator = await storage.getUser(wb.createdBy);
        return { ...wb, pageCount: pages.length, wrongNoteCount: wrongNotes.length, creatorName: creator?.name || "알 수 없음" };
      }));

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.post("/api/math-workbooks", async (req, res) => {
    try {
      const { centerId, title, folderId, actorId } = req.body;
      if (!centerId || !title || !actorId) return res.status(400).json({ error: "centerId, title, actorId required" });
      const actor = await verifyActor(actorId, UserRole.TEACHER);
      if (!actor) return res.status(403).json({ error: "Forbidden" });

      const [workbook] = await db.insert(mathWorkbooks).values({
        centerId, title, createdBy: actorId, totalPages: 0, paidPages: 0, folderId: folderId || null,
      }).returning();

      res.json(workbook);
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.post("/api/math-workbooks/:id/upload", (req, res, next) => {
    const contentType = req.headers["content-type"] || "";
    const contentLength = req.headers["content-length"] || "0";
    console.log(`[Math Upload] Pre-multer: content-type=${contentType.substring(0, 80)}, content-length=${contentLength}`);
    mathUpload.array("files", 50)(req, res, (err) => {
      if (err) {
        console.error("[Math Upload] Multer error:", err.message, err.code || "");
        return res.status(400).json({ error: err.message || "파일 업로드 오류" });
      }
      console.log(`[Math Upload] Post-multer: files=${(req.files as any[])?.length || 0}, body keys=${Object.keys(req.body || {}).join(",")}`);
      next();
    });
  }, async (req, res) => {
    try {
      const { id } = req.params;
      const { actorId, centerId } = req.body;
      console.log(`[Math Upload] Start: workbookId=${id}, actorId=${actorId}, centerId=${centerId}, files=${(req.files as any[])?.length || 0}`);
      if (!actorId || !centerId) return res.status(400).json({ error: "actorId and centerId required" });

      const actor = await verifyActor(actorId, UserRole.TEACHER);
      if (!actor) return res.status(403).json({ error: "Forbidden" });

      const [workbook] = await db.select().from(mathWorkbooks).where(eq(mathWorkbooks.id, id));
      if (!workbook || workbook.centerId !== centerId) return res.status(404).json({ error: "Workbook not found" });

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        console.error(`[Math Upload] No files received. Check multer config.`);
        return res.status(400).json({ error: "파일이 전달되지 않았습니다. 다시 시도해주세요." });
      }
      console.log(`[Math Upload] Received ${files.length} files: ${files.map(f => `${f.originalname}(${(f.size/1024).toFixed(0)}KB)`).join(", ")}`);

      const existingPages = await db.select().from(mathWorkbookPages).where(eq(mathWorkbookPages.workbookId, id));
      let pageNum = existingPages.length + 1;

      const imageBuffers: { buffer: Buffer; width: number; height: number }[] = [];

      for (const file of files) {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === ".pdf") {
          const pdfPages = await convertPdfToImages(file.buffer);
          for (const pdfPage of pdfPages) {
            imageBuffers.push({ buffer: pdfPage.buffer, width: pdfPage.width, height: pdfPage.height });
          }
        } else {
          const imgBuffer = await sharp(file.buffer).png().toBuffer();
          const metadata = await sharp(imgBuffer).metadata();
          imageBuffers.push({ buffer: imgBuffer, width: metadata.width || 0, height: metadata.height || 0 });
        }
      }

      const newPages: any[] = [];
      for (let i = 0; i < imageBuffers.length; i++) {
        const img = imageBuffers[i];
        const objectKey = `math-workbooks/${id}/pages/${pageNum}.jpg`;
        const jpgBuffer = await sharp(img.buffer).jpeg({ quality: 90 }).toBuffer();
        const jpgMeta = await sharp(jpgBuffer).metadata();

        let imageUrl = objectKey;
        if (isR2Configured()) {
          imageUrl = await uploadBuffer(jpgBuffer, objectKey, "image/jpeg");
        }

        const [page] = await db.insert(mathWorkbookPages).values({
          workbookId: id,
          pageNumber: pageNum,
          imageUrl,
          r2ObjectKey: objectKey,
          width: jpgMeta.width || img.width,
          height: jpgMeta.height || img.height,
        }).returning();

        newPages.push(page);
        pageNum++;
      }

      const totalPageCount = existingPages.length + newPages.length;

      await db.update(mathWorkbooks).set({
        totalPages: totalPageCount,
      }).where(eq(mathWorkbooks.id, id));

      const [creditRecord] = await db.select().from(smsCredits).where(eq(smsCredits.centerId, centerId));
      const currentBalance = creditRecord?.balance || 0;
      const detectionCost = newPages.length * COST_PER_PAGE;

      console.log(`[Math Upload] Success: workbookId=${id}, newPages=${newPages.length}, totalPages=${totalPageCount}, detectionCost=${detectionCost}, balance=${currentBalance}`);

      res.json({
        pages: newPages.map((p) => ({ ...p, isPaid: true })),
        totalPages: totalPageCount,
        newPageCount: newPages.length,
        detectionCost,
        balance: currentBalance,
      });
    } catch (error: any) {
      console.error(`[Math Upload] Error:`, error?.message, error?.stack?.slice(0, 300));
      res.status(500).json({ error: error?.message || "업로드 처리 중 오류 발생" });
    }
  });

  // 페이지 목록 조회 (각 페이지의 문제 데이터도 함께 반환)
  app.get("/api/math-workbooks/:id/pages", async (req, res) => {
    try {
      const { actorId } = req.query as any;
      if (!actorId) return res.status(400).json({ error: "actorId required" });
      const actor = await verifyActor(actorId);
      if (!actor) return res.status(401).json({ error: "Unauthorized" });

      const pages = await db.select().from(mathWorkbookPages)
        .where(eq(mathWorkbookPages.workbookId, req.params.id))
        .orderBy(mathWorkbookPages.createdAt);

      if (pages.length === 0) {
        return res.json([]);
      }

      const pageIds = pages.map(p => p.id);
      const allProblems = await db.select().from(mathProblems)
        .where(inArray(mathProblems.pageId, pageIds));

      const problemsByPage = new Map<string, typeof allProblems>();
      for (const prob of allProblems) {
        const arr = problemsByPage.get(prob.pageId) || [];
        arr.push(prob);
        problemsByPage.set(prob.pageId, arr);
      }

      const pagesWithProblems = pages.map((p) => ({
        ...p,
        isPaid: true,
        problems: problemsByPage.get(p.id) || [],
      }));
      res.json(pagesWithProblems);
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.post("/api/math-workbooks/:id/confirm-detect", async (req, res) => {
    try {
      const { id } = req.params;
      const { actorId, centerId, pageIds } = req.body;
      if (!actorId || !centerId) return res.status(400).json({ error: "actorId and centerId required" });

      const actor = await verifyActor(actorId, UserRole.TEACHER);
      if (!actor) return res.status(403).json({ error: "Forbidden" });

      const [workbook] = await db.select().from(mathWorkbooks).where(eq(mathWorkbooks.id, id));
      if (!workbook || workbook.centerId !== centerId) return res.status(404).json({ error: "Workbook not found" });

      const targetPageIds: string[] = Array.isArray(pageIds) ? pageIds : [];
      console.log(`[Confirm-Detect] Request: workbook=${id}, targetPageIds=${targetPageIds.length}, centerId=${centerId}`);
      if (targetPageIds.length === 0) {
        console.log(`[Confirm-Detect] Rejected: no pageIds provided`);
        return res.status(400).json({ error: "pageIds가 필요합니다." });
      }

      const allPages = await db.select().from(mathWorkbookPages)
        .where(eq(mathWorkbookPages.workbookId, id))
        .orderBy(mathWorkbookPages.createdAt);

      console.log(`[Confirm-Detect] All pages: ${allPages.length}, statuses: ${allPages.map(p => p.detectionStatus || "null").join(",")}`);

      const validPageIds = new Set(allPages.map(p => p.id));
      const invalidIds = targetPageIds.filter(pid => !validPageIds.has(pid));
      if (invalidIds.length > 0) {
        console.log(`[Confirm-Detect] Rejected: invalid pageIds found (${invalidIds.length})`);
        return res.status(400).json({ error: "유효하지 않은 페이지가 포함되어 있습니다." });
      }

      const pagesToDetect = allPages.filter(p => targetPageIds.includes(p.id) && p.detectionStatus !== "completed" && p.detectionStatus !== "pending");

      if (pagesToDetect.length === 0) {
        console.log(`[Confirm-Detect] No pages to detect (all completed or pending)`);
        return res.json({ message: "감지할 페이지가 없습니다.", charged: 0 });
      }

      const totalCost = pagesToDetect.length * COST_PER_PAGE;
      const [creditRecord] = await db.select().from(smsCredits).where(eq(smsCredits.centerId, centerId));
      const currentBalance = creditRecord?.balance || 0;

      if (currentBalance < totalCost) {
        return res.status(402).json({
          error: `충전 잔액이 부족합니다. 필요: ${totalCost.toLocaleString()}원, 잔액: ${currentBalance.toLocaleString()}원`,
          needed: totalCost,
          balance: currentBalance,
        });
      }

      const deductResult = await deductCredits(centerId, pagesToDetect.length, `수학 오답노트 AI 감지 (${pagesToDetect.length}페이지)`);
      if (!deductResult.success) {
        return res.status(402).json({ error: deductResult.error || "크레딧 차감 실패" });
      }

      await db.update(mathWorkbooks).set({
        paidPages: allPages.length,
      }).where(eq(mathWorkbooks.id, id));

      for (const pg of pagesToDetect) {
        await db.update(mathWorkbookPages).set({ detectionStatus: "pending" }).where(eq(mathWorkbookPages.id, pg.id)).catch(() => {});
      }

      console.log(`[Confirm-Detect] workbook=${id}, pages=${pagesToDetect.length}, cost=${totalCost}, balance=${deductResult.balance}`);

      res.json({
        charged: totalCost,
        balance: deductResult.balance ?? 0,
        pageCount: pagesToDetect.length,
        pageIds: pagesToDetect.map(p => p.id),
      });

      cancelDetection(id);
      const abortCtrl = new AbortController();
      activeDetections.set(id, abortCtrl);
      const signal = abortCtrl.signal;

      (async () => {
        console.log(`[Auto-Detect] Background starting for workbook ${id}: ${pagesToDetect.length} pages (concurrency: ${DETECT_CONCURRENCY})`);
        const failedPages: typeof pagesToDetect = [];
        try {
          for (let i = 0; i < pagesToDetect.length; i += DETECT_CONCURRENCY) {
            if (signal.aborted) break;
            const batch = pagesToDetect.slice(i, i + DETECT_CONCURRENCY);
            await Promise.all(batch.map(async (pg) => {
              if (signal.aborted) return;
              try {
                const imageBuffer = await getImageBufferFromR2(pg.r2ObjectKey, pg.imageUrl);
                const jpgBuf = await sharp(imageBuffer).jpeg({ quality: 90 }).toBuffer();
                console.log(`[Auto-Detect] Processing page ${pg.id} (${(jpgBuf.length / 1024).toFixed(0)}KB)`);
                await autoDetectProblems(pg.id, jpgBuf, pg.width, pg.height, signal);
              } catch (e: any) {
                if (signal.aborted || e?.message === "Detection cancelled") return;
                console.error(`[Auto-Detect] Error for page ${pg.id}:`, e?.message);
                failedPages.push(pg);
                await db.update(mathWorkbookPages).set({ detectionStatus: "failed" }).where(eq(mathWorkbookPages.id, pg.id)).catch(() => {});
              }
            }));
            if (!signal.aborted && i + DETECT_CONCURRENCY < pagesToDetect.length) {
              await new Promise(r => setTimeout(r, 150));
            }
          }
          if (!signal.aborted && failedPages.length > 0) {
            console.log(`[Auto-Detect] Retrying ${failedPages.length} failed pages for workbook ${id}`);
            await new Promise(r => setTimeout(r, 5000));
            for (const pg of failedPages) {
              if (signal.aborted) break;
              try {
                await db.update(mathWorkbookPages).set({ detectionStatus: "pending" }).where(eq(mathWorkbookPages.id, pg.id)).catch(() => {});
                const imageBuffer = await getImageBufferFromR2(pg.r2ObjectKey, pg.imageUrl);
                const jpgBuf = await sharp(imageBuffer).jpeg({ quality: 90 }).toBuffer();
                console.log(`[Auto-Detect] Retry page ${pg.id} (${(jpgBuf.length / 1024).toFixed(0)}KB)`);
                await autoDetectProblems(pg.id, jpgBuf, pg.width, pg.height, signal);
                console.log(`[Auto-Detect] Retry success for page ${pg.id}`);
              } catch (e: any) {
                if (signal.aborted || e?.message === "Detection cancelled") break;
                console.error(`[Auto-Detect] Retry failed for page ${pg.id}:`, e?.message);
                await db.update(mathWorkbookPages).set({ detectionStatus: "failed" }).where(eq(mathWorkbookPages.id, pg.id)).catch(() => {});
              }
              await new Promise(r => setTimeout(r, 2000));
            }
          }
        } finally {
          activeDetections.delete(id);
          if (signal.aborted) {
            console.log(`[Auto-Detect] Cancelled for workbook ${id}, resetting pending pages`);
            await db.update(mathWorkbookPages).set({ detectionStatus: null })
              .where(and(eq(mathWorkbookPages.workbookId, id), eq(mathWorkbookPages.detectionStatus, "pending"))).catch(() => {});
          }
        }
        console.log(`[Auto-Detect] Background complete for workbook ${id} (${pagesToDetect.length} pages, ${failedPages.length} initially failed${signal.aborted ? ", CANCELLED" : ""})`);
      })();
    } catch (error: any) {
      console.error(`[Confirm-Detect] Error:`, error?.message);
      res.status(500).json({ error: error?.message || "처리 오류" });
    }
  });

  app.post("/api/math-workbooks/:id/reset-pending", async (req, res) => {
    try {
      const { actorId } = req.body;
      const actor = await verifyActor(actorId, UserRole.TEACHER);
      if (!actor) return res.status(403).json({ error: "Forbidden" });

      cancelDetection(req.params.id);

      const result = await db.update(mathWorkbookPages)
        .set({ detectionStatus: null })
        .where(and(
          eq(mathWorkbookPages.workbookId, req.params.id),
          eq(mathWorkbookPages.detectionStatus, "pending"),
        ))
        .returning({ id: mathWorkbookPages.id });

      console.log(`[Reset-Pending] workbook=${req.params.id}, reset=${result.length} pages`);
      res.json({ reset: result.length });
    } catch (error: any) {
      console.error(`[Reset-Pending] Error:`, error?.message);
      res.status(500).json({ error: error?.message });
    }
  });

  app.get("/api/math-workbook-pages/:id/image", async (req, res) => {
    try {
      const { actorId } = req.query as any;
      if (!actorId) return res.status(400).json({ error: "actorId required" });
      const actor = await verifyActor(actorId);
      if (!actor) return res.status(401).json({ error: "Unauthorized" });

      const [page] = await db.select().from(mathWorkbookPages).where(eq(mathWorkbookPages.id, req.params.id));
      if (!page) return res.status(404).json({ error: "Page not found" });
      res.json({ imageUrl: `/api/r2-proxy/${page.r2ObjectKey || page.imageUrl}` });
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.post("/api/math-workbook-pages/:id/detect", async (req, res) => {
    try {
      const { actorId, centerId } = req.body;
      const actor = await verifyActor(actorId, UserRole.TEACHER);
      if (!actor) return res.status(403).json({ error: "Forbidden" });

      const [page] = await db.select().from(mathWorkbookPages).where(eq(mathWorkbookPages.id, req.params.id));
      if (!page) return res.status(404).json({ error: "Page not found" });

      const alreadyDetected = page.detectionStatus === "completed";
      if (centerId && !alreadyDetected) {
        const deductResult = await deductCredits(centerId, 1, `AI 문제 감지 (페이지 ${page.pageNumber})`);
        if (!deductResult.success) {
          return res.status(402).json({ error: deductResult.error });
        }
      }

      const imageBuffer = await getImageBufferFromR2(page.r2ObjectKey, page.imageUrl);
      const base64Image = imageBuffer.toString("base64");
      const mimeType = "image/jpeg";

      const model = getAutoDetectModel();
      const userPrompt = `이미지 크기: ${page.width} x ${page.height} px

이 수학 문제집 페이지에서 번호가 붙은 모든 문제를 찾고 각 문제의 정확한 bounding box를 반환하세요.
각 문제 영역에는 문제 번호, 지문, 수식, 보기/선택지, 그림을 모두 포함해야 합니다.
빠짐없이 모든 문제를 감지하는 것이 가장 중요합니다.`;

      const text = await callGeminiWithRetry(model, [
        { text: AUTO_DETECT_SYSTEM_PROMPT },
        { text: userPrompt },
        { inlineData: { mimeType, data: base64Image } },
      ]);

      let parsed: any;
      try {
        parsed = repairJson(text);
      } catch {
        return res.json({ boxes: [] });
      }

      const rawProblems = parsed?.problems;
      if (!Array.isArray(rawProblems) || rawProblems.length === 0) {
        return res.json({ boxes: [] });
      }

      const filtered = parseDetectedProblems(rawProblems, page.width, page.height);
      const boxes = filtered.map(p => ({
        problemNumber: p.problemNumber,
        label: p.label || "",
        x: p.cropX,
        y: p.cropY,
        w: p.cropWidth,
        h: p.cropHeight,
      }));
      res.json({ boxes });
    } catch (error: any) {
      console.error("[Math AI Detect Error]", error?.message);
      res.status(500).json({ error: error?.message });
    }
  });

  app.patch("/api/math-workbook-pages/:id/page-number", async (req, res) => {
    try {
      const { actorId, pageNumber } = req.body;
      if (!actorId || !pageNumber) return res.status(400).json({ error: "actorId and pageNumber required" });
      const actor = await verifyActor(actorId);
      if (!actor) return res.status(403).json({ error: "Forbidden" });

      const num = Math.floor(Number(pageNumber));
      if (isNaN(num) || num < 1) return res.status(400).json({ error: "Invalid pageNumber" });

      const [updated] = await db.update(mathWorkbookPages)
        .set({ pageNumber: num })
        .where(eq(mathWorkbookPages.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ error: "Page not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.post("/api/math-workbook-pages/:id/save-boxes", async (req, res) => {
    try {
      const { boxes, actorId } = req.body;
      if (!actorId || !Array.isArray(boxes)) return res.status(400).json({ error: "actorId and boxes required" });
      const actor = await verifyActor(actorId, UserRole.TEACHER);
      if (!actor) return res.status(403).json({ error: "Forbidden" });

      const pageId = req.params.id;
      const [page] = await db.select().from(mathWorkbookPages).where(eq(mathWorkbookPages.id, pageId));
      if (!page) return res.status(404).json({ error: "Page not found" });

      const existingProblems = await db.select().from(mathProblems).where(eq(mathProblems.pageId, pageId));
      const existingIds = new Set(existingProblems.map(p => p.id));
      const incomingIds = new Set(boxes.filter((b: any) => b.existingProblemId).map((b: any) => b.existingProblemId));

      for (const id of existingIds) {
        if (!incomingIds.has(id)) {
          await db.delete(mathProblems).where(eq(mathProblems.id, id));
        }
      }

      const savedProblems: any[] = [];
      for (const box of boxes) {
        const cropX = Math.max(0, Math.round(box.x));
        const cropY = Math.max(0, Math.round(box.y));
        const cropW = Math.max(10, Math.round(box.w));
        const cropH = Math.max(10, Math.round(box.h));

        if (box.existingProblemId && existingIds.has(box.existingProblemId)) {
          const [updated] = await db.update(mathProblems).set({
            problemNumber: String(box.problemNumber || "?").slice(0, 50),
            cropX, cropY, cropWidth: cropW, cropHeight: cropH,
          }).where(eq(mathProblems.id, box.existingProblemId)).returning();
          savedProblems.push(updated);
        } else {
          const [inserted] = await db.insert(mathProblems).values({
            pageId,
            problemNumber: String(box.problemNumber || "?").slice(0, 50),
            cropX, cropY, cropWidth: cropW, cropHeight: cropH,
          }).returning();
          savedProblems.push(inserted);
        }
      }

      res.json({ problems: savedProblems });
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.get("/api/math-workbook-pages/:id/problems", async (req, res) => {
    try {
      const { actorId } = req.query as any;
      if (!actorId) return res.status(400).json({ error: "actorId required" });
      const actor = await verifyActor(actorId);
      if (!actor) return res.status(401).json({ error: "Unauthorized" });

      const problems = await db.select().from(mathProblems)
        .where(eq(mathProblems.pageId, req.params.id));
      res.json(problems);
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.post("/api/math-wrong-notes", async (req, res) => {
    try {
      const { centerId, workbookId, title, actorId, problemIds } = req.body;
      if (!centerId || !workbookId || !title || !actorId || !Array.isArray(problemIds) || problemIds.length === 0) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const actor = await verifyActor(actorId);
      if (!actor) return res.status(403).json({ error: "Forbidden" });

      const [workbook] = await db.select().from(mathWorkbooks).where(eq(mathWorkbooks.id, workbookId));
      if (!workbook || workbook.centerId !== centerId) return res.status(404).json({ error: "Workbook not found in this center" });

      const problems = await db.select().from(mathProblems).where(inArray(mathProblems.id, problemIds));

      for (const problem of problems) {
        if (!problem.imageUrl) {
          const [page] = await db.select().from(mathWorkbookPages).where(eq(mathWorkbookPages.id, problem.pageId));
          if (page && isR2Configured()) {
            try {
              const imageBuffer = await getImageBufferFromR2(page.r2ObjectKey, page.imageUrl);
              const padLeft = 20, padTop = 15;
              const x = Math.max(0, problem.cropX - padLeft);
              const y = Math.max(0, problem.cropY - padTop);
              const w = Math.min(page.width - x, problem.cropWidth + padLeft * 2);
              const h = Math.min(page.height - y, problem.cropHeight + padTop * 2);

              const cropBuffer = await sharp(imageBuffer)
                .extract({ left: x, top: y, width: Math.max(1, w), height: Math.max(1, h) })
                .jpeg({ quality: 90 })
                .toBuffer();

              const cropKey = `math-workbooks/${workbookId}/problems/${problem.id}/crop.jpg`;
              const cropUrl = await uploadBuffer(cropBuffer, cropKey, "image/jpeg");

              await db.update(mathProblems).set({
                imageUrl: cropUrl,
                r2ObjectKey: cropKey,
              }).where(eq(mathProblems.id, problem.id));
            } catch (e) {
              console.error(`[Math] Failed to crop problem ${problem.id}:`, e);
            }
          }
        }
      }

      const createdByRole = actor.role < UserRole.TEACHER ? "student" : "teacher";
      const [wrongNote] = await db.insert(mathWrongNotes).values({
        centerId, workbookId, title: String(title).slice(0, 200), createdBy: actorId, createdByRole,
      }).returning();

      for (let i = 0; i < problemIds.length; i++) {
        await db.insert(mathWrongNoteItems).values({
          wrongNoteId: wrongNote.id,
          problemId: problemIds[i],
          sortOrder: i,
        });
      }

      res.json(wrongNote);
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.get("/api/math-wrong-notes", async (req, res) => {
    try {
      const { centerId, actorId } = req.query as any;
      if (!centerId || !actorId) return res.status(400).json({ error: "centerId and actorId required" });
      const actor = await verifyActor(actorId);
      if (!actor) return res.status(401).json({ error: "Unauthorized" });

      let notes;
      if (actor.role >= UserRole.TEACHER) {
        notes = await db.select().from(mathWrongNotes)
          .where(and(
            eq(mathWrongNotes.centerId, centerId),
            isNull(mathWrongNotes.deletedAt),
            sql`COALESCE(${mathWrongNotes.createdByRole}, '') != 'student'`,
          ))
          .orderBy(desc(mathWrongNotes.createdAt));
      } else {
        const assignments = await db.select().from(mathWrongNoteStudents)
          .where(eq(mathWrongNoteStudents.studentId, actorId));
        const noteIds = assignments.map(a => a.wrongNoteId);

        const selfCreated = await db.select().from(mathWrongNotes)
          .where(and(
            eq(mathWrongNotes.createdBy, actorId),
            eq(mathWrongNotes.createdByRole, "student"),
            isNull(mathWrongNotes.deletedAt),
          ))
          .orderBy(desc(mathWrongNotes.createdAt));

        let assignedNotes: any[] = [];
        if (noteIds.length > 0) {
          assignedNotes = await db.select().from(mathWrongNotes)
            .where(and(inArray(mathWrongNotes.id, noteIds), isNull(mathWrongNotes.deletedAt)))
            .orderBy(desc(mathWrongNotes.createdAt));
        }

        const seen = new Set<string>();
        notes = [];
        for (const n of [...selfCreated, ...assignedNotes]) {
          if (!seen.has(n.id)) { seen.add(n.id); notes.push(n); }
        }
      }

      const result = await Promise.all(notes.map(async (note) => {
        const items = await db.select().from(mathWrongNoteItems).where(eq(mathWrongNoteItems.wrongNoteId, note.id));
        const students = await db.select().from(mathWrongNoteStudents).where(eq(mathWrongNoteStudents.wrongNoteId, note.id));
        const creator = await storage.getUser(note.createdBy);
        return {
          ...note,
          itemCount: items.length,
          studentCount: students.length,
          creatorName: creator?.name || "알 수 없음",
        };
      }));

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.get("/api/math-wrong-notes/student-created", async (req, res) => {
    try {
      const { actorId, centerId } = req.query as any;
      if (!actorId || !centerId) return res.status(400).json({ error: "actorId and centerId required" });
      const actor = await verifyActor(actorId, UserRole.TEACHER);
      if (!actor) return res.status(403).json({ error: "Forbidden" });

      const notes = await db.select().from(mathWrongNotes)
        .where(and(
          eq(mathWrongNotes.centerId, centerId),
          eq(mathWrongNotes.createdByRole, "student"),
          isNull(mathWrongNotes.deletedAt),
        ))
        .orderBy(desc(mathWrongNotes.createdAt));

      const creatorIds = [...new Set(notes.map(n => n.createdBy))];
      const creators = creatorIds.length > 0
        ? await Promise.all(creatorIds.map(id => storage.getUser(id)))
        : [];
      const creatorMap = new Map<string, any>();
      creators.forEach(u => { if (u) creatorMap.set(u.id, u); });

      const result = notes.map(note => {
        const creator = creatorMap.get(note.createdBy);
        return {
          ...note,
          creatorName: creator?.name || "알 수 없음",
          creatorGrade: creator?.grade || null,
        };
      });

      const studentList = creatorIds.map(id => {
        const u = creatorMap.get(id);
        const studentNotes = notes.filter(n => n.createdBy === id);
        return {
          id,
          name: u?.name || "알 수 없음",
          grade: u?.grade || null,
          noteCount: studentNotes.length,
        };
      }).sort((a, b) => a.name.localeCompare(b.name, "ko"));

      res.json({ notes: result, students: studentList });
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.get("/api/math-wrong-notes/:id", async (req, res) => {
    try {
      const { actorId } = req.query as any;
      if (!actorId) return res.status(400).json({ error: "actorId required" });
      const actor = await verifyActor(actorId);
      if (!actor) return res.status(401).json({ error: "Unauthorized" });

      const [note] = await db.select().from(mathWrongNotes).where(eq(mathWrongNotes.id, req.params.id));
      if (!note) return res.status(404).json({ error: "Not found" });

      if (actor.role < UserRole.TEACHER) {
        const isCreator = note.createdBy === actorId && note.createdByRole === "student";
        if (!isCreator) {
          const assignments = await db.select().from(mathWrongNoteStudents)
            .where(and(eq(mathWrongNoteStudents.wrongNoteId, note.id), eq(mathWrongNoteStudents.studentId, actorId)));
          if (assignments.length === 0) return res.status(403).json({ error: "Not assigned" });
        }
      }

      const items = await db.select().from(mathWrongNoteItems)
        .where(eq(mathWrongNoteItems.wrongNoteId, note.id))
        .orderBy(mathWrongNoteItems.sortOrder);

      const problems = items.length > 0
        ? await db.select().from(mathProblems).where(inArray(mathProblems.id, items.map(i => i.problemId)))
        : [];

      const students = await db.select().from(mathWrongNoteStudents)
        .where(eq(mathWrongNoteStudents.wrongNoteId, note.id));

      const studentDetails = await Promise.all(students.map(async (s) => {
        const user = await storage.getUser(s.studentId);
        const assigner = await storage.getUser(s.assignedBy);
        return { ...s, studentName: user?.name || "알 수 없음", assignerName: assigner?.name || "알 수 없음" };
      }));

      const creator = await storage.getUser(note.createdBy);

      const pageIds = [...new Set(problems.map(p => p.pageId).filter(Boolean))];
      const pages = pageIds.length > 0
        ? await db.select().from(mathWorkbookPages).where(inArray(mathWorkbookPages.id, pageIds))
        : [];
      const pageMap = new Map(pages.map(pg => [pg.id, pg]));

      const problemMap = new Map(problems.map(p => [p.id, {
        ...p,
        page: pageMap.get(p.pageId) ? {
          pageNumber: pageMap.get(p.pageId)!.pageNumber,
          imageUrl: pageMap.get(p.pageId)!.imageUrl,
          r2ObjectKey: pageMap.get(p.pageId)!.r2ObjectKey,
          width: pageMap.get(p.pageId)!.width,
          height: pageMap.get(p.pageId)!.height,
        } : null,
      }]));
      const orderedProblems = items.map(item => ({
        ...item,
        problem: problemMap.get(item.problemId) || null,
      }));

      res.json({
        ...note,
        creatorName: creator?.name || "알 수 없음",
        items: orderedProblems,
        students: studentDetails,
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.post("/api/math-wrong-notes/:id/assign-students", async (req, res) => {
    try {
      const { studentIds, actorId } = req.body;
      if (!actorId || !Array.isArray(studentIds)) return res.status(400).json({ error: "actorId and studentIds required" });

      const actor = await verifyActor(actorId, UserRole.TEACHER);
      if (!actor) return res.status(403).json({ error: "Forbidden" });

      const [note] = await db.select().from(mathWrongNotes).where(eq(mathWrongNotes.id, req.params.id));
      if (!note) return res.status(404).json({ error: "Not found" });

      const existing = await db.select().from(mathWrongNoteStudents)
        .where(eq(mathWrongNoteStudents.wrongNoteId, req.params.id));
      const existingStudentIds = new Set(existing.map(e => e.studentId));

      for (const studentId of studentIds) {
        if (!existingStudentIds.has(studentId)) {
          await db.insert(mathWrongNoteStudents).values({
            wrongNoteId: req.params.id,
            studentId,
            assignedBy: actorId,
          });
        }
      }

      const toRemove = existing.filter(e => !studentIds.includes(e.studentId));
      for (const r of toRemove) {
        await db.delete(mathWrongNoteStudents).where(eq(mathWrongNoteStudents.id, r.id));
      }

      const updatedStudents = await db.select().from(mathWrongNoteStudents)
        .where(eq(mathWrongNoteStudents.wrongNoteId, req.params.id));
      res.json(updatedStudents);
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.get("/api/math-wrong-notes/student/:studentId", async (req, res) => {
    try {
      const { actorId } = req.query as any;
      const studentId = req.params.studentId;
      if (!actorId) return res.status(400).json({ error: "actorId required" });
      const actor = await verifyActor(actorId);
      if (!actor) return res.status(401).json({ error: "Unauthorized" });
      if (actor.role < UserRole.TEACHER && actor.id !== studentId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const assignments = await db.select().from(mathWrongNoteStudents)
        .where(eq(mathWrongNoteStudents.studentId, studentId));

      const assignedNoteIds = assignments.map(a => a.wrongNoteId);

      const selfCreatedNotes = await db.select().from(mathWrongNotes)
        .where(and(
          eq(mathWrongNotes.createdBy, studentId),
          eq(mathWrongNotes.createdByRole, "student"),
          isNull(mathWrongNotes.deletedAt),
        ))
        .orderBy(desc(mathWrongNotes.createdAt));

      let assignedNotes: any[] = [];
      if (assignedNoteIds.length > 0) {
        assignedNotes = await db.select().from(mathWrongNotes)
          .where(and(inArray(mathWrongNotes.id, assignedNoteIds), isNull(mathWrongNotes.deletedAt)))
          .orderBy(desc(mathWrongNotes.createdAt));
      }

      const allNoteIds = new Set<string>();
      const allNotes: any[] = [];
      for (const note of [...selfCreatedNotes, ...assignedNotes]) {
        if (!allNoteIds.has(note.id)) {
          allNoteIds.add(note.id);
          allNotes.push(note);
        }
      }

      const result = await Promise.all(allNotes.map(async (note) => {
        const items = await db.select().from(mathWrongNoteItems).where(eq(mathWrongNoteItems.wrongNoteId, note.id));
        const creator = await storage.getUser(note.createdBy);
        const assignment = assignments.find(a => a.wrongNoteId === note.id);
        const assigner = assignment ? await storage.getUser(assignment.assignedBy) : null;
        return {
          ...note,
          itemCount: items.length,
          creatorName: creator?.name || "알 수 없음",
          assignerName: assigner?.name || null,
          assignedAt: assignment?.assignedAt || null,
          solveCount: assignment?.solveCount ?? 0,
        };
      }));

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.patch("/api/math-wrong-notes/:id/solve-count", async (req, res) => {
    try {
      const { actorId, solveCount } = req.body;
      if (!actorId) return res.status(400).json({ error: "actorId required" });

      const num = Math.floor(Number(solveCount));
      if (!Number.isFinite(num) || num < 0 || num > 9999) return res.status(400).json({ error: "Invalid solveCount" });

      const actor = await verifyActor(actorId);
      if (!actor) return res.status(401).json({ error: "Unauthorized" });

      const studentId = actor.id;

      const [assignment] = await db.select().from(mathWrongNoteStudents)
        .where(and(
          eq(mathWrongNoteStudents.wrongNoteId, req.params.id),
          eq(mathWrongNoteStudents.studentId, studentId),
        ));
      if (!assignment) return res.status(404).json({ error: "Assignment not found" });

      const [updated] = await db.update(mathWrongNoteStudents)
        .set({ solveCount: num })
        .where(eq(mathWrongNoteStudents.id, assignment.id))
        .returning();
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.delete("/api/math-workbooks/:id", async (req, res) => {
    try {
      const { actorId } = req.query as any;
      if (!actorId) return res.status(400).json({ error: "actorId required" });
      const actor = await verifyActor(actorId, UserRole.TEACHER);
      if (!actor) return res.status(403).json({ error: "Forbidden" });

      const [workbook] = await db.select().from(mathWorkbooks).where(eq(mathWorkbooks.id, req.params.id));
      if (!workbook) return res.status(404).json({ error: "Not found" });

      cancelDetection(req.params.id);
      await db.update(mathWorkbooks).set({ deletedAt: new Date() }).where(eq(mathWorkbooks.id, req.params.id));

      const wrongNotes = await db.select().from(mathWrongNotes).where(eq(mathWrongNotes.workbookId, req.params.id));
      for (const note of wrongNotes) {
        await db.update(mathWrongNotes).set({ deletedAt: new Date() }).where(eq(mathWrongNotes.id, note.id));
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.delete("/api/math-wrong-notes/:id", async (req, res) => {
    try {
      const noteId = req.params.id;
      const { actorId } = req.query as any;
      if (!actorId) return res.status(400).json({ error: "actorId required" });
      const actor = await verifyActor(actorId);
      if (!actor) return res.status(403).json({ error: "Forbidden" });

      const [note] = await db.select().from(mathWrongNotes).where(eq(mathWrongNotes.id, noteId));
      if (!note) return res.status(404).json({ error: "오답노트를 찾을 수 없습니다." });

      if (actor.role < UserRole.TEACHER && note.createdBy !== actor.id) {
        return res.status(403).json({ error: "본인이 만든 오답노트만 삭제할 수 있습니다." });
      }

      console.log(`[Math Wrong Note Delete] noteId=${noteId}, title=${note.title}, by=${actorId}`);
      await db.update(mathWrongNotes).set({ deletedAt: new Date() }).where(eq(mathWrongNotes.id, noteId));
      res.json({ success: true, deletedId: noteId });
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.delete("/api/math-workbook-pages/:id", async (req, res) => {
    try {
      const { actorId } = req.query as any;
      if (!actorId) return res.status(400).json({ error: "actorId required" });
      const actor = await verifyActor(actorId, UserRole.TEACHER);
      if (!actor) return res.status(403).json({ error: "Forbidden" });

      const [page] = await db.select().from(mathWorkbookPages).where(eq(mathWorkbookPages.id, req.params.id));
      if (!page) return res.status(404).json({ error: "Page not found" });

      cancelDetection(page.workbookId);

      const problems = await db.select().from(mathProblems).where(eq(mathProblems.pageId, page.id));
      for (const p of problems) {
        if (p.r2ObjectKey) {
          try { await deleteObject(p.r2ObjectKey); } catch {}
        }
        await db.delete(mathWrongNoteItems).where(eq(mathWrongNoteItems.problemId, p.id));
        await db.delete(mathProblems).where(eq(mathProblems.id, p.id));
      }

      if (page.r2ObjectKey) {
        try { await deleteObject(page.r2ObjectKey); } catch {}
      }
      await db.delete(mathWorkbookPages).where(eq(mathWorkbookPages.id, page.id));

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  // ===== 오답노트 폴더 관리 =====
  // === 문제집 폴더 CRUD ===
  app.get("/api/math-workbook-folders", async (req, res) => {
    try {
      const { centerId, actorId } = req.query as any;
      if (!centerId || !actorId) return res.status(400).json({ error: "centerId and actorId required" });
      const actor = await verifyActor(actorId, UserRole.TEACHER);
      if (!actor) return res.status(403).json({ error: "Forbidden" });
      const folders = await db.select().from(mathWorkbookFolders)
        .where(eq(mathWorkbookFolders.centerId, centerId))
        .orderBy(mathWorkbookFolders.name);
      res.json(folders);
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.post("/api/math-workbook-folders", async (req, res) => {
    try {
      const { centerId, name, parentId, actorId } = req.body;
      if (!centerId || !name || !actorId) return res.status(400).json({ error: "centerId, name, actorId required" });
      const actor = await verifyActor(actorId, UserRole.TEACHER);
      if (!actor) return res.status(403).json({ error: "Forbidden" });
      if (parentId) {
        const [parent] = await db.select().from(mathWorkbookFolders).where(eq(mathWorkbookFolders.id, parentId));
        if (!parent) return res.status(404).json({ error: "Parent folder not found" });
      }
      const [folder] = await db.insert(mathWorkbookFolders).values({
        centerId, name, parentId: parentId || null, createdBy: actorId,
      }).returning();
      res.json(folder);
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.patch("/api/math-workbook-folders/:id", async (req, res) => {
    try {
      const { actorId, name, parentId } = req.body;
      if (!actorId) return res.status(400).json({ error: "actorId required" });
      const actor = await verifyActor(actorId, UserRole.TEACHER);
      if (!actor) return res.status(403).json({ error: "Forbidden" });
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (parentId !== undefined) updates.parentId = parentId;
      const [folder] = await db.update(mathWorkbookFolders)
        .set(updates)
        .where(eq(mathWorkbookFolders.id, req.params.id))
        .returning();
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      res.json(folder);
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.delete("/api/math-workbook-folders/:id", async (req, res) => {
    try {
      const { actorId } = req.query as any;
      if (!actorId) return res.status(400).json({ error: "actorId required" });
      const actor = await verifyActor(actorId, UserRole.TEACHER);
      if (!actor) return res.status(403).json({ error: "Forbidden" });
      const childFolders = await db.select().from(mathWorkbookFolders)
        .where(eq(mathWorkbookFolders.parentId, req.params.id));
      if (childFolders.length > 0) {
        await db.update(mathWorkbookFolders)
          .set({ parentId: null })
          .where(eq(mathWorkbookFolders.parentId, req.params.id));
      }
      await db.update(mathWorkbooks)
        .set({ folderId: null })
        .where(eq(mathWorkbooks.folderId, req.params.id));
      await db.delete(mathWorkbookFolders).where(eq(mathWorkbookFolders.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.patch("/api/math-workbooks/:id/folder", async (req, res) => {
    try {
      const { actorId, folderId } = req.body;
      if (!actorId) return res.status(400).json({ error: "actorId required" });
      const actor = await verifyActor(actorId, UserRole.TEACHER);
      if (!actor) return res.status(403).json({ error: "Forbidden" });
      const [wb] = await db.update(mathWorkbooks)
        .set({ folderId: folderId || null })
        .where(eq(mathWorkbooks.id, req.params.id))
        .returning();
      if (!wb) return res.status(404).json({ error: "Workbook not found" });
      res.json(wb);
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.patch("/api/math-workbooks/:id/title", async (req, res) => {
    try {
      const { actorId, title } = req.body;
      if (!actorId || !title) return res.status(400).json({ error: "actorId and title required" });
      const actor = await verifyActor(actorId, UserRole.TEACHER);
      if (!actor) return res.status(403).json({ error: "Forbidden" });
      const [wb] = await db.update(mathWorkbooks)
        .set({ title })
        .where(eq(mathWorkbooks.id, req.params.id))
        .returning();
      if (!wb) return res.status(404).json({ error: "Workbook not found" });
      res.json(wb);
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.get("/api/math-wrong-note-folders", async (req, res) => {
    try {
      const { centerId, actorId } = req.query as any;
      if (!centerId || !actorId) return res.status(400).json({ error: "centerId and actorId required" });
      const actor = await verifyActor(actorId);
      if (!actor) return res.status(403).json({ error: "Forbidden" });
      if (actor.role >= UserRole.TEACHER) {
        const folders = await db.select().from(mathWrongNoteFolders)
          .where(eq(mathWrongNoteFolders.centerId, centerId))
          .orderBy(mathWrongNoteFolders.name);
        res.json(folders);
      } else {
        const folders = await db.select().from(mathWrongNoteFolders)
          .where(and(eq(mathWrongNoteFolders.centerId, centerId), eq(mathWrongNoteFolders.createdBy, actorId)))
          .orderBy(mathWrongNoteFolders.name);
        res.json(folders);
      }
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.post("/api/math-wrong-note-folders", async (req, res) => {
    try {
      const { centerId, name, parentId, actorId } = req.body;
      if (!centerId || !name || !actorId) return res.status(400).json({ error: "centerId, name, actorId required" });
      const actor = await verifyActor(actorId);
      if (!actor) return res.status(403).json({ error: "Forbidden" });
      if (parentId) {
        const [parent] = await db.select().from(mathWrongNoteFolders).where(eq(mathWrongNoteFolders.id, parentId));
        if (!parent) return res.status(404).json({ error: "Parent folder not found" });
        if (actor.role < UserRole.TEACHER && parent.createdBy !== actorId) {
          return res.status(403).json({ error: "본인이 만든 폴더에만 하위 폴더를 만들 수 있습니다." });
        }
      }
      const [folder] = await db.insert(mathWrongNoteFolders).values({
        centerId, name, parentId: parentId || null, createdBy: actorId,
      }).returning();
      res.json(folder);
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.patch("/api/math-wrong-note-folders/:id", async (req, res) => {
    try {
      const { actorId, name, parentId } = req.body;
      if (!actorId) return res.status(400).json({ error: "actorId required" });
      const actor = await verifyActor(actorId);
      if (!actor) return res.status(403).json({ error: "Forbidden" });
      const [existing] = await db.select().from(mathWrongNoteFolders).where(eq(mathWrongNoteFolders.id, req.params.id));
      if (!existing) return res.status(404).json({ error: "Folder not found" });
      if (actor.role < UserRole.TEACHER && existing.createdBy !== actorId) {
        return res.status(403).json({ error: "본인이 만든 폴더만 수정할 수 있습니다." });
      }
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (parentId !== undefined) updates.parentId = parentId;
      const [folder] = await db.update(mathWrongNoteFolders)
        .set(updates)
        .where(eq(mathWrongNoteFolders.id, req.params.id))
        .returning();
      res.json(folder);
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.delete("/api/math-wrong-note-folders/:id", async (req, res) => {
    try {
      const { actorId } = req.query as any;
      if (!actorId) return res.status(400).json({ error: "actorId required" });
      const actor = await verifyActor(actorId);
      if (!actor) return res.status(403).json({ error: "Forbidden" });
      const [existing] = await db.select().from(mathWrongNoteFolders).where(eq(mathWrongNoteFolders.id, req.params.id));
      if (!existing) return res.status(404).json({ error: "Folder not found" });
      if (actor.role < UserRole.TEACHER && existing.createdBy !== actorId) {
        return res.status(403).json({ error: "본인이 만든 폴더만 삭제할 수 있습니다." });
      }
      const childFolders = await db.select().from(mathWrongNoteFolders)
        .where(eq(mathWrongNoteFolders.parentId, req.params.id));
      if (childFolders.length > 0) {
        await db.update(mathWrongNoteFolders)
          .set({ parentId: null })
          .where(eq(mathWrongNoteFolders.parentId, req.params.id));
      }
      await db.update(mathWrongNotes)
        .set({ folderId: null })
        .where(eq(mathWrongNotes.folderId, req.params.id));
      await db.delete(mathWrongNoteFolders).where(eq(mathWrongNoteFolders.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.patch("/api/math-wrong-notes/:id/title", async (req, res) => {
    try {
      const { actorId, title } = req.body;
      if (!actorId || !title) return res.status(400).json({ error: "actorId and title required" });
      const actor = await verifyActor(actorId, UserRole.TEACHER);
      if (!actor) return res.status(403).json({ error: "Forbidden" });
      const [note] = await db.update(mathWrongNotes)
        .set({ title })
        .where(eq(mathWrongNotes.id, req.params.id))
        .returning();
      if (!note) return res.status(404).json({ error: "Note not found" });
      res.json(note);
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.patch("/api/math-wrong-notes/:id/folder", async (req, res) => {
    try {
      const { actorId, folderId } = req.body;
      if (!actorId) return res.status(400).json({ error: "actorId required" });
      const actor = await verifyActor(actorId);
      if (!actor) return res.status(403).json({ error: "Forbidden" });
      if (actor.role < UserRole.TEACHER) {
        const [existing] = await db.select().from(mathWrongNotes).where(eq(mathWrongNotes.id, req.params.id));
        if (!existing) return res.status(404).json({ error: "Note not found" });
        const isCreator = existing.createdBy === actorId;
        const isAssigned = await db.select({ id: mathWrongNoteStudents.id }).from(mathWrongNoteStudents)
          .where(and(eq(mathWrongNoteStudents.wrongNoteId, req.params.id), eq(mathWrongNoteStudents.studentId, actorId)))
          .limit(1);
        if (!isCreator && isAssigned.length === 0) {
          return res.status(403).json({ error: "본인의 오답노트만 이동할 수 있습니다." });
        }
      }
      const [note] = await db.update(mathWrongNotes)
        .set({ folderId: folderId || null })
        .where(eq(mathWrongNotes.id, req.params.id))
        .returning();
      if (!note) return res.status(404).json({ error: "Note not found" });
      res.json(note);
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  app.get("/api/math-credit-balance", async (req, res) => {
    try {
      const { centerId, actorId } = req.query as any;
      if (!centerId || !actorId) return res.status(400).json({ error: "centerId and actorId required" });
      const actor = await verifyActor(actorId, UserRole.TEACHER);
      if (!actor) return res.status(403).json({ error: "Forbidden" });

      const [credit] = await db.select().from(smsCredits).where(eq(smsCredits.centerId, centerId));
      const balance = credit?.balance ?? 0;
      console.log(`[Math Credit] centerId=${centerId}, balance=${balance}, creditRecord=${credit ? 'found' : 'not found'}`);
      res.json({ balance, costPerPage: COST_PER_PAGE });
    } catch (error: any) {
      console.error(`[Math Credit] Error:`, error?.message);
      res.status(500).json({ error: error?.message });
    }
  });
}
