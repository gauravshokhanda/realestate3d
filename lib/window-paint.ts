import type { Scene } from "@/data/scenes";
import type { WindowReply } from "./window-protocol";

export type View = {
  id: number; generation: number; mobile: boolean; scene?: Scene; index: number; target: number; direction: number; foreground: boolean;
  canvas?: OffscreenCanvas; context?: OffscreenCanvasRenderingContext2D | null; width: number; height: number; dpr: number;
  drawn: number; ready: boolean; jump: boolean; snapshot?: OffscreenCanvas; fadeStart?: number; timer?: ReturnType<typeof setTimeout>;
  copyPending?: boolean; hasPainted?: boolean;
  frameBytes?: number;
};
export function cover(context: OffscreenCanvasRenderingContext2D, image: ImageBitmap | OffscreenCanvas, view: View) {
  const scale = Math.max(view.width / image.width, view.height / image.height);
  context.drawImage(image, (view.width - image.width * scale) / 2, (view.height - image.height * scale) / 2, image.width * scale, image.height * scale);
}
export function cancelFade(view: View) { clearTimeout(view.timer); view.snapshot = undefined; view.fadeStart = undefined; }
export function paint(view: View, bitmap: ImageBitmap, index: number, send: (reply: WindowReply, transfer?: Transferable[]) => void) {
  if (view.context && view.canvas) {
    if (view.jump && view.hasPainted && !view.snapshot && Math.abs(index - view.target) <= 3) {
      view.snapshot = new OffscreenCanvas(view.canvas.width, view.canvas.height);
      view.snapshot.getContext("2d", { alpha: false })?.drawImage(view.canvas, 0, 0); view.fadeStart = performance.now();
      send({ type: "crossfade", id: view.id, generation: view.generation, from: view.drawn, to: index });
    }
    const context = view.context;
    const draw = () => {
      context.setTransform(view.dpr, 0, 0, view.dpr, 0, 0); context.globalAlpha = 1; cover(context, bitmap, view);
      if (view.snapshot && view.fadeStart !== undefined) {
        const alpha = Math.max(0, 1 - (performance.now() - view.fadeStart) / 140);
        context.globalAlpha = alpha; context.drawImage(view.snapshot, 0, 0, view.width, view.height); context.globalAlpha = 1;
        if (alpha > 0) view.timer = setTimeout(draw, 16); else { cancelFade(view); view.jump = false; }
      }
    };
    clearTimeout(view.timer); draw();
    view.drawn = index; view.hasPainted = true;
    send({ type: "painted", id: view.id, generation: view.generation, index, target: view.target, jump: view.jump });
  }
}
