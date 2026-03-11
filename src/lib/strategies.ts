import type { BusinessPlanId } from "@/types/listing";

export type BusinessPlanDescriptor = {
  id: BusinessPlanId;
  name: string;
  description: string;
};

export const BUSINESS_PLANS: BusinessPlanDescriptor[] = [
  {
    id: "live_in_homeowner",
    name: "Live-in homeowner",
    description: "Owner-occupied acquisition paths for 1-4 unit residential properties.",
  },
  {
    id: "small_bay_hold",
    name: "Small-bay hold",
    description: "Stabilized 1-4 unit rental hold paths.",
  },
  {
    id: "small_bay_value_add_refi",
    name: "Small-bay value-add / refi",
    description: "1-4 unit bridge, improvement, and refinance paths.",
  },
  {
    id: "multifamily_hold",
    name: "Multifamily hold",
    description: "Permanent debt paths for stabilized 5+ unit rental assets.",
  },
  {
    id: "multifamily_value_add_refi",
    name: "Multifamily value-add / refi",
    description: "Bridge-first multifamily repositioning paths.",
  },
  {
    id: "rental_development",
    name: "Rental development",
    description: "Construction and stabilization paths for future rental product.",
  },
  {
    id: "land_bank_covered_land",
    name: "Land bank / covered land",
    description: "Carry paths for land, parking, and redevelopment optionality.",
  },
];
