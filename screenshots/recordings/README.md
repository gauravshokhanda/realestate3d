# Chrome scroll recording

- `chrome-scroll.mp4`: 1440x900, approximately 1m50s. Google Chrome page recording, including loading, a Kitchen hotspot click, forward and backward Kitchen scrubbing, a full pass through hero, living, kitchen and bedroom, then amenities and contact.
- `chrome-scroll.webm`: original VP9 recording.
- `report.json`: runtime-error list (empty) and completed checks. Backward Kitchen scrub decreased frame index from 122 to 24.
- `black-frame-check.json`: complete WebM decode succeeded; no nearly black intervals of at least 0.1 seconds were detected (98% picture threshold).
- `contact-sheet.jpg`: samples every nine seconds, for a quick overview. It does not show every frame or certify absence of all source-video morphing or delogo artifacts.

The sparkle was removed with the supplied delogo box; residual interpolation artifacts are documented in `../frames/README.md`. All four Chrome smoke modes passed after real-asset import. The frame-review zip is `../frames-review.zip`.
