import type { Scene } from "@/data/scenes";
export type WindowRequest =
  | { type: "attach"; id: number; canvas?: OffscreenCanvas; mobile: boolean }
  | { type: "load"; id: number; generation: number; scene: Scene; index: number; foreground: boolean }
  | { type: "seek"; id: number; index: number; target: number; foreground: boolean }
  | { type: "resize"; id: number; width: number; height: number; dpr: number }
  | { type: "release"; id: number }
  | { type: "detach"; id: number }
  | { type: "profile"; id: number; mobile: boolean }
  | { type: "delivered"; id: number; delivery: number };
export type CacheStats = { frames: number; bytes: number; reserved: number; budget: number; peak: number; decoded: number };
export type WindowReply =
  | { type: "crossfade"; id: number; generation: number; from: number; to: number }
  | { type: "painted"; id: number; generation: number; index: number; target: number; bitmap?: ImageBitmap; delivery?: number; jump: boolean }
  | { type: "ready"; id: number; generation: number; count: number }
  | { type: "error"; id: number; generation: number; message: string }
  | { type: "resources"; stats: CacheStats };
