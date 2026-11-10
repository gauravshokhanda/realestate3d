import "dotenv/config";
import { defineConfig } from "prisma/config";
import { databaseUrl } from "./lib/database-url";
import { closeSync, mkdirSync, openSync } from "node:fs";
import path from "node:path";

process.env.DATABASE_URL = databaseUrl();
// The Windows schema engine expects the SQLite file to exist before connecting.
if (process.env.DATABASE_URL.startsWith("file:")) {
  const filename = process.env.DATABASE_URL.slice(5);
  mkdirSync(path.dirname(filename), { recursive: true });
  try { closeSync(openSync(filename, "wx")); } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
});
