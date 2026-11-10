import path from "node:path";

/** Interpret local database URLs relative to the project, not prisma/schema.prisma. */
export function databaseUrl() {
  const value = process.env.DATABASE_URL || "file:./data/app.db";
  return value.startsWith("file:") ? `file:${path.resolve(value.slice(5)).replaceAll("\\", "/")}` : value;
}
