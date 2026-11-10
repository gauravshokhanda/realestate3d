# Imported video frame review

Each scene has a desktop middle frame, last frame, and enlarged bottom-right crops (3x nearest-neighbor). `sizes.json` records desktop/mobile frame counts, dimensions, decimal MB, and scroll lengths.

All four imports use `--delogo 1130:569:62:64` in source coordinates. The sparkle is removed. The repair is **not artifact-free**: interpolation visibly softens texture and distorts rails/rug edges in some enlarged crops, particularly the living middle frame and bedroom last frame. An unwatermarked source is needed to avoid reconstructing those pixels. `bedroom-source-last.png` is an original source comparison and intentionally still shows the sparkle.

`plan-to-kitchen-last.png` is frame 164 after the requested `--end 6.8` cutoff: a clean kitchen view, with no visible bedroom dissolve. Desktop sequences remain 1280x720; mobile sequences are 800x450. Room openings blend from the matching hero endpoint across four frames.

| Scene | Desktop frames | Mobile frames | Scroll px | Desktop MB | Mobile MB |
| --- | ---: | ---: | ---: | ---: | ---: |
| hero-to-plan | 180 | 113 | 3420 | 13.220 | 4.045 |
| plan-to-living | 140 | 88 | 2660 | 10.942 | 3.248 |
| plan-to-kitchen | 164 | 103 | 3120 | 10.913 | 3.381 |
| plan-to-bedroom | 159 | 99 | 3020 | 10.651 | 3.176 |

All desktop sequences exceed the 8 MB warning threshold at the requested WebP quality.
