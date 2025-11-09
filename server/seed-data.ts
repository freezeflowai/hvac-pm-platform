import { InsertPart } from "@shared/schema";

// Generate belt sizes 18-70 for both A and B types
const generateBelts = (): InsertPart[] => {
  const belts: InsertPart[] = [];
  
  for (let size = 18; size <= 70; size++) {
    belts.push({ type: "belt", beltType: "A", size: size.toString() });
    belts.push({ type: "belt", beltType: "B", size: size.toString() });
  }
  
  return belts;
};

// Generate filter sizes with x1 and x2 thickness variants
const generateFilters = (): InsertPart[] => {
  const filters: InsertPart[] = [];
  
  // Base filter sizes (without thickness)
  const baseSizes = [
    "10x10", "10x20", "12x12", "12x24", "14x20", "14x24", "14x25", "15x20",
    "16x16", "16x20", "16x24", "16x25", "16x30", "18x18", "18x24", "18x25",
    "20x20", "20x24", "20x25", "20x30", "24x24", "24x30", "25x25"
  ];
  
  // Filter types that need x1 and x2 variants
  const filterTypes = ["Media", "Pleated", "Throwaway"];
  
  // Thickness variants
  const thicknesses = ["1", "2"];
  
  for (const filterType of filterTypes) {
    for (const baseSize of baseSizes) {
      for (const thickness of thicknesses) {
        filters.push({
          type: "filter",
          filterType,
          size: `${baseSize}x${thickness}`
        });
      }
    }
  }
  
  return filters;
};

export const STANDARD_BELTS: InsertPart[] = generateBelts();
export const STANDARD_FILTERS: InsertPart[] = generateFilters();
