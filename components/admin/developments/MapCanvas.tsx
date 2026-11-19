"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { focusFor, type Point } from "@/lib/admin/polygon";
import type { MapProperty } from "@/lib/admin/development-schema";
import { Button } from "../ui/controls";

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const coords = (points: Point[]) => points.map(({ x, y }) => `${x},${y}`).join(" ");
const defaultView = { x: 0, y: 0, scale: 1 };
type Gesture = { kind: "pan"; id: number; x: number; y: number; initial: typeof defaultView }
  | { kind: "vertex"; id: number; index: number; original: Point[]; x: number; y: number; last: Point[] };

type Props = {
  image: string; points: Point[]; drawing: boolean; vertex: number; selection: string | null; properties: MapProperty[];
  onPoint: (point: Point) => void; onClose: () => void; onSelect: (id: string) => void;
  onVertex: (index: number) => void; onMove: (points: Point[]) => void; onInsert: (index: number, point: Point) => void;
};

export default function MapCanvas({ image, points, drawing, selection, properties, vertex, onPoint, onClose, onSelect, onVertex, onMove, onInsert }: Props) {
  const viewport = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null), space = useRef(false);
  const [view, setView] = useState(defaultView), [preview, setPreview] = useState<Point[] | null>(null);
  const [panMode, setPanMode] = useState(false);
  const visiblePoints = preview ?? points;
  const others = properties.filter((property) => property.id !== selection && property.polygon);
  function pointAt(x: number, y: number) {
    const bounds = svg.current!.getBoundingClientRect();
    return { x: clamp((x - bounds.left) / bounds.width), y: clamp((y - bounds.top) / bounds.height) };
  }
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    function wheel(event: WheelEvent) {
      event.preventDefault();
      const box = node!.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width, y = (event.clientY - box.top) / box.height;
      setView((old) => {
        const scale = clamp(old.scale * Math.exp(-event.deltaY * 0.002), 1, 5);
        if (scale === 1) return defaultView;
        const ratio = scale / old.scale;
        return { scale, x: clamp(x - (x - old.x) * ratio, 1 - scale, 0), y: clamp(y - (y - old.y) * ratio, 1 - scale, 0) };
      });
    }
    node.addEventListener("wheel", wheel, { passive: false });
    const resetSpace = () => { space.current = false; };
    window.addEventListener("blur", resetSpace);
    return () => { node.removeEventListener("wheel", wheel); window.removeEventListener("blur", resetSpace); };
  }, []);
  function capture(event: PointerEvent<SVGSVGElement>) {
    event.preventDefault();
    svg.current?.setPointerCapture(event.pointerId);
  }
  function onDown(event: PointerEvent<SVGSVGElement>) {
    if (gesture.current) return;
    viewport.current?.focus({ preventScroll: true });
    if (panMode || space.current || event.button === 1) {
      if (event.button !== 0 && event.button !== 1) return;
      capture(event);
      gesture.current = { kind: "pan", id: event.pointerId, x: event.clientX, y: event.clientY, initial: view };
      return;
    }
    if (event.button !== 0) return;
    const target = event.target as SVGElement;
    const marker = target.dataset.point;
    if (marker !== undefined) {
      const index = Number(marker);
      if (drawing) { if (index === 0) onClose(); return; }
      onVertex(index); capture(event);
      gesture.current = { kind: "vertex", id: event.pointerId, index, original: points, last: points, x: event.clientX, y: event.clientY };
      return;
    }
    if (drawing) { onPoint(pointAt(event.clientX, event.clientY)); return; }
    if (target.dataset.edge !== undefined) {
      const index = Number(target.dataset.edge), a = points[index], b = points[(index + 1) % points.length];
      const point = pointAt(event.clientX, event.clientY), dx = b.x - a.x, dy = b.y - a.y;
      const bounds = svg.current!.getBoundingClientRect();
      const w = bounds.width ** 2, h = bounds.height ** 2;
      const t = clamp(((point.x - a.x) * dx * w + (point.y - a.y) * dy * h) / (dx ** 2 * w + dy ** 2 * h));
      onInsert(index, { x: a.x + t * dx, y: a.y + t * dy });
      return;
    }
    const property = target.closest<SVGElement>("[data-property-id]")?.dataset.propertyId;
    if (property) onSelect(property);
    else if (!points.length) onPoint(pointAt(event.clientX, event.clientY));
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId) return;
    if (active.kind === "pan") {
      const box = viewport.current!.getBoundingClientRect();
      const horizontal = (event.clientX - active.x) / box.width;
      const vertical = (event.clientY - active.y) / box.height;
      const { x, y, scale } = active.initial;
      setView({ scale, x: clamp(x + horizontal, 1 - scale, 0), y: clamp(y + vertical, 1 - scale, 0) });
    } else {
      if (Math.hypot(event.clientX - active.x, event.clientY - active.y) < 2 && active.original === active.last) return;
      const point = pointAt(event.clientX, event.clientY);
      active.last = active.original.map((original, index) => index === active.index ? point : original);
      setPreview(active.last);
    }
  }
  function finish(event: PointerEvent<SVGSVGElement>, canceled = false) {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId) return;
    gesture.current = null;
    if (active.kind === "vertex") {
      setPreview(null);
      if (!canceled && active.last !== active.original) onMove(active.last);
    } else if (canceled) setView(active.initial);
  }
  const selected = properties.find((property) => property.id === selection);
  const centroid = !drawing && points.length >= 3 ? focusFor(points) : null;
  return <div className="crm-map-surface">
    <div className="crm-map-controls">
      <Button aria-pressed={panMode} onClick={() => setPanMode(!panMode)}>Pan</Button>
      <Button aria-label="Zoom out" disabled={view.scale <= 1} onClick={() => setView(defaultView)}>Reset view</Button>
      <span aria-label="Zoom level">{Math.round(view.scale * 100)}%</span>
    </div>
    <div ref={viewport} tabIndex={0} role="group" aria-label="Building map canvas" data-scale={view.scale} data-pan-x={view.x} data-pan-y={view.y}
      className={`crm-map-viewport ${panMode ? "is-panning" : ""}`}
      onKeyDown={(event) => { if (event.code === "Space" && event.target === viewport.current) { event.preventDefault(); space.current = true; } }}
      onKeyUp={(event) => { if (event.code === "Space") space.current = false; }} onBlur={() => { space.current = false; }}>
      <div className="crm-map-layer" style={{ transform: `translate(${view.x * 100}%, ${view.y * 100}%) scale(${view.scale})` }}>
        <Image src={image} alt="Building elevation" width={1600} height={900} unoptimized draggable={false} />
        <svg ref={svg} viewBox="0 0 1 1" preserveAspectRatio="none" aria-label="Property outlines"
          onPointerDown={onDown} onPointerMove={move} onPointerUp={finish} onPointerCancel={(event) => finish(event, true)} onLostPointerCapture={(event) => finish(event, true)}>
          <rect width="1" height="1" fill="transparent" />
          {others.map((property) => {
            const focus = focusFor(property.polygon!);
            return <g key={property.id} data-property-id={property.id} className="crm-map-outline">
              <polygon points={coords(property.polygon!)} vectorEffect="non-scaling-stroke" />
              <text x={focus.cx} y={focus.cy} textAnchor="middle" dominantBaseline="central">{property.label || property.name}</text>
            </g>;
          })}
          {visiblePoints.length > 0 && <g className="crm-map-outline selected">
            {drawing ? <polyline points={coords(visiblePoints)} vectorEffect="non-scaling-stroke" />
              : <polygon points={coords(visiblePoints)} vectorEffect="non-scaling-stroke" />}
            {!drawing && visiblePoints.map((a, index) => {
              const b = visiblePoints[(index + 1) % visiblePoints.length];
              return <line key={index} data-edge={index} className="crm-map-edge" x1={a.x} y1={a.y} x2={b.x} y2={b.y} vectorEffect="non-scaling-stroke" />;
            })}
            {selected && centroid && <text x={centroid.cx} y={centroid.cy} textAnchor="middle" dominantBaseline="central">{selected.label || selected.name}</text>}
            {visiblePoints.map((point, index) => <circle key={index} role="button" tabIndex={drawing && index !== 0 ? -1 : 0}
              aria-label={drawing && index === 0 ? "Close polygon at first point" : `Point ${index + 1}`} data-point={index}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault(); event.stopPropagation();
                if (drawing && index === 0) onClose(); else if (!drawing) onVertex(index);
              }}
              cx={point.x} cy={point.y} r={index === vertex || (drawing && index === 0) ? 0.011 : 0.008}
              vectorEffect="non-scaling-stroke" className={index === vertex ? "current" : undefined} />)}
          </g>}
        </svg>
      </div>
    </div>
    <p className="crm-map-help">Scroll to zoom. Hold Space and drag, use the middle mouse button, or turn on Pan to move the view.</p>
  </div>;
}
