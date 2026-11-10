import ffmpeg from "ffmpeg-static";
import ts from "typescript";
import sharp from "sharp";
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, cp, lstat, mkdir, mkdtemp, open, readFile, readdir, rename, rm, stat, statfs, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

sharp.cache(false); // Release Windows file handles before replacing blended frames.

const root = fileURLToPath(new URL("../", import.meta.url));
const sequencesRoot = path.join(root, "public", "sequences");
const configPath = path.join(root, "prisma", "seed-data.ts");
const framePattern = /^frame_\d+\.webp$/i;
const variants = [
  { name: "desktop", suffix: "", fps: 24, width: 1280, quality: 72, maxBytes: 8 * 1048576 },
  { name: "mobile", suffix: "-mobile", fps: 15, width: 640, quality: 65, maxBytes: 3 * 1048576 },
];

async function requireSpace() {
  const space = await statfs(sequencesRoot);
  if (space.bavail * space.bsize < 2 * 1024 ** 3) throw new Error("Storage drive has less than 2 GB free. Free space before extracting; existing assets were retained.");
}

async function videoDuration(input) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, ["-hide_banner", "-i", input], { windowsHide: true, shell: false, stdio: ["ignore", "ignore", "pipe"] });
    let text = ""; child.stderr.on("data", (chunk) => { text = (text + chunk).slice(-16000); }); child.on("error", reject);
    child.on("close", () => { const match = text.match(/Duration: (\d+):(\d+):([\d.]+)/); if (!match) reject(new Error("Cannot determine video duration.")); else resolve(Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])); });
  });
}

async function exists(filename) {
  try { return await lstat(filename); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

async function requireDirectory(directory) {
  const entry = await exists(directory);
  if (entry && (!entry.isDirectory() || entry.isSymbolicLink())) throw new Error(`Expected an ordinary directory: ${directory}`);
  if (!entry) await mkdir(directory);
}

function sceneEditor(source, sceneId) {
  const file = ts.createSourceFile(configPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (file.parseDiagnostics.length) throw new Error("prisma/seed-data.ts has syntax errors. Fix them before importing assets.");
  let declaration;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === "scenes") declaration = node;
    ts.forEachChild(node, visit);
  }
  visit(file);
  let array = declaration?.initializer;
  while (array && (ts.isSatisfiesExpression(array) || ts.isAsExpression(array) || ts.isParenthesizedExpression(array))) array = array.expression;
  if (!array || !ts.isArrayLiteralExpression(array)) throw new Error("prisma/seed-data.ts must declare a literal scenes array.");
  const property = (node, name) => node.properties.find((item) => ts.isPropertyAssignment(item) && (ts.isIdentifier(item.name) || ts.isStringLiteral(item.name)) && item.name.text === name);
  const objects = array.elements.filter(ts.isObjectLiteralExpression);
  const matches = objects.filter((node) => property(node, "id")?.initializer.text === sceneId);
  if (matches.length !== 1) {
    const known = objects.map((node) => property(node, "id")?.initializer.text).filter(Boolean);
    throw new Error(`Unknown or duplicate scene ID "${sceneId}". Registered scenes: ${known.join(", ")}`);
  }
  const object = matches[0];
  for (const [key, expected] of [["folder", `/sequences/${sceneId}`], ["pad", 4], ["ext", "webp"]]) {
    if (property(object, key)?.initializer.text !== String(expected)) throw new Error(`Scene ${sceneId} must use ${key}: ${JSON.stringify(expected)}.`);
  }
  const mobileFolder = property(object, "mobileFolder");
  if (mobileFolder && mobileFolder.initializer.text !== `/sequences/${sceneId}-mobile`) throw new Error("The registered mobile folder does not match the scene ID.");
  return (counts) => {
    const edits = [];
    const additions = [];
    for (const [key, value] of Object.entries({ frameCount: counts.desktop, mobileFrameCount: counts.mobile, mobileFolder: `/sequences/${sceneId}-mobile` })) {
      const current = property(object, key);
      const text = JSON.stringify(value);
      if (current) edits.push({ start: current.initializer.getStart(file), end: current.initializer.end, text });
      else additions.push(`${key}: ${text}`);
    }
    if (additions.length) {
      const end = object.properties[object.properties.length - 1].end;
      edits.push({ start: end, end, text: `, ${additions.join(", ")}` });
    }
    return edits.sort((a, b) => b.start - a.start).reduce((text, edit) => text.slice(0, edit.start) + edit.text + text.slice(edit.end), source);
  };
}

function parseOptions(args) {
  const options = { start: 0, end: undefined, delogo: undefined };
  const seen = new Set();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!["--start", "--end", "--delogo"].includes(flag) || value === undefined || seen.has(flag)) throw new Error(`Invalid or duplicate option: ${flag}`);
    seen.add(flag);
    if (flag === "--delogo") {
      if (!/^\d+:\d+:[1-9]\d*:[1-9]\d*$/.test(value)) throw new Error("--delogo must be x:y:w:h with nonnegative coordinates and positive dimensions.");
      const [x, y, w, h] = value.split(":");
      options.delogo = `delogo=x=${x}:y=${y}:w=${w}:h=${h}`;
    } else {
      if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) || !Number.isFinite(Number(value))) throw new Error(`${flag} must be a finite nonnegative number of seconds.`);
      options[flag.slice(2)] = Number(value);
    }
  }
  if (options.end !== undefined && options.end <= options.start) throw new Error("--end must be greater than --start (both refer to source timestamps).");
  return options;
}

async function crossfade(directory, variant, sceneId) {
  if (!sceneId.startsWith("plan-to-")) return;
  const heroFolder = path.join(sequencesRoot, "hero-to-plan" + variant.suffix);
  const heroFrames = (await readdir(heroFolder)).filter((name) => framePattern.test(name)).sort();
  if (!heroFrames.length) throw new Error("Import hero-to-plan before importing room scenes.");
  const source = path.join(heroFolder, heroFrames.at(-1));
  const files = (await readdir(directory)).filter((name) => framePattern.test(name)).sort();
  const steps = Math.min(4, files.length);
  for (let index = 0; index < steps - 1; index++) {
    const filename = path.join(directory, files[index]);
    const { width, height } = await sharp(filename).metadata();
    const overlay = await sharp(source).resize(width, height, { fit: "cover" }).removeAlpha().ensureAlpha(1 - index / (steps - 1)).png().toBuffer();
    const output = await sharp(filename).composite([{ input: overlay }]).webp({ quality: variant.quality }).toBuffer();
    await writeFile(filename, output);
  }
  console.log(`Applied ${steps}-frame opening crossfade from hero-to-plan${variant.suffix}.`);
}

function extract(input, directory, variant, options, signal) {
  const filters = [
    `trim=start=${options.start}${options.end === undefined ? "" : `:end=${options.end}`}`,
    "setpts=PTS-STARTPTS",
    options.delogo,
    `fps=${variant.fps}`,
    `scale=w='min(iw,${variant.width})':h=-2`,
  ].filter(Boolean).join(",");
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, [
      "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", input,
      "-map", "0:v:0", "-an", "-vf", filters,
      "-frames:v", "240", "-c:v", "libwebp", "-quality", String(variant.quality), "-threads", "2",
      "-start_number", "1", "-f", "image2", path.join(directory, "frame_%04d.webp"),
    ], { shell: false, stdio: ["ignore", "ignore", "pipe"], signal });
    let stderr = "";
    let spawnError;
    child.stderr.on("data", (chunk) => { stderr = (stderr + chunk).slice(-16000); });
    child.on("error", (error) => { spawnError = error; });
    child.on("close", (code) => {
      if (spawnError || code !== 0) reject(new Error(`ffmpeg ${variant.name} extraction failed: ${spawnError?.message || stderr.trim() || `exit ${code}`}`));
      else resolve();
    });
  });
}

async function measure(directory) {
  const frames = (await readdir(directory)).filter((name) => framePattern.test(name));
  if (!frames.length) throw new Error("The video produced no frames; existing assets were preserved.");
  let bytes = 0;
  for (let index = 1; index <= frames.length; index++) bytes += (await stat(path.join(directory, `frame_${String(index).padStart(4, "0")}.webp`))).size;
  return { count: frames.length, bytes };
}

async function main() {
  const [video, sceneId, ...extra] = process.argv.slice(2);
  if (!video || !sceneId) throw new Error("Usage: pnpm run import <video.mp4> <sceneId> [--start seconds] [--end seconds] [--delogo x:y:w:h]");
  const options = parseOptions(extra);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sceneId)) throw new Error("Scene IDs may contain lowercase letters, numbers, and single hyphens only.");
  const input = path.resolve(video);
  if (!(await stat(input)).isFile()) throw new Error(`Not a video file: ${input}`);
  if (!ffmpeg) throw new Error("ffmpeg-static does not support this platform.");
  try { await access(ffmpeg, constants.X_OK); } catch { throw new Error("Bundled ffmpeg is missing. Run pnpm install and pnpm rebuild ffmpeg-static."); }
  if ((await lstat(configPath)).isSymbolicLink()) throw new Error("prisma/seed-data.ts must not be a symlink.");
  const original = await readFile(configPath, "utf8");
  const updateScene = sceneEditor(original, sceneId);
  // Validate all output paths before extracting, moving, or removing anything.
  await requireDirectory(path.join(root, "public"));
  await requireDirectory(sequencesRoot);
  await requireSpace();
  const duration = (options.end ?? await videoDuration(input)) - options.start;
  if (duration <= 0) throw new Error("Trim must end after it starts.");
  const outputs = variants.map((variant) => ({ ...variant, fps: Math.min(variant.fps, 239.5 / duration), target: path.join(sequencesRoot, sceneId + variant.suffix) }));
  for (const output of outputs) {
    if (path.dirname(output.target) !== sequencesRoot) throw new Error("Output escaped public/sequences.");
    const entry = await exists(output.target);
    if (entry && (!entry.isDirectory() || entry.isSymbolicLink())) throw new Error(`Refusing to replace a symlink or non-directory: ${output.target}`);
  }
  const lockPath = path.join(root, ".sequence-import.lock");
  let lock;
  try { lock = await open(lockPath, "wx"); } catch (error) {
    if (error.code === "EEXIST") throw new Error("Another sequence import is running. Remove .sequence-import.lock only if a previous importer crashed.");
    throw error;
  }
  let staging;
  const configTemp = path.join(root, "prisma", `.scenes-import-${randomUUID()}.tmp`);
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.once("SIGINT", abort);
  process.once("SIGTERM", abort);
  const transactions = [];
  let committed = false;
  let retainStaging = false;
  try {
    staging = await mkdtemp(path.join(sequencesRoot, `.import-${sceneId}-`));
    const counts = {};
    for (const output of outputs) {
      output.staged = path.join(staging, output.name);
      await mkdir(output.staged);
      console.log(`Extracting ${sceneId}${output.suffix}: ${output.fps}fps, up to ${output.width}px (no upscale), quality ${output.quality}…`);
      for (let attempt = 0; attempt < 9; attempt++) {
        await requireSpace();
        for (const file of await readdir(output.staged)) if (framePattern.test(file)) await rm(path.join(output.staged, file));
        await extract(input, output.staged, output, options, controller.signal);
        await crossfade(output.staged, output, sceneId);
        output.stats = await measure(output.staged);
        if (output.stats.bytes <= output.maxBytes) break;
        if (output.quality > 42) output.quality = Math.max(42, output.quality - 8); else output.fps = Math.max(5, output.fps * .75);
      }
      if (output.stats.bytes > output.maxBytes) throw new Error(`Scene exceeds its ${output.maxBytes / 1048576} MiB frame budget. Use a shorter trim.`);
      counts[output.name] = output.stats.count;
      // Non-frame files are retained; old frame files never enter the new directory.
      if (await exists(output.target)) {
        for (const name of await readdir(output.target)) {
          if (!framePattern.test(name)) await cp(path.join(output.target, name), path.join(output.staged, name), { recursive: true, dereference: false });
        }
      }
    }
    if (controller.signal.aborted) throw new Error("Import cancelled.");
    if (await readFile(configPath, "utf8") !== original) throw new Error("prisma/seed-data.ts changed during extraction. Import cancelled without replacing assets.");
    await writeFile(configTemp, updateScene(counts), { flag: "wx" });
    for (const output of outputs) {
      const transaction = { ...output, backup: path.join(staging, `${output.name}-previous`), movedOld: false, published: false };
      transactions.push(transaction);
      if (await exists(output.target)) { await rename(output.target, transaction.backup); transaction.movedOld = true; }
      await rename(output.staged, output.target);
      transaction.published = true;
    }
    await rename(configTemp, configPath);
    committed = true;
    for (const output of outputs) {
      const mb = output.stats.bytes / 1_000_000;
      console.log(`${sceneId}${output.suffix}: ${output.stats.count} frames · ${mb.toFixed(2)} MB`);
      if (output.name === "desktop" && mb > 8) console.warn(`Warning: ${sceneId} desktop exceeds 8 MB (${mb.toFixed(2)} MB). Consider a shorter video.`);
    }
    console.log(`Total for ${sceneId}: ${(outputs.reduce((sum, output) => sum + output.stats.bytes, 0) / 1_000_000).toFixed(2)} MB. Updated prisma/seed-data.ts.`);
  } catch (error) {
    const rollbackErrors = [];
    if (!committed) for (const transaction of transactions.toReversed()) {
      try {
        if (transaction.published) await rename(transaction.target, transaction.staged);
        if (transaction.movedOld) await rename(transaction.backup, transaction.target);
      } catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }
    if (rollbackErrors.length) {
      retainStaging = true;
      throw new AggregateError([error, ...rollbackErrors], `Import failed and restoration was incomplete. Original asset backups are retained at ${staging}.`);
    }
    throw error;
  } finally {
    process.removeListener("SIGINT", abort);
    process.removeListener("SIGTERM", abort);
    await rm(configTemp, { force: true });
    // Only remove this invocation's owned temporary directory, inside the verified root.
    if (!retainStaging && staging && path.dirname(staging) === sequencesRoot && path.basename(staging).startsWith(`.import-${sceneId}-`)) {
      await rm(staging, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch((error) => console.warn(`Temporary import files remain at ${staging}: ${error.message}`));
    }
    await lock.close();
    await rm(lockPath, { force: true });
    if (!committed && !retainStaging) console.error("Import did not complete; original assets and counts were retained.");
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "Sequence import failed."); process.exitCode = 1; });
