import { InsertPart } from "@shared/schema";

// Standard filter sizes commonly used in HVAC systems
export const STANDARD_FILTERS: InsertPart[] = [
  // Pleated filters - most common residential sizes
  { type: "filter", filterType: "Pleated", size: "16x20x1" },
  { type: "filter", filterType: "Pleated", size: "16x25x1" },
  { type: "filter", filterType: "Pleated", size: "20x20x1" },
  { type: "filter", filterType: "Pleated", size: "20x25x1" },
  { type: "filter", filterType: "Pleated", size: "16x20x2" },
  { type: "filter", filterType: "Pleated", size: "20x20x2" },
  { type: "filter", filterType: "Pleated", size: "20x25x2" },
  
  // Media filters - thicker, high-efficiency filters
  { type: "filter", filterType: "Media", size: "16x25x4" },
  { type: "filter", filterType: "Media", size: "20x20x4" },
  { type: "filter", filterType: "Media", size: "20x25x4" },
  { type: "filter", filterType: "Media", size: "24x24x4" },
  { type: "filter", filterType: "Media", size: "16x25x5" },
  { type: "filter", filterType: "Media", size: "20x25x5" },
  
  // Ecology filters
  { type: "filter", filterType: "Ecology", size: "16x20x1" },
  { type: "filter", filterType: "Ecology", size: "20x20x1" },
  { type: "filter", filterType: "Ecology", size: "20x25x1" },
  
  // Throwaway filters
  { type: "filter", filterType: "Throwaway", size: "16x20x1" },
  { type: "filter", filterType: "Throwaway", size: "20x20x1" },
  { type: "filter", filterType: "Throwaway", size: "20x25x1" },
];

// Standard belt sizes for HVAC equipment
export const STANDARD_BELTS: InsertPart[] = [
  // Type A belts - common smaller belts
  { type: "belt", beltType: "A", size: "35" },
  { type: "belt", beltType: "A", size: "38" },
  { type: "belt", beltType: "A", size: "42" },
  { type: "belt", beltType: "A", size: "46" },
  { type: "belt", beltType: "A", size: "48" },
  { type: "belt", beltType: "A", size: "50" },
  { type: "belt", beltType: "A", size: "53" },
  { type: "belt", beltType: "A", size: "55" },
  { type: "belt", beltType: "A", size: "60" },
  
  // Type B belts - larger commercial belts
  { type: "belt", beltType: "B", size: "42" },
  { type: "belt", beltType: "B", size: "46" },
  { type: "belt", beltType: "B", size: "50" },
  { type: "belt", beltType: "B", size: "53" },
  { type: "belt", beltType: "B", size: "55" },
  { type: "belt", beltType: "B", size: "60" },
  { type: "belt", beltType: "B", size: "68" },
  { type: "belt", beltType: "B", size: "75" },
];
