import type { Room, Unit } from "@/data/units";
import type { Scene } from "@/data/scenes";
import type { z } from "zod";
import type { amenitySchema } from "@/lib/property-validation";
import type { TourNode } from "@/lib/panorama";

export type Amenity = z.infer<typeof amenitySchema>;
export type PropertyView = {
  id: string;
  slug: string;
  name: string;
  brandName: string;
  tagline: string | null;
  location: string | null;
  heroCopy: string | null;
  heroDescription: string | null;
  overviewTitle: string | null;
  footerTagline: string | null;
  accentColor: string;
  towerImage: string | null;
  planImage: string | null;
  units: Unit[];
  rooms: Room[];
  scenes: Scene[];
  amenities: Amenity[];
  panoramas: TourNode[];
};
