import ffmpeg from "ffmpeg-static";
import { spawn } from "node:child_process";

export async function runFfmpeg(args: string[], options: { capture?: boolean; maxBytes?: number; timeout?: number } = {}) {
  if (!ffmpeg) throw new Error("ffmpeg-static is unavailable on this platform.");
  const binary = ffmpeg;
  return new Promise<{ stdout: Buffer; stderr: string }>((resolve, reject) => {
    const child = spawn(binary, ["-hide_banner", "-nostdin", ...args], { shell: false, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stderr = "", length = 0, failure: Error | null = null;
    const chunks: Buffer[] = [];
    const stop = (error: Error) => { failure = error; child.kill("SIGKILL"); };
    const timer = setTimeout(() => stop(new Error("Video processing timed out. Upload a shorter MP4 (up to 120 seconds).")), options.timeout ?? 180_000);
    child.stdout.on("data", (chunk: Buffer) => { if (!options.capture) return; length += chunk.length; if (length > (options.maxBytes ?? 8_000_000)) stop(new Error("Decoded video exceeded the analysis limit.")); else chunks.push(chunk); });
    child.stderr.on("data", (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-16000); });
    child.on("error", (error) => { failure = error; });
    child.on("close", (code) => { clearTimeout(timer); if (failure || code !== 0) reject(failure ?? new Error(`Unable to decode video: ${stderr.slice(-1200)}`)); else resolve({ stdout: Buffer.concat(chunks), stderr }); });
  });
}
export async function probeVideo(file: string) {
  const { stderr } = await runFfmpeg(["-i", file, "-map", "0:v:0", "-frames:v", "1", "-f", "null", "-"]);
  const duration = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const dimensions = stderr.split("\n").find((line) => /Stream.*Video:/.test(line))?.match(/\b(\d{2,5})x(\d{2,5})\b/);
  if (!duration || !dimensions) throw new Error("The MP4 must contain a readable video track and duration.");
  const seconds = Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]);
  const width = Number(dimensions[1]), height = Number(dimensions[2]);
  if (seconds < 0.1 || seconds > 120 || width > 4096 || height > 4096) throw new Error("Use an MP4 between 0.1 and 120 seconds, with each edge at most 4096px.");
  return { duration: seconds, width, height };
}
