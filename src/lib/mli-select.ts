import type { DealStage, ProjectUse } from "@/types/listing";

const MARKET_MEDIAN_RENTER_INCOME_2019: Record<
  string,
  { medianRenterIncomeAnnual: number; sourceLabel: string }
> = {
  Calgary: {
    medianRenterIncomeAnnual: 71000,
    sourceLabel: "StatsCan-based renter household income estimate (2019 vintage).",
  },
  Edmonton: {
    medianRenterIncomeAnnual: 67000,
    sourceLabel: "StatsCan-based renter household income estimate (2019 vintage).",
  },
  Vancouver: {
    medianRenterIncomeAnnual: 79500,
    sourceLabel: "StatsCan-based renter household income estimate (2019 vintage).",
  },
  Victoria: {
    medianRenterIncomeAnnual: 68000,
    sourceLabel: "StatsCan-based renter household income estimate (2019 vintage).",
  },
  Winnipeg: {
    medianRenterIncomeAnnual: 53000,
    sourceLabel: "StatsCan-based renter household income estimate (2019 vintage).",
  },
  Halifax: {
    medianRenterIncomeAnnual: 56000,
    sourceLabel: "StatsCan-based renter household income estimate (2019 vintage).",
  },
  Hamilton: {
    medianRenterIncomeAnnual: 64000,
    sourceLabel: "StatsCan-based renter household income estimate (2019 vintage).",
  },
  Kitchener: {
    medianRenterIncomeAnnual: 69000,
    sourceLabel: "StatsCan-based renter household income estimate (2019 vintage).",
  },
  London: {
    medianRenterIncomeAnnual: 55000,
    sourceLabel: "StatsCan-based renter household income estimate (2019 vintage).",
  },
  Ottawa: {
    medianRenterIncomeAnnual: 72000,
    sourceLabel: "StatsCan-based renter household income estimate (2019 vintage).",
  },
  "St. Catharines": {
    medianRenterIncomeAnnual: 56000,
    sourceLabel: "StatsCan-based renter household income estimate (2019 vintage).",
  },
  Toronto: {
    medianRenterIncomeAnnual: 80000,
    sourceLabel: "StatsCan-based renter household income estimate (2019 vintage).",
  },
  Windsor: {
    medianRenterIncomeAnnual: 50000,
    sourceLabel: "StatsCan-based renter household income estimate (2019 vintage).",
  },
  Gatineau: {
    medianRenterIncomeAnnual: 62000,
    sourceLabel: "StatsCan-based renter household income estimate (2019 vintage).",
  },
  Montreal: {
    medianRenterIncomeAnnual: 59400,
    sourceLabel: "StatsCan-based renter household income estimate (2019 vintage).",
  },
  "Quebec City": {
    medianRenterIncomeAnnual: 57000,
    sourceLabel: "StatsCan-based renter household income estimate (2019 vintage).",
  },
  Regina: {
    medianRenterIncomeAnnual: 58000,
    sourceLabel: "StatsCan-based renter household income estimate (2019 vintage).",
  },
  Saskatoon: {
    medianRenterIncomeAnnual: 60000,
    sourceLabel: "StatsCan-based renter household income estimate (2019 vintage).",
  },
};

const PROVINCIAL_FALLBACK_INCOME_2019: Record<
  string,
  { medianRenterIncomeAnnual: number; sourceLabel: string }
> = {
  AB: {
    medianRenterIncomeAnnual: 69000,
    sourceLabel: "Provincial renter household income fallback (2019 vintage).",
  },
  BC: {
    medianRenterIncomeAnnual: 75000,
    sourceLabel: "Provincial renter household income fallback (2019 vintage).",
  },
  MB: {
    medianRenterIncomeAnnual: 53000,
    sourceLabel: "Provincial renter household income fallback (2019 vintage).",
  },
  NS: {
    medianRenterIncomeAnnual: 56000,
    sourceLabel: "Provincial renter household income fallback (2019 vintage).",
  },
  ON: {
    medianRenterIncomeAnnual: 63000,
    sourceLabel: "Provincial renter household income fallback (2019 vintage).",
  },
  QC: {
    medianRenterIncomeAnnual: 58000,
    sourceLabel: "Provincial renter household income fallback (2019 vintage).",
  },
  SK: {
    medianRenterIncomeAnnual: 59000,
    sourceLabel: "Provincial renter household income fallback (2019 vintage).",
  },
};

export interface MliSelectScoreInput {
  marketCity: string | null;
  province: string | null;
  stage: DealStage;
  projectUse: ProjectUse;
  modeledRents: number[];
  mliAffordabilityCommitmentYears: number;
  mliEnergyPoints: 0 | 20 | 35 | 50;
  mliAccessibilityPoints: 0 | 20 | 30;
}

export interface MliSelectScoreResult {
  marketCity: string | null;
  sourceVintageYear: number;
  sourceLabel: string;
  medianRenterIncomeAnnual: number;
  maxAffordableMonthlyRent: number;
  affordableUnitSharePct: number;
  affordableUnitCount: number;
  totalUnitsScored: number;
  affordabilityPoints: number;
  affordabilityBonusPoints: number;
  energyPoints: number;
  accessibilityPoints: number;
  totalPoints: number;
  achievedTier: 0 | 50 | 70 | 100;
  qualified: boolean;
  missingForNextTier: string[];
}

function resolveIncomeEstimate(marketCity: string | null, province: string | null) {
  if (marketCity && MARKET_MEDIAN_RENTER_INCOME_2019[marketCity]) {
    return MARKET_MEDIAN_RENTER_INCOME_2019[marketCity];
  }
  if (province && PROVINCIAL_FALLBACK_INCOME_2019[province]) {
    return PROVINCIAL_FALLBACK_INCOME_2019[province];
  }
  return {
    medianRenterIncomeAnnual: 60000,
    sourceLabel: "National renter household income fallback (2019 vintage).",
  };
}

function affordabilityPointsForShare(stage: DealStage, sharePct: number): number {
  if (stage === "new_construction") {
    if (sharePct >= 25) return 100;
    if (sharePct >= 15) return 70;
    if (sharePct >= 10) return 50;
    return 0;
  }

  if (sharePct >= 80) return 100;
  if (sharePct >= 60) return 70;
  if (sharePct >= 40) return 50;
  return 0;
}

function nextTierMissingMessages(
  stage: DealStage,
  achievedTier: 0 | 50 | 70 | 100,
  totalPoints: number,
  affordableUnitSharePct: number,
  projectUse: ProjectUse,
  commitmentYears: number
): string[] {
  if (achievedTier >= 100) return [];

  const nextTier = achievedTier === 0 ? 50 : achievedTier === 50 ? 70 : 100;
  const messages: string[] = [];
  const pointsNeeded = Math.max(0, nextTier - totalPoints);

  if (pointsNeeded > 0) {
    messages.push(`Need ${pointsNeeded} more points to reach the ${nextTier}-point tier.`);
  }

  if (projectUse !== "student") {
    const requiredAffordableShare =
      stage === "new_construction"
        ? nextTier === 50
          ? 10
          : nextTier === 70
            ? 15
            : 25
        : nextTier === 50
          ? 40
          : nextTier === 70
            ? 60
            : 80;

    if (affordableUnitSharePct < requiredAffordableShare) {
      messages.push(
        `Affordable unit share is ${affordableUnitSharePct.toFixed(1)}%; ${requiredAffordableShare}% is needed for the affordability threshold tied to the ${nextTier}-point tier.`
      );
    }

    if (commitmentYears < 20 && nextTier > 70) {
      messages.push("A 20-year affordability commitment unlocks the +30 point bonus.");
    }
  } else {
    messages.push("Student housing is modeled without affordability points; tier progression depends on energy and accessibility scoring.");
  }

  return messages;
}

export function scoreMliSelect(input: MliSelectScoreInput): MliSelectScoreResult {
  const incomeEstimate = resolveIncomeEstimate(input.marketCity, input.province);
  const modeledRents = input.modeledRents.filter((rent) => Number.isFinite(rent) && rent >= 0);
  const totalUnitsScored = modeledRents.length > 0 ? modeledRents.length : 1;
  const maxAffordableMonthlyRent = (incomeEstimate.medianRenterIncomeAnnual * 0.3) / 12;
  const affordableUnitCount =
    input.projectUse === "student"
      ? 0
      : modeledRents.filter((rent) => rent <= maxAffordableMonthlyRent).length;
  const affordableUnitSharePct =
    totalUnitsScored > 0 ? (affordableUnitCount / totalUnitsScored) * 100 : 0;
  const affordabilityPoints =
    input.projectUse === "student"
      ? 0
      : affordabilityPointsForShare(input.stage, affordableUnitSharePct);
  const affordabilityBonusPoints =
    affordabilityPoints > 0 && input.mliAffordabilityCommitmentYears >= 20 ? 30 : 0;
  const totalPoints =
    affordabilityPoints +
    affordabilityBonusPoints +
    input.mliEnergyPoints +
    input.mliAccessibilityPoints;
  const achievedTier: 0 | 50 | 70 | 100 =
    totalPoints >= 100 ? 100 : totalPoints >= 70 ? 70 : totalPoints >= 50 ? 50 : 0;

  return {
    marketCity: input.marketCity,
    sourceVintageYear: 2019,
    sourceLabel: incomeEstimate.sourceLabel,
    medianRenterIncomeAnnual: incomeEstimate.medianRenterIncomeAnnual,
    maxAffordableMonthlyRent,
    affordableUnitSharePct,
    affordableUnitCount,
    totalUnitsScored,
    affordabilityPoints,
    affordabilityBonusPoints,
    energyPoints: input.mliEnergyPoints,
    accessibilityPoints: input.mliAccessibilityPoints,
    totalPoints,
    achievedTier,
    qualified: achievedTier >= 50,
    missingForNextTier: nextTierMissingMessages(
      input.stage,
      achievedTier,
      totalPoints,
      affordableUnitSharePct,
      input.projectUse,
      input.mliAffordabilityCommitmentYears
    ),
  };
}
