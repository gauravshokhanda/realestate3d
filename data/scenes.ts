export type Scene = {
  id: string;
  folder: string;
  frameCount: number;
  mobileFolder?: string;
  mobileFrameCount?: number;
  pad: number;
  ext: "webp";
  scrollLength: number;
  stillFrames?: string[];
  revision?: string;
};

export function frameUrl(scene: Scene, index: number): string {
  return scene.stillFrames?.[Math.min(index, scene.stillFrames.length - 1)] ?? `${scene.folder}/frame_${String(index + 1).padStart(scene.pad, "0")}.${scene.ext}${scene.revision ? `?v=${encodeURIComponent(scene.revision)}` : ""}`;
}
