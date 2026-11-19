"use client";
import Image from "next/image";
import { forwardRef } from "react";
import type { TourNode } from "@/lib/panorama";
const Minimap = forwardRef<HTMLSpanElement, { nodes: TourNode[]; current: string; image: string | null; jump: (id: string) => void }>(function Minimap({ nodes, current, image, jump }, ref) {
  return <aside className="pano-minimap" aria-label="Walkthrough floor plan">
    <p>YOUR POSITION <span>Click a dot to move</span></p>
    {image ? <div className="pano-map-image"><Image src={image} alt="Property floor plan" width={640} height={360} unoptimized />
      {nodes.filter((node) => node.planX !== null && node.planY !== null).map((node) => <button key={node.id} className={`pano-map-dot ${current === node.id ? "active" : ""}`} style={{ left: `${node.planX}%`, top: `${node.planY}%` }} aria-label={`Go to ${node.name}`} aria-current={current === node.id ? "location" : undefined} onClick={() => jump(node.id)}>
        {current === node.id && <span ref={ref} className="pano-direction" aria-hidden="true" />}<span className="pano-dot-center" /><span className="pano-dot-name">{node.name}</span>
      </button>)}
    </div> : <p>Add a floor plan to show viewpoint positions.</p>}
    {nodes.some((node) => node.planX === null) && <label className="pano-unplaced">Other viewpoints<select value={current} onChange={(e) => jump(e.target.value)}>{nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</select></label>}
  </aside>;
});
export default Minimap;
