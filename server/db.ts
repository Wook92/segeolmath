import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";
import { schemaSql } from "./schema-sql";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const client = postgres(process.env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inDollarQuote = false;

  const lines = sql.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();

    if (!inDollarQuote && trimmed.startsWith("DO $$")) {
      inDollarQuote = true;
      current = line;
      continue;
    }

    if (inDollarQuote) {
      current += "\n" + line;
      if (trimmed === "END $$;" || trimmed.endsWith("END $$;")) {
        statements.push(current.trim());
        current = "";
        inDollarQuote = false;
      }
      continue;
    }

    current += "\n" + line;
    if (trimmed.endsWith(";") && !inDollarQuote) {
      const stmt = current.trim().replace(/;$/, "").trim();
      if (stmt.length > 0) {
        statements.push(stmt);
      }
      current = "";
    }
  }

  if (current.trim().length > 0) {
    const stmt = current.trim().replace(/;$/, "").trim();
    if (stmt.length > 0) statements.push(stmt);
  }

  return statements;
}

async function runMigrationsOnDb(dbUrl: string, label: string) {
  console.log(`[SCHEMA] Starting migrations on ${label} (DB URL length: ${dbUrl.length})`);
  
  const migrationClient = postgres(dbUrl, { 
    max: 1,
    onnotice: () => {}
  });

  const statements = splitSqlStatements(schemaSql);
  let succeeded = 0;
  let failed = 0;
  const realFailures: string[] = [];

  for (const stmt of statements) {
    try {
      await migrationClient.unsafe(stmt);
      succeeded++;
    } catch (error: any) {
      failed++;
      const msg = error?.message || "";
      if (!msg.includes("already exists") && !msg.includes("duplicate")) {
        const shortStmt = stmt.substring(0, 120);
        console.error(`[SCHEMA][${label}] Failed: ${shortStmt}... => ${msg}`);
        realFailures.push(`${shortStmt} => ${msg}`);
      }
    }
  }

  console.log(`[SCHEMA][${label}] Completed: ${succeeded} succeeded, ${failed} skipped/failed (${statements.length} total statements)`);
  if (realFailures.length > 0) {
    console.error(`[SCHEMA][${label}] ${realFailures.length} real failures detected`);
  }

  await migrationClient.end();
}

export async function runMigrations() {
  await runMigrationsOnDb(process.env.DATABASE_URL!, "primary");
  
  if (process.env.NEW_NEON_DATABASE_URL && process.env.NEW_NEON_DATABASE_URL !== process.env.DATABASE_URL) {
    try {
      await runMigrationsOnDb(process.env.NEW_NEON_DATABASE_URL, "neon");
    } catch (error: any) {
      console.error(`[SCHEMA][neon] Migration failed: ${error?.message}`);
    }
  }
}
