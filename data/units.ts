export type Room = {
  id: string;
  label: string;
  sequence: string;
  hotspot: { x: number; y: number };
};

export type Unit = {
  id: string;
  name: string;
  beds: number;
  baths: number;
  sqft: number;
  price: string;
  floorPlanSequence: string;
  rooms: Room[];
};

