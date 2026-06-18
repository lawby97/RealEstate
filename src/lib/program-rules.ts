/**
 * Financing program rules. This layer answers:
 * - what leverage / amortization envelope applies
 * - what minimum down payment rule applies
 * - whether the leverage metric is LTV or LTC
 */

import type {
  DealStage,
  NormalizedAssetType,
  ProjectUse,
} from "@/types/listing";

export type ProgramId =
  | "conventional_owner_occupied"
  | "conventional_investor"
  | "conventional_multifamily"
  | "conventional_construction_takeout"
  | "cmhc_homeowner"
  | "cmhc_home_start"
  | "cmhc_improvement_owner_occupied"
  | "cmhc_improvement_small_rental"
  | "cmhc_income_property"
  | "personal_plex_lender_exception"
  | "cmhc_standard_rental_existing"
  | "cmhc_standard_rental_new_construction"
  | "mli_select_existing"
  | "mli_select_new_construction"
  | "aclp"
  | "land_bridge_hold";

export interface FinancingProgramRule {
  id: ProgramId;
  name: string;
  minUnits: number;
  maxUnits: number | null;
  maxLeveragePct: number;
  maxAmortizationYears: number;
  leverageMetric: "LTV" | "LTC";
  minDscr?: number;
  allowedPurposes?: ("purchase" | "refinance" | "construction")[];
  notes?: string;
}

export interface ProgramEnvelope {
  programId: ProgramId;
  programName: string;
  maxLeveragePct: number;
  maxAmortizationYears: number;
  leverageMetric: "LTV" | "LTC";
  minDscr?: number;
  notes?: string;
}

export interface MinimumDownPaymentRule {
  programId: ProgramId;
  programName: string;
  minDownPaymentPct: number;
  minDownPaymentAmount?: number;
  maxLtvPct: number;
  label: string;
}

interface DownPaymentRuleContext {
  price: number;
  assetType: NormalizedAssetType;
  units: number;
  ownerOccupiedPrimaryHome?: boolean;
}

interface ProgramEnvelopeContext {
  stage?: DealStage;
  mliTotalPoints?: number | null;
  projectUse?: ProjectUse;
}

export const FINANCING_PROGRAMS: Record<ProgramId, FinancingProgramRule> = {
  conventional_owner_occupied: {
    id: "conventional_owner_occupied",
    name: "Conventional Owner-Occupied",
    minUnits: 1,
    maxUnits: 4,
    maxLeveragePct: 0.95,
    maxAmortizationYears: 30,
    leverageMetric: "LTV",
    notes: "Owner-occupied homes can be financed above 80% LTV subject to insured down-payment rules and purchase-price caps.",
  },
  conventional_investor: {
    id: "conventional_investor",
    name: "Conventional Investor",
    minUnits: 1,
    maxUnits: 4,
    maxLeveragePct: 0.8,
    maxAmortizationYears: 30,
    leverageMetric: "LTV",
    minDscr: 1,
  },
  conventional_multifamily: {
    id: "conventional_multifamily",
    name: "Conventional Multifamily",
    minUnits: 5,
    maxUnits: null,
    maxLeveragePct: 0.75,
    maxAmortizationYears: 30,
    leverageMetric: "LTV",
    minDscr: 1,
  },
  conventional_construction_takeout: {
    id: "conventional_construction_takeout",
    name: "Conventional Construction + Takeout",
    minUnits: 5,
    maxUnits: null,
    maxLeveragePct: 0.75,
    maxAmortizationYears: 30,
    leverageMetric: "LTC",
    notes: "Construction-oriented capital stack with conventional takeout assumptions.",
  },
  cmhc_homeowner: {
    id: "cmhc_homeowner",
    name: "CMHC Homeowner",
    minUnits: 1,
    maxUnits: 4,
    maxLeveragePct: 0.95,
    maxAmortizationYears: 25,
    leverageMetric: "LTV",
    notes: "Owner-occupied insured homeowner loan; 1-2 units up to 95% LTV and 3-4 units up to 90% LTV.",
  },
  cmhc_home_start: {
    id: "cmhc_home_start",
    name: "CMHC Home Start",
    minUnits: 1,
    maxUnits: 4,
    maxLeveragePct: 0.95,
    maxAmortizationYears: 30,
    leverageMetric: "LTV",
    notes: "High-ratio owner-occupied financing for first-time buyers or newly built homes with up to 30-year amortization.",
  },
  cmhc_improvement_owner_occupied: {
    id: "cmhc_improvement_owner_occupied",
    name: "CMHC Improvement (Owner-Occupied)",
    minUnits: 1,
    maxUnits: 4,
    maxLeveragePct: 0.95,
    maxAmortizationYears: 25,
    leverageMetric: "LTV",
    notes: "Owner-occupied improvement financing; lending value tied to the lower of as-improved value or as-is plus improvements.",
  },
  cmhc_improvement_small_rental: {
    id: "cmhc_improvement_small_rental",
    name: "CMHC Improvement (Small Rental)",
    minUnits: 2,
    maxUnits: 4,
    maxLeveragePct: 0.8,
    maxAmortizationYears: 25,
    leverageMetric: "LTV",
    notes: "Non-owner-occupied 2-4 unit rental with improvement scope.",
  },
  cmhc_income_property: {
    id: "cmhc_income_property",
    name: "CMHC Income Property",
    minUnits: 2,
    maxUnits: 4,
    maxLeveragePct: 0.8,
    maxAmortizationYears: 25,
    leverageMetric: "LTV",
    minDscr: 1,
    notes: "2-4 unit non-owner-occupied rental; 20% minimum equity.",
  },
  personal_plex_lender_exception: {
    id: "personal_plex_lender_exception",
    name: "Personal 5-8 Plex Exception",
    minUnits: 5,
    maxUnits: 8,
    maxLeveragePct: 0.8,
    maxAmortizationYears: 30,
    leverageMetric: "LTV",
    minDscr: 1,
    notes:
      "Exception-style personal borrower lane for 5-8 unit plex files when a lender such as RBC or Desjardins confirms residential/personal treatment in writing.",
  },
  cmhc_standard_rental_existing: {
    id: "cmhc_standard_rental_existing",
    name: "CMHC Standard Rental (Existing)",
    minUnits: 5,
    maxUnits: null,
    maxLeveragePct: 0.85,
    maxAmortizationYears: 40,
    leverageMetric: "LTV",
    minDscr: 1,
    allowedPurposes: ["purchase", "refinance"],
    notes: "Existing 5+ unit rental, generally 70%+ residential and max 30% non-residential.",
  },
  cmhc_standard_rental_new_construction: {
    id: "cmhc_standard_rental_new_construction",
    name: "CMHC Standard Rental (New Construction)",
    minUnits: 5,
    maxUnits: null,
    maxLeveragePct: 0.85,
    maxAmortizationYears: 50,
    leverageMetric: "LTV",
    minDscr: 1,
    allowedPurposes: ["construction"],
    notes: "New-construction Standard Rental execution; up to 85% of lending value and up to 100% of cost, whichever is less.",
  },
  mli_select_existing: {
    id: "mli_select_existing",
    name: "CMHC MLI Select (Existing)",
    minUnits: 5,
    maxUnits: null,
    maxLeveragePct: 0.95,
    maxAmortizationYears: 50,
    leverageMetric: "LTV",
    minDscr: 1.1,
    notes: "Existing 5+ unit rental with affordability, accessibility, or energy scoring.",
  },
  mli_select_new_construction: {
    id: "mli_select_new_construction",
    name: "CMHC MLI Select (New Construction)",
    minUnits: 5,
    maxUnits: null,
    maxLeveragePct: 0.95,
    maxAmortizationYears: 50,
    leverageMetric: "LTC",
    minDscr: 1.1,
    allowedPurposes: ["construction"],
    notes: "New-construction MLI Select execution with points-based incentives.",
  },
  aclp: {
    id: "aclp",
    name: "ACLP",
    minUnits: 5,
    maxUnits: null,
    maxLeveragePct: 1,
    maxAmortizationYears: 50,
    leverageMetric: "LTC",
    minDscr: 1,
    allowedPurposes: ["construction"],
    notes: "Construction-through-stabilization rental program; residential component can reach 100% LTC in modeled envelope.",
  },
  land_bridge_hold: {
    id: "land_bridge_hold",
    name: "Conventional Land / Bridge Hold",
    minUnits: 0,
    maxUnits: null,
    maxLeveragePct: 0.65,
    maxAmortizationYears: 25,
    leverageMetric: "LTV",
    notes: "Short-duration or low-leverage carry structure for land and redevelopment basis assets.",
  },
};

function resolveMliSelectEnvelope(
  programId: ProgramId,
  totalPoints: number | null | undefined
): ProgramEnvelope {
  const baseProgram = FINANCING_PROGRAMS[programId];
  const points = Math.max(0, totalPoints ?? 0);
  const isExisting = programId === "mli_select_existing";

  if (points >= 100) {
    return {
      programId,
      programName: baseProgram.name,
      maxLeveragePct: 0.95,
      maxAmortizationYears: 50,
      leverageMetric: baseProgram.leverageMetric,
      minDscr: baseProgram.minDscr,
      notes: "100+ MLI Select points reached.",
    };
  }
  if (points >= 70) {
    return {
      programId,
      programName: baseProgram.name,
      maxLeveragePct: 0.95,
      maxAmortizationYears: 45,
      leverageMetric: baseProgram.leverageMetric,
      minDscr: baseProgram.minDscr,
      notes: "70+ MLI Select points reached.",
    };
  }
  if (points >= 50) {
    return {
      programId,
      programName: baseProgram.name,
      maxLeveragePct: isExisting ? 0.85 : 0.95,
      maxAmortizationYears: 40,
      leverageMetric: baseProgram.leverageMetric,
      minDscr: baseProgram.minDscr,
      notes: "50+ MLI Select points reached.",
    };
  }

  return {
    programId,
    programName: baseProgram.name,
    maxLeveragePct: isExisting ? 0.85 : 0.95,
    maxAmortizationYears: 40,
    leverageMetric: baseProgram.leverageMetric,
    minDscr: baseProgram.minDscr,
    notes: "Previewing the 50-point MLI Select envelope. Actual qualification requires at least 50 points.",
  };
}

export function getProgramEnvelope(
  programId?: ProgramId,
  context: ProgramEnvelopeContext = {}
): ProgramEnvelope {
  const resolvedProgramId = resolveProgramId(programId);

  if (
    resolvedProgramId === "mli_select_existing" ||
    resolvedProgramId === "mli_select_new_construction"
  ) {
    return resolveMliSelectEnvelope(resolvedProgramId, context.mliTotalPoints);
  }

  const program = FINANCING_PROGRAMS[resolvedProgramId];
  return {
    programId: resolvedProgramId,
    programName: program.name,
    maxLeveragePct: program.maxLeveragePct,
    maxAmortizationYears: program.maxAmortizationYears,
    leverageMetric: program.leverageMetric,
    minDscr: program.minDscr,
    notes: program.notes,
  };
}

export function resolveProgramId(programId?: ProgramId): ProgramId {
  return programId ?? "conventional_investor";
}

export function getMaxLtv(programId?: ProgramId, context: ProgramEnvelopeContext = {}): number {
  return getProgramEnvelope(resolveProgramId(programId), context).maxLeveragePct;
}

export function getMaxAmortization(
  programId: ProgramId | undefined,
  stage?: DealStage,
  context: ProgramEnvelopeContext = {}
): number {
  return getProgramEnvelope(resolveProgramId(programId), { ...context, stage }).maxAmortizationYears;
}

function isPrimaryHomeEligibleAsset(assetType: NormalizedAssetType, units: number): boolean {
  return (
    units >= 1 &&
    units <= 4 &&
    ["single_family", "duplex", "triplex", "fourplex", "condo", "townhouse"].includes(assetType)
  );
}

function ownerOccupiedHomeLabel(programName: string, extra: string): string {
  return `${programName} follows insured owner-occupied down-payment rules. ${extra}`;
}

export function getMinimumDownPaymentRule(programId?: ProgramId): MinimumDownPaymentRule {
  const resolvedProgramId = resolveProgramId(programId);
  const envelope = getProgramEnvelope(resolvedProgramId);
  const minDownPaymentPct = Math.max(0, 1 - envelope.maxLeveragePct);

  const labelByProgram: Record<ProgramId, string> = {
    conventional_owner_occupied:
      "Owner-occupied conventional lending follows insured down-payment logic for 1-4 unit homes under the modeled price cap.",
    conventional_investor:
      "Conventional investor financing is capped at 80% LTV for this model, so the minimum down payment is 20%.",
    conventional_multifamily:
      "Conventional multifamily financing is capped at 75% LTV in this model, so the minimum down payment is 25%.",
    conventional_construction_takeout:
      "Construction takeout is sized on project cost; the modeled sponsor equity floor is 25% of total capitalization.",
    cmhc_homeowner:
      "CMHC homeowner financing follows insured owner-occupied down-payment rules for 1-4 unit homes.",
    cmhc_home_start:
      "CMHC Home Start is a high-ratio owner-occupied path, so it uses insured down-payment rules and longer amortization.",
    cmhc_improvement_owner_occupied:
      "CMHC Improvement (owner-occupied) follows insured owner-occupied down-payment rules on the supported lending value.",
    cmhc_improvement_small_rental:
      "CMHC Improvement for small rental is capped at 80% LTV in this model, so the minimum equity is 20%.",
    cmhc_income_property:
      "CMHC Income Property is capped at 80% LTV for 2-4 unit non-owner-occupied rental, so the minimum equity is 20%.",
    personal_plex_lender_exception:
      "Some 5-8 unit plex files may be treated on a personal borrower lane by lender exception. This model uses an 80% LTV ceiling and requires written lender confirmation.",
    cmhc_standard_rental_existing:
      "CMHC Standard Rental (existing) is capped at 85% LTV, so the minimum modeled equity is 15%.",
    cmhc_standard_rental_new_construction:
      "CMHC Standard Rental (new construction) is modeled at up to 85% of lending value, so the minimum modeled equity is 15%.",
    mli_select_existing:
      "MLI Select existing leverage depends on the achieved point tier. The displayed floor reflects the current modeled tier.",
    mli_select_new_construction:
      "MLI Select new-construction leverage depends on the achieved point tier. The displayed floor reflects the current modeled tier.",
    aclp:
      "ACLP is modeled on loan-to-cost rather than purchase-price down payment, so sponsor equity depends on the total project capitalization and selected leverage.",
    land_bridge_hold:
      "Land and bridge-hold underwriting uses a conservative leverage ceiling, so the sponsor equity floor is 35% in this model.",
  };

  return {
    programId: resolvedProgramId,
    programName: envelope.programName,
    minDownPaymentPct,
    minDownPaymentAmount: undefined,
    maxLtvPct: envelope.maxLeveragePct,
    label: labelByProgram[resolvedProgramId],
  };
}

export function resolveMinimumDownPaymentRule(
  programId: ProgramId | undefined,
  context: DownPaymentRuleContext
): MinimumDownPaymentRule {
  const resolvedProgramId = resolveProgramId(programId);
  const genericRule = getMinimumDownPaymentRule(resolvedProgramId);
  const price = Math.max(0, context.price);
  const ownerOccupiedProgram = new Set<ProgramId>([
    "conventional_owner_occupied",
    "cmhc_homeowner",
    "cmhc_home_start",
    "cmhc_improvement_owner_occupied",
  ]);

  if (
    context.ownerOccupiedPrimaryHome &&
    ownerOccupiedProgram.has(resolvedProgramId) &&
    isPrimaryHomeEligibleAsset(context.assetType, context.units)
  ) {
    if (price >= 1_500_000) {
      const minDownPaymentAmount = price * 0.2;
      return {
        ...genericRule,
        minDownPaymentPct: 0.2,
        minDownPaymentAmount,
        maxLtvPct: 0.8,
        label: ownerOccupiedHomeLabel(
          genericRule.programName,
          "Homes at or above $1.5M require at least 20% down in the modeled insured-owner-occupied path."
        ),
      };
    }

    if (context.units >= 3) {
      const minDownPaymentAmount = price * 0.1;
      return {
        ...genericRule,
        minDownPaymentPct: 0.1,
        minDownPaymentAmount,
        maxLtvPct: 0.9,
        label: ownerOccupiedHomeLabel(
          genericRule.programName,
          "Owner-occupied 3-4 unit homes can be insured up to 90% LTV, so the minimum down payment is 10%."
        ),
      };
    }

    const minDownPaymentAmount =
      price <= 500_000
        ? price * 0.05
        : 25_000 + Math.max(0, price - 500_000) * 0.1;
    const minDownPaymentPct = price > 0 ? minDownPaymentAmount / price : 0;
    return {
      ...genericRule,
      minDownPaymentPct,
      minDownPaymentAmount,
      maxLtvPct: 1 - minDownPaymentPct,
      label: ownerOccupiedHomeLabel(
        genericRule.programName,
        "Owner-occupied 1-2 unit homes can be insured with 5% down on the first $500k and 10% on the remainder up to $1.5M."
      ),
    };
  }

  return {
    ...genericRule,
    minDownPaymentAmount: price * genericRule.minDownPaymentPct,
  };
}

export function clampAmortization(
  programId: ProgramId | undefined,
  years: number,
  stage?: DealStage,
  context: ProgramEnvelopeContext = {}
): number {
  const max = getMaxAmortization(resolveProgramId(programId), stage, context);
  return Math.min(Math.max(1, years), max);
}
