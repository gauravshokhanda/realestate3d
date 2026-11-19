import type { Scene } from "@/data/scenes";

export type WorkerRequest =
  | { type: "init"; canvas: OffscreenCanvas }
  | { type: "load"; id: number; scene: Scene; priority: RequestPriority }
  | { type: "release"; id: number }
  | { type: "draw"; id: number; index: number }
  | { type: "resize"; width: number; height: number; dpr: number };

export type WorkerReply =
  | { type: "progress"; id: number; value: number }
  | { type: "ready"; id: number; count: number }
  | { type: "painted"; id: number; index: number }
  | { type: "error"; id: number; message: string }
  | { type: "resources"; decoded: number; live: number; bytes: number };
