---
name: Schema apply & typecheck workflow
description: How DB schema changes actually reach the dev DB, and why tsc must be avoided in-sandbox.
---

# Applying schema changes (dual-schema project)

Schema changes need BOTH `shared/schema.ts` (Drizzle) and `server/schema-sql.ts` (raw SQL).
The raw SQL is the one that actually runs: on every server boot, `server/db.ts` (`runMigrationsOnDb`) splits `schemaSql` and executes each statement, ignoring "already exists"/"duplicate" errors.

**How to apply on dev:** add `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` to `server/schema-sql.ts`, then just restart the "Start application" workflow. The boot log prints `[SCHEMA][primary] Completed: N succeeded, 0 skipped/failed`.

**Why not `npm run db:push`:** it is interactive and pauses on unrelated prompts (e.g. a `feature_categories` unique-constraint truncation prompt) — risky and blocks. Avoid it; use the schema-sql + restart path instead.

**Note:** boot also tries a `neon` migration that fails with `[SCHEMA][neon] Migration failed: Invalid URL` — this is pre-existing/unrelated (external prod DB) and not caused by your changes.

# Typecheck in this repo

Full `npx tsc --noEmit` takes longer than the 120s bash sandbox limit and backgrounded runs get killed when the shell session ends — it will not complete here.
**Use `getLatestLspDiagnostics({ filePath })`** (diagnostics skill, via code_execution) to validate changed files instead. It returns per-file type errors quickly without a whole-project compile.

**Stale LSP for newly created files:** After creating a brand-new file, `getLatestLspDiagnostics` may keep reporting "Cannot find module" for its import (with outdated line numbers) even after touch/edits — it's a stale cache, not a real error. Verify instead via Vite serving the module (`curl /src/pages/<file>.tsx`) and by checking the diagnostic's line number against the current file.
