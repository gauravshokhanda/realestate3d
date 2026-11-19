import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import dotenv from "dotenv";

dotenv.config({ path: [".env.local", ".env"], quiet: true });
const value = process.env.DATABASE_URL || "file:./data/app.db";
if (!value.startsWith("file:")) throw new Error("The local CRM data migration requires SQLite.");
const database = path.resolve(value.slice(5));
const require = createRequire(import.meta.url);
const open = (filename) => new DatabaseSync(filename, { readOnly: true });
const hasTable = (db, name) => Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
const compare = (db, legacy, query, oldQuery = query) => assert.deepEqual(db.prepare(query).all(), legacy.prepare(oldQuery).all());
let backup;
if (existsSync(database)) {
  const existing = open(database);
  try {
    if (hasTable(existing, "Unit")) {
      const folder = path.resolve(".artifacts", "crm");
      mkdirSync(folder, { recursive: true });
      backup = path.join(folder, `pre-development-${Date.now()}.db`);
      existing.prepare("VACUUM INTO ?").run(backup);
      console.log(`SQLite backup: ${backup}`);
    }
  } finally { existing.close(); }
}
execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "deploy"], { stdio: "inherit" });
const db = open(database);
try {
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal(db.prepare("PRAGMA quick_check").get().quick_check, "ok");
  assert(!hasTable(db, "Unit"), "The Unit table should be replaced by Property.");
  if (backup) {
    const legacy = open(backup);
    try {
      compare(db, legacy, 'SELECT id, slug, name, tagline, location, buildingImage, createdAt, updatedAt FROM Development ORDER BY id', 'SELECT id, slug, name, tagline, location, towerImage AS buildingImage, createdAt, updatedAt FROM Property ORDER BY id');
      compare(db, legacy, 'SELECT id, status, planImage, heroCopy, accentColor, presentation, amenities FROM Property WHERE id = developmentId ORDER BY id', 'SELECT id, status, planImage, heroCopy, accentColor, presentation, amenities FROM Property ORDER BY id');
      compare(db, legacy, 'SELECT legacyUnitId AS id, developmentId AS propertyId, name, beds, baths, sqft, price, roomSettings FROM Property WHERE legacyUnitId IS NOT NULL ORDER BY legacyUnitId', 'SELECT id, propertyId, name, beds, baths, sqft, price, roomSettings FROM Unit ORDER BY id');
      for (const table of ["Room", "PanoNode", "Scene"]) {
        const columns = legacy.prepare(`PRAGMA table_info("${table}")`).all().map(({ name }) => `"${name}"`).join(", ");
        compare(db, legacy, `SELECT ${columns} FROM "${table}" ORDER BY id`);
      }
      const aurelia = db.prepare("SELECT slug, status, polygon, focus FROM Property WHERE developmentId = (SELECT id FROM Development WHERE slug = 'aurelia') ORDER BY \"order\"").all();
      if (aurelia.length) {
        assert.equal(aurelia[0].slug, "residence-a");
        assert.equal(JSON.parse(aurelia[0].polygon).length, 4);
        assert.equal(JSON.parse(aurelia[0].focus).cx, 0.5);
        const alternate = aurelia.find(({ slug }) => slug === "residence-b");
        if (alternate) assert.equal(alternate.status, "draft");
      }
      console.log("Verified development fields, residence specs, tour presentation, rooms, panoramas and scenes against the backup.");
    } finally { legacy.close(); }
  } else console.log("Database integrity verified. No legacy data needed migration.");
} finally { db.close(); }
