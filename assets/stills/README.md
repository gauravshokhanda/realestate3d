# Still-image review set

Generated using the built-in image_gen tool, floor plan first. Interiors use that floor plan as a visual reference. The final tower is generated separately to keep its facade enclosed. All outputs are 16:9 landscape concepts, not verified construction plans. These stills have not replaced site placeholders.

## Final prompts

**floor-plan.png:** Isometric 3D cutaway of a luxury 3-bedroom waterfront apartment, no roof, warm oak floors, furnished living room with cream sofa and dining table, open kitchen with marble island and oak cabinetry, primary suite with king bed and cream linens, two additional bedrooms, soft warm champagne interior lighting, dark charcoal background, 45 degree top-down angle, architectural visualization, ultra detailed. Clear coherent room layout and floor-to-ceiling glazing along the waterfront side. No people, no text, no labels, no watermark. This is the hub reference for a consistent set of Miami waterfront blue-hour residential renders.

**living-room.png:** Create one final 16:9 landscape still, no montage. Interior of the reference luxury waterfront apartment living room, floor-to-ceiling windows, evening city lights over the bay, warm champagne lighting, cream sectional sofa, round marble coffee table, warm oak floors, architectural photography. Eye-level view inside the central living area of the reference, preserving its furniture style and open kitchen relationship. Input image: style and architectural continuity reference, not an edit target. Match the same residence as the floor plan. No people, no text, no watermark.

**kitchen.png:** Create one final 16:9 landscape still, no montage. Luxury open kitchen of the reference apartment with veined white marble island, three cream bar stools, warm pendant lights, floor-to-ceiling windows with evening bay view, oak cabinetry, architectural photography. Eye-level interior view; preserve the reference kitchen materials, layout and cream/oak/champagne palette. Input image: style and architectural continuity reference, not an edit target. Match the same residence as the floor plan. No people, no text, no watermark.

**primary-bedroom.png:** Create one final 16:9 landscape still, no montage. Primary bedroom of the reference luxury high-rise apartment, king bed with cream linens, upholstered headboard, warm oak floors, floor-to-ceiling windows overlooking the bay at dusk, warm bedside lamps, architectural photography. Eye-level interior view of the large primary suite at the upper right of the reference, preserving its furniture and warm cream/oak palette. Input image: style and architectural continuity reference, not an edit target. Match the same residence as the floor plan. No people, no text, no watermark.

**tower-exterior.png:** One 16:9 landscape architectural photograph. Luxury glass residential high-rise on a Miami waterfront at blue hour, warm lit windows, calm reflective bay, neighboring towers, palm trees, architectural photography, wide establishing shot showing the ENTIRE tower from ground to rooftop, a tall slender elegant 35-story building with curved glass balconies. Realistic opaque floor slabs and intact enclosed blue reflective glass facade; apartments only glimpsed as warm distant windows. NO cutaway, NO dollhouse, NO exposed floor plans, NO removed facade, NO giant see-through room. Warm champagne lighting, blue evening sky and bay, materials cream stone and warm oak glimpsed behind glass. No text, no people, no watermark.

## Camera moves after still review

| Scene ID | Start image | End image |
| --- | --- | --- |
| hero-to-plan | tower-exterior.png | floor-plan.png |
| plan-to-living | floor-plan.png | living-room.png |
| plan-to-kitchen | floor-plan.png | kitchen.png |
| plan-to-bedroom | floor-plan.png | primary-bedroom.png |

Use start/end-frame mode, 5–8 seconds, 16:9, highest quality. Prompt: “Slow cinematic push-in, smooth continuous dolly, no cuts, no people, no text, consistent lighting.” Reuse the exact floor-plan.png at each junction. Import finished MP4s with `pnpm run import <video.mp4> <sceneId>`.

