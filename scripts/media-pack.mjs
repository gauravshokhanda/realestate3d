import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import dotenv from "dotenv";

dotenv.config({ path: [".env.local", ".env"], quiet: true });
const [operation, filename, ...extra] = process.argv.slice(2);
if (!["pack", "unpack"].includes(operation) || (operation === "unpack" && !filename) || extra.length) {
  throw new Error("Usage: pnpm media:pack [output.zip] or pnpm media:unpack <input.zip>");
}
const archive = path.resolve(filename ?? "media-pack.zip");
if (path.extname(archive).toLowerCase() !== ".zip") throw new Error("Choose a .zip file.");
const url = process.env.DATABASE_URL || "file:./data/app.db";
if (!url.startsWith("file:") || process.env.STORAGE_PROVIDER === "s3") throw new Error("Media packs require SQLite and LocalStorage.");
const database = path.resolve(url.slice(5));
const storage = path.resolve(process.env.STORAGE_DIR || "storage");
const originals = path.join(storage, "originals");
const tar = (...args) => execFileSync(process.env.MEDIA_TAR || (process.platform === "linux" ? "bsdtar" : "tar"), args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const directory = path.resolve(".artifacts");
mkdirSync(directory, { recursive: true });
const stage = mkdtempSync(path.join(directory, "media-pack-"));
const source = path.join(stage, "data", "app.db");
const stagedOriginals = path.join(stage, "storage", "originals");

function copySources(from, to) {
  if (!existsSync(from)) throw new Error(`Missing source folder: ${from}`);
  if (!lstatSync(from).isDirectory()) throw new Error(`Invalid source folder: ${from}`);
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (!/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(entry.name)) throw new Error(`Invalid source path: ${entry.name}`);
    const input = path.join(from, entry.name), output = path.join(to, entry.name);
    if (entry.isDirectory()) copySources(input, output);
    else if (entry.isFile()) copyFileSync(input, output);
    else throw new Error(`Unsupported source path: ${input}`);
  }
}

try {
  if (operation === "pack") {
    if (existsSync(archive)) throw new Error(`Archive already exists: ${archive}`);
    mkdirSync(path.dirname(source), { recursive: true });
    const db = new DatabaseSync(database, { readOnly: true });
    try { db.prepare("VACUUM INTO ?").run(source); }
    finally { db.close(); }
    copySources(originals, stagedOriginals);
    tar("-a", "-cf", path.join(stage, "pack.zip"), "-C", stage, "data/app.db", "storage/originals");
    mkdirSync(path.dirname(archive), { recursive: true });
    copyFileSync(path.join(stage, "pack.zip"), archive, 1);
  } else {
    const names = tar("-tf", archive).trim().split(/\r?\n/);
    const types = tar("-tvf", archive).trim().split(/\r?\n/);
    const allowed = /^(?:data\/app\.db|storage\/originals(?:\/[a-zA-Z0-9_-][a-zA-Z0-9_.-]*)*\/?)$/;
    if (!names.includes("data/app.db") || !names.includes("storage/originals/") || new Set(names.map((name) => process.platform === "win32" ? name.toLowerCase() : name)).size !== names.length || names.length !== types.length ||
      names.some((name, index) => !allowed.test(name) || !types[index].startsWith(name.endsWith("/") ? "d" : "-"))) {
      throw new Error("The ZIP may only contain data/app.db and regular files under storage/originals/.");
    }
    if (existsSync(originals)) throw new Error("Restore into an empty storage directory or move its originals aside first.");
    if (existsSync(database + "-wal") || existsSync(database + "-shm")) throw new Error("Stop the app and worker before restoring a media pack.");
    if (existsSync(database)) {
      const db = new DatabaseSync(database, { readOnly: true });
      try {
        for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations'").all()) {
          if (db.prepare(`SELECT 1 FROM "${name.replaceAll('"', '""')}" LIMIT 1`).get()) throw new Error("Restore requires an empty database. Move your existing database aside first.");
        }
      } finally { db.close(); }
    }
    tar("-xf", archive, "-C", stage);
    const restored = new DatabaseSync(source, { readOnly: true });
    try { if (restored.prepare("PRAGMA quick_check").get().quick_check !== "ok") throw new Error("Invalid SQLite snapshot."); }
    finally { restored.close(); }
    mkdirSync(storage, { recursive: true });
    if (!lstatSync(storage).isDirectory()) throw new Error("Storage root must be a real directory.");
    const temporary = mkdtempSync(path.join(storage, ".restore-"));
    const destination = path.join(temporary, "originals");
    try {
      copySources(stagedOriginals, destination);
      mkdirSync(path.dirname(database), { recursive: true });
      const stagedDatabase = database + ".restore";
      copyFileSync(source, stagedDatabase, 1);
      let published = false;
      try {
        renameSync(destination, originals);
        published = true;
        renameSync(stagedDatabase, database);
      } catch (error) {
        if (published) renameSync(originals, destination);
        throw error;
      } finally { rmSync(stagedDatabase, { force: true }); }
    } finally {
      if (path.dirname(temporary) === storage) rmSync(temporary, { recursive: true, force: true });
    }
  }
  console.log(`${archive} · ${(statSync(archive).size / 1e6).toFixed(2)} MB`);
} finally {
  if (path.dirname(stage) === directory) rmSync(stage, { recursive: true, force: true });
}
