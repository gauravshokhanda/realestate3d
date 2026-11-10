"use client";
import { useEffect, useRef, useState } from "react";
import { Cache, Viewer } from "@photo-sphere-viewer/core";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import { VirtualTourPlugin } from "@photo-sphere-viewer/virtual-tour-plugin";
import { GyroscopePlugin } from "@photo-sphere-viewer/gyroscope-plugin";
import type { TourNode } from "@/lib/panorama";
import { panoramaSource } from "@/lib/panorama-source";
import Minimap from "./Minimap";
import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/markers-plugin/index.css";
import "@photo-sphere-viewer/virtual-tour-plugin/index.css";
import "./panorama.css";

export type PanoramaViewProps = { nodes: TourNode[]; initialNodeId: string; planImage: string | null; onClose: () => void; onPick?: (yaw: number, pitch: number) => void; onPosition?: (yaw: number, pitch: number) => void };
export default function PanoramaView({ nodes, initialNodeId, planImage, onClose, onPick, onPosition }: PanoramaViewProps) {
  const host = useRef<HTMLDivElement>(null), cone = useRef<HTMLSpanElement>(null);
  const viewerRef = useRef<Viewer | null>(null), tourRef = useRef<VirtualTourPlugin | null>(null);
  const callbacks = useRef({ onPick, onPosition });
  const [current, setCurrent] = useState(initialNodeId), [loaded, setLoaded] = useState(false), [error, setError] = useState("");
  const [gyroAvailable, setGyroAvailable] = useState(false), [gyroEnabled, setGyroEnabled] = useState(false);
  const heading = useRef(0);
  useEffect(() => { callbacks.current = { onPick, onPosition }; }, [onPick, onPosition]);
  useEffect(() => {
    if (!host.current || !nodes.length) return;
    const container = host.current;
    let viewer: Viewer | undefined, alive = true;
    let cancelIdle: (() => void) | undefined;
    const pending = new Set<Promise<boolean>>();
    const mobile = matchMedia("(max-width: 767px)").matches;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = nodes.find((node) => node.id === initialNodeId) ?? nodes[0];
    const source = panoramaSource(nodes, mobile, (url) => Cache.remove(url, url));
    function preloadNext(id: string) {
      cancelIdle?.(); const next = source.focus(id);
      if (!next) return;
      const run = () => { if (alive) void source.preload(next); };
      if ("requestIdleCallback" in window) { const handle = requestIdleCallback(run, { timeout: 1000 }); cancelIdle = () => cancelIdleCallback(handle); }
      else { const handle = setTimeout(run, 100); cancelIdle = () => clearTimeout(handle); }
    }
    const initialize = () => { if (!alive) return; try {
      viewer = new Viewer({ container, defaultYaw: start.startYaw, defaultPitch: 0, navbar: false, keyboard: "always", loadingTxt: "Preparing your viewpoint…", touchmoveTwoFingers: false,
        plugins: [MarkersPlugin, GyroscopePlugin, VirtualTourPlugin.withConfig({
          dataMode: "server", positionMode: "manual", renderMode: "2d", getNode: source.getNode,
          preload: false, showLinkTooltip: false,
          transitionOptions: (to) => ({ effect: reduced ? "none" : "fade", speed: reduced ? 0 : 650, rotation: false, rotateTo: { yaw: nodes.find((n) => n.id === to.id)?.startYaw ?? 0, pitch: 0 } }),
          getLinkTooltip: () => "",
          arrowStyle: { element: (link) => { const button = document.createElement("button"); const name = nodes.find((n) => n.id === link.nodeId)?.name ?? "viewpoint"; button.className = "pano-arrow"; button.type = "button"; button.textContent = "↑"; button.setAttribute("aria-label", `Walk to ${name}`); button.title = `Walk to ${name}`; return button; }, size: { width: 48, height: 48 } },
        })],
      });
      viewerRef.current = viewer;
      const tour = viewer.getPlugin<VirtualTourPlugin>(VirtualTourPlugin);
      const navigate = tour.setCurrentNode.bind(tour);
      tour.setCurrentNode = (id, options, link) => {
        if (!alive) return Promise.resolve(false);
        const task = navigate(id, { ...options, forceUpdate: true }, link).catch(() => { if (alive) setError("Unable to open this panorama. Choose another viewpoint or close the viewer."); return false; });
        pending.add(task); void task.then(() => pending.delete(task)); return task;
      };
      const markers = viewer.getPlugin<MarkersPlugin>(MarkersPlugin);
      const gyro = viewer.getPlugin<GyroscopePlugin>(GyroscopePlugin);
      tourRef.current = tour;
      tour.addEventListener("node-changed", ({ node }) => { if (alive) { setCurrent(node.id); setLoaded(true); setError(""); preloadNext(node.id); } });
      viewer.addEventListener("position-updated", ({ position }) => {
        if (!alive) return;
        heading.current = position.yaw;
        if (cone.current) { cone.current.style.transform = `translate(-50%, -50%) rotate(${position.yaw}rad)`; cone.current.dataset.yaw = String(position.yaw); }
        callbacks.current.onPosition?.(position.yaw, position.pitch);
      });
      viewer.addEventListener("click", ({ data }) => { if (callbacks.current.onPick) { markers.setMarkers([{ id: "placement", position: { yaw: data.yaw, pitch: data.pitch }, html: '<span class="pano-placement">+</span>', size: { width: 36, height: 36 } }]); callbacks.current.onPick(data.yaw, data.pitch); } });
      viewer.addEventListener("panorama-error", () => { if (alive) setError("This panorama could not be loaded. Choose another viewpoint or close the viewer."); });
      void gyro.isSupported().then((supported) => { if (alive) setGyroAvailable(supported); }).catch(() => {});
      void tour.setCurrentNode(start.id);
    } catch { setError("360° viewing requires WebGL. Enable graphics acceleration or try another browser."); } };
    // React's development effect replay must not destroy a plugin halfway
    // through its initial promise chain before the real mount starts.
    const timer = setTimeout(initialize, 0);
    return () => {
      alive = false; clearTimeout(timer); cancelIdle?.(); source.abort();
      tourRef.current = null; viewerRef.current = null;
      const canvas = container.querySelector("canvas");
      const gl = canvas?.getContext("webgl2") ?? canvas?.getContext("webgl");
      const release = gl?.getExtension("WEBGL_lose_context");
      const destroy = () => { try { viewer?.destroy(); } finally { release?.loseContext(); source.dispose(); } };
      // Let tracked navigation finish/abort before destroying plugin services.
      if (pending.size) void Promise.allSettled([...pending]).then(destroy); else destroy();
    };
  }, [nodes, initialNodeId]);
  useEffect(() => { if (cone.current) { cone.current.style.transform = `translate(-50%, -50%) rotate(${heading.current}rad)`; cone.current.dataset.yaw = String(heading.current); } }, [current]);
  const node = nodes.find((item) => item.id === current);
  function jump(id: string) { setError(""); void tourRef.current?.setCurrentNode(id).catch(() => setError("Unable to open this viewpoint. Please try again.")); }
  return <div className="pano-experience" data-current-node={current} data-pano-ready={loaded}>
    <div ref={host} className="pano-stage" aria-label="Drag to look around the panorama" />
    <header className="pano-topbar"><div><p>360° WALKTHROUGH</p><h2>{node?.roomLabel} <span> / {node?.name}</span></h2></div><nav aria-label="Viewer controls">
      {gyroAvailable && <button aria-pressed={gyroEnabled} onClick={async () => { const gyro = viewerRef.current?.getPlugin<GyroscopePlugin>(GyroscopePlugin); try { if (gyro?.isEnabled()) { gyro.stop(); setGyroEnabled(false); } else { await gyro?.start(); setGyroEnabled(true); } } catch { setError("Motion permission was not granted. You can still drag to look around."); } }}>Motion</button>}
      <button onClick={() => { const modal = host.current?.closest<HTMLElement>(".pano-dialog"); const action = document.fullscreenElement ? document.exitFullscreen() : modal?.requestFullscreen(); void action?.catch(() => setError("Fullscreen is unavailable in this browser.")); }}>Fullscreen</button><button onClick={onClose}>Back to scroll tour</button><button aria-label="Close 360° walkthrough" onClick={onClose}>×</button>
    </nav></header>
    {error && <p role="alert" className="pano-error">{error}</p>}
    <Minimap ref={cone} nodes={nodes} current={current} image={planImage} jump={jump} />
    <p className="pano-hint">Drag to look around · Follow an arrow to move · Esc to close</p>
  </div>;
}
