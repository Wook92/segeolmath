import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, readFile, rm, readdir, access } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import sharp from "sharp";

const execFileAsync = promisify(execFile);

export interface PageImage {
  pageNumber: number;
  buffer: Buffer;
  width: number;
  height: number;
}

async function convertWithPdfjs(pdfBuffer: Buffer, dpi: number): Promise<PageImage[]> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const data = new Uint8Array(pdfBuffer);
  const pdf = await (pdfjs as any).getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    verbosity: 0,
  }).promise;

  const scale = dpi / 72;
  const results: PageImage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const w = Math.round(viewport.width);
    const h = Math.round(viewport.height);
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext("2d");

    await page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    const buffer = canvas.toBuffer("image/png");
    results.push({ pageNumber: i, buffer: Buffer.from(buffer), width: w, height: h });
  }

  return results;
}

async function findBinary(candidates: string[], command: string): Promise<string | null> {
  for (const p of candidates) {
    try {
      await access(p);
      return p;
    } catch {}
  }
  try {
    const { stdout } = await execFileAsync("which", [command], { timeout: 5000 });
    const resolved = stdout.trim();
    if (resolved) return resolved;
  } catch {}
  return null;
}

async function convertWithPdftoppm(pdfPath: string, tmpDir: string, dpi: number): Promise<string[]> {
  const bin = await findBinary(["/usr/bin/pdftoppm", "/usr/local/bin/pdftoppm"], "pdftoppm");
  if (!bin) throw new Error("pdftoppm not found");

  const prefix = join(tmpDir, "page");
  await execFileAsync(bin, ["-r", String(dpi), "-png", pdfPath, prefix], { timeout: 120000 });

  const files = await readdir(tmpDir);
  return files
    .filter(f => f.startsWith("page") && f.endsWith(".png"))
    .sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, "")) || 0;
      const numB = parseInt(b.replace(/\D/g, "")) || 0;
      return numA - numB;
    })
    .map(f => join(tmpDir, f));
}

async function convertWithGhostscript(pdfPath: string, tmpDir: string, dpi: number): Promise<string[]> {
  const bin = await findBinary(["/usr/bin/gs", "/usr/local/bin/gs"], "gs");
  if (!bin) throw new Error("ghostscript not found");

  const pattern = join(tmpDir, "page-%04d.png");
  await execFileAsync(bin, [
    "-dNOPAUSE", "-dBATCH", "-dSAFER",
    "-sDEVICE=pngalpha", `-r${dpi}`,
    `-sOutputFile=${pattern}`, pdfPath,
  ], { timeout: 120000 });

  const files = await readdir(tmpDir);
  return files
    .filter(f => f.startsWith("page-") && f.endsWith(".png"))
    .sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, "")) || 0;
      const numB = parseInt(b.replace(/\D/g, "")) || 0;
      return numA - numB;
    })
    .map(f => join(tmpDir, f));
}

export async function convertPdfToImages(pdfBuffer: Buffer): Promise<PageImage[]> {
  const dpi = 192;

  try {
    const results = await convertWithPdfjs(pdfBuffer, dpi);
    console.log(`[pdf] pdfjs-dist 사용, ${results.length}개 페이지`);
    return results;
  } catch (e: any) {
    console.warn(`[pdf] pdfjs-dist 실패: ${e.message}`);
  }

  const tmpDir = await mkdtemp(join(tmpdir(), "pdf-"));
  const pdfPath = join(tmpDir, "input.pdf");

  try {
    await writeFile(pdfPath, pdfBuffer);

    let files: string[];
    try {
      files = await convertWithPdftoppm(pdfPath, tmpDir, dpi);
      console.log(`[pdf] pdftoppm 사용, ${files.length}개 페이지`);
    } catch (e2: any) {
      console.warn(`[pdf] pdftoppm 실패: ${e2.message}`);
      files = await convertWithGhostscript(pdfPath, tmpDir, dpi);
      console.log(`[pdf] ghostscript 사용, ${files.length}개 페이지`);
    }

    if (files.length === 0) throw new Error("PDF 변환 결과 없음");

    const results: PageImage[] = [];
    for (let i = 0; i < files.length; i++) {
      const buf = await readFile(files[i]);
      const meta = await sharp(buf).metadata();
      results.push({
        pageNumber: i + 1,
        buffer: buf,
        width: meta.width!,
        height: meta.height!,
      });
    }
    return results;
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
