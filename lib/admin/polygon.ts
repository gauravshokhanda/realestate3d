import { z } from "zod";

const coordinate = z.number().finite().min(0).max(1);
export const pointSchema = z.object({ x: coordinate, y: coordinate }).strict();
export type Point = z.infer<typeof pointSchema>;
const epsilon = 1e-9;
const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const near = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-5;

function intersects(a: Point, b: Point, c: Point, d: Point) {
  const side = (p: Point, q: Point, r: Point) => Math.abs(cross(p, q, r)) <= epsilon ? 0 : Math.sign(cross(p, q, r));
  const on = (p: Point, q: Point, r: Point) =>
    r.x >= Math.min(p.x, q.x) - epsilon && r.x <= Math.max(p.x, q.x) + epsilon &&
    r.y >= Math.min(p.y, q.y) - epsilon && r.y <= Math.max(p.y, q.y) + epsilon;
  const abC = side(a, b, c), abD = side(a, b, d), cdA = side(c, d, a), cdB = side(c, d, b);
  return (abC * abD < 0 && cdA * cdB < 0) ||
    (abC === 0 && on(a, b, c)) || (abD === 0 && on(a, b, d)) ||
    (cdA === 0 && on(c, d, a)) || (cdB === 0 && on(c, d, b));
}

export function polygonFocus(points: Point[]) {
  let area = 0, x = 0, y = 0;
  points.forEach((a, index) => {
    const b = points[(index + 1) % points.length];
    const weight = a.x * b.y - b.x * a.y;
    area += weight;
    x += (a.x + b.x) * weight;
    y += (a.y + b.y) * weight;
  });
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  return { area: Math.abs(area) / 2, cx: x / (3 * area), cy: y / (3 * area), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

export const polygonSchema = z.array(pointSchema).min(3, "Add at least three points.").max(64, "Use at most 64 points.").superRefine((points, ctx) => {
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], previous = points[(i + points.length - 1) % points.length];
    if (points.slice(i + 1).some((point) => near(a, point))) {
      ctx.addIssue({ code: "custom", message: "Polygon points must be distinct." });
      return;
    }
    if (Math.abs(cross(previous, a, b)) <= epsilon && (previous.x - a.x) * (b.x - a.x) + (previous.y - a.y) * (b.y - a.y) > epsilon) {
      ctx.addIssue({ code: "custom", message: "Polygon edges must not overlap." });
      return;
    }
    for (let j = i + 2; j < points.length; j++) {
      if (i === 0 && j === points.length - 1) continue;
      if (intersects(a, b, points[j], points[(j + 1) % points.length])) {
        ctx.addIssue({ code: "custom", message: "Polygon edges must not cross or touch." });
        return;
      }
    }
  }
  if (polygonFocus(points).area < 0.0001) ctx.addIssue({ code: "custom", message: "Draw a polygon that covers at least 0.01% of the image." });
});

export function focusFor(points: Point[]) {
  const { cx, cy, w, h } = polygonFocus(points);
  return { cx, cy, w, h };
}
