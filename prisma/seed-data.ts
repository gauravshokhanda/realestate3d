// Legacy Aurelia migration input only. Public pages never import this module.
import type { Scene } from "../data/scenes";
import type { Unit } from "../data/units";

export const scenes = [
  { id: "hero-to-plan", folder: "/sequences/hero-to-plan", frameCount: 180, mobileFolder: "/sequences/hero-to-plan-mobile", mobileFrameCount: 113, pad: 4, ext: "webp", scrollLength: 3420 },
  { id: "plan-to-living", folder: "/sequences/plan-to-living", frameCount: 140, mobileFolder: "/sequences/plan-to-living-mobile", mobileFrameCount: 88, pad: 4, ext: "webp", scrollLength: 2660 },
  { id: "plan-to-kitchen", folder: "/sequences/plan-to-kitchen", frameCount: 164, mobileFolder: "/sequences/plan-to-kitchen-mobile", mobileFrameCount: 103, pad: 4, ext: "webp", scrollLength: 3120 },
  { id: "plan-to-bedroom", folder: "/sequences/plan-to-bedroom", frameCount: 159, mobileFolder: "/sequences/plan-to-bedroom-mobile", mobileFrameCount: 99, pad: 4, ext: "webp", scrollLength: 3020 },
] satisfies Scene[];

export const units: Unit[] = [
  { id: "residence-a", name: "Residence A", beds: 3, baths: 3, sqft: 2450, price: "From $1.2M", floorPlanSequence: "hero-to-plan", rooms: [
    { id: "living", label: "Living Room", sequence: "plan-to-living", hotspot: { x: 35, y: 58 } },
    { id: "kitchen", label: "Kitchen", sequence: "plan-to-kitchen", hotspot: { x: 53, y: 39 } },
    { id: "primary-bedroom", label: "Primary Bedroom", sequence: "plan-to-bedroom", hotspot: { x: 72, y: 61 } },
  ] },
  { id: "residence-b", name: "Residence B", beds: 2, baths: 2, sqft: 1600, price: "From $850K", floorPlanSequence: "hero-to-plan", rooms: [
    { id: "living", label: "Living Room", sequence: "plan-to-living", hotspot: { x: 33, y: 56 } },
    { id: "primary-bedroom", label: "Primary Bedroom", sequence: "plan-to-bedroom", hotspot: { x: 70, y: 60 } },
  ] },
];

export const amenities = [
  { icon: "Waves", title: "Pool", text: "A quiet escape above the city, from the first light to the last." },
  { icon: "Dumbbell", title: "Fitness studio", text: "Space to find your rhythm, with considered equipment and open views." },
  { icon: "Wine", title: "Sky lounge", text: "An intimate setting for long conversations and a changing skyline." },
  { icon: "BellRing", title: "Concierge", text: "Thoughtful assistance that makes every arrival feel like coming home." },
  { icon: "Clapperboard", title: "Private cinema", text: "Your own front-row seat for films, shared evenings, and special occasions." },
  { icon: "Flower2", title: "Wellness spa", text: "A slower pace. A moment of stillness. A place to restore." },
];
