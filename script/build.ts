import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

// Force garbage collection between build steps to reduce memory pressure
function forceGC() {
  if (global.gc) {
    global.gc();
  }
}

// Only bundle lightweight, essential modules - keep everything else external
// This dramatically reduces build memory usage
const allowlist = [
  "connect-pg-simple",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-session",
  "memorystore",
  "passport",
  "passport-local",
  "pg",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  console.log("=== Build starting ===");
  console.log(`Heap used: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  
  await rm("dist", { recursive: true, force: true });

  console.log("Building client (Vite)...");
  await viteBuild({
    build: {
      // Reduce memory by limiting parallelism
      minify: 'esbuild',
      sourcemap: false,
    },
    logLevel: 'warn',
  });
  
  console.log(`After Vite build - Heap used: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  forceGC();

  console.log("Building server (esbuild)...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  // Keep ALL heavy modules external
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
    // Reduce memory usage
    treeShaking: true,
  });
  
  console.log(`After esbuild - Heap used: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  console.log("=== Build complete ===");
}

buildAll().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
