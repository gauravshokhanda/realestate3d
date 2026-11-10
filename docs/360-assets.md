# Assets for the 360° walkthrough

Each viewpoint needs a **spherical equirectangular panorama**, normally 2:1 (for example 4096×2048 or 6000×3000). It must cover the full 360° horizontally and 180° vertically. Its left and right edges must join seamlessly. A normal flat photograph or AI room still is **not a valid panorama**, even when resized or stretched to 2:1.

Obtain these assets from:

- A real 360° camera and its stitched equirectangular export. A phone app must capture a complete sphere; a normal narrow phone panorama is insufficient.
- The architect's 3D model: render an equirectangular/spherical camera at eye height for every walking position.
- An AI tool explicitly offering seamless equirectangular spherical output. Inspect the seam, floor and ceiling in the viewer; a 2:1 ratio alone does not prove that the projection is correct.

Keep a consistent north direction across viewpoints so the minimap's heading cone matches the plan. Choose a starting yaw in the admin preview. Yaw/pitch and the numeric starting direction are stored in radians. Arrow position is independent of a dot's plan coordinates.

## Add a walkthrough

1. Create/save rooms and a floor-plan image in admin.
2. Open **360° Walkthrough**. Choose the room for new viewpoints and upload one or more panoramas (up to eight per room).
3. Select each viewpoint, give it a name, and click the floor plan to place its dot. The numeric X/Y fields also support keyboard placement. Unplaced viewpoints remain reachable through the minimap's viewpoint selector.
4. Open **Preview / place arrows**. Drag to face the desired direction, then choose **Use current view as start direction**.
5. Reopen the preview, choose an **Arrow destination**, click the exact position in the panorama, and save the arrow. Links are directional; add a return arrow in the destination if wanted.
6. Wait for the viewpoint status to say **Saved**, then publish the property as usual. A room with panoramas shows **Explore in 360°** after its scroll sequence paints the final frame. Rooms without panoramas show no button. Reduced-motion visitors can open the viewer from the static room section.

Preview and public tours use the same viewer, arrows, minimap and transitions. Escape or **Back to scroll tour** closes it and returns focus to its opener. Keyboard arrow keys look around; Tab reaches walking arrows and minimap dots. Motion controls appear only when device orientation is supported and require permission; real sensor behavior needs testing on a physical mobile device with HTTPS. Fullscreen also depends on browser support.

Uploads use full real-image decoding, metadata-free WebP copies, a 25 MB limit and a 6000px long-edge cap. Original files are retained. A 2048px mobile copy is selected before loading the viewer. Ratio or width problems show warnings rather than blocking upload; replace an unsuitable image instead of stretching it. Only the first linked destination is speculatively preloaded, limiting extra texture memory. Closing destroys the viewer, textures and event handlers; opening again creates a new viewer.

## Reproducible test panoramas

```powershell
pnpm pano:fixtures
# Seed a separate, clearly labelled /walkthrough-demo property (requires Aurelia):
pnpm pano:demo
# Optional output directory:
pnpm pano:fixtures C:/Temp/aurelia-test-panoramas
```

The fixture script creates two labelled 4096×2048 grids (`test-living.webp`, `test-kitchen.webp`). Upload them to two viewpoints and connect arrows in both directions. They deliberately look like test charts and must not be presented as property photography. `pano:demo` creates a separate published demo with two return links, reusing Aurelia's existing scroll frames. It leaves Aurelia unchanged and preserves any existing demo edits on repeated runs. Delete the demo through admin when finished. The smoke suite generates its own charts in a temporary directory, uploads through admin, authors links in the viewer and verifies navigation, minimap, mobile assets, privacy and cleanup.

Viewer APIs follow the official [VirtualTourPlugin](https://photo-sphere-viewer.js.org/plugins/virtual-tour.html), [viewer events](https://photo-sphere-viewer.js.org/guide/events.html), and [GyroscopePlugin](https://photo-sphere-viewer.js.org/plugins/gyroscope.html) documentation. Gallery is not installed or used.
