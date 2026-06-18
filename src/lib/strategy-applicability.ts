import type {
  BridgeUsage,
  BusinessPlanApplicabilityResult,
  BusinessPlanId,
  DataConfidence,
  FinancingScenarioApplicabilityResult,
  InvestorContext,
  StrategyApplicabilityStatus,
  StrategyId,
} from "@/types/listing";
import type { NormalizedProfileResult } from "./normalized-profile";
import type { StrategyModel } from "./strategy-modeling";
import { FINANCING_PROGRAMS, type ProgramId } from "./program-rules";

export interface BusinessPlanMeta {
  id: BusinessPlanId;
  name: string;
  shortDescription: string;
  fitSummary: string;
}

export interface StrategyMeta {
  id: StrategyId;
  businessPlanId: BusinessPlanId;
  name: string;
  shortDescription: string;
  fitSummary: string;
  programId: ProgramId;
}

export const BUSINESS_PLAN_ORDER: BusinessPlanId[] = [
  "live_in_homeowner",
  "small_bay_hold",
  "small_bay_value_add_refi",
  "multifamily_hold",
  "multifamily_value_add_refi",
  "rental_development",
  "land_bank_covered_land",
];

export const BUSINESS_PLAN_META: Record<BusinessPlanId, BusinessPlanMeta> = {
  live_in_homeowner: {
    id: "live_in_homeowner",
    name: "Live-in homeowner",
    shortDescription: "Owner-occupied acquisition paths for 1-4 unit residential assets.",
    fitSummary: "Best when the buyer will live in the property and wants homeowner-style financing.",
  },
  small_bay_hold: {
    id: "small_bay_hold",
    name: "Small-bay hold",
    shortDescription: "Stabilized hold paths for 1-4 unit rentals.",
    fitSummary: "Best when the thesis is current income, not a heavy repositioning or development event.",
  },
  small_bay_value_add_refi: {
    id: "small_bay_value_add_refi",
    name: "Small-bay value-add / refi",
    shortDescription: "Bridge, improvement, and refinance paths for 1-4 unit repositioning deals.",
    fitSummary: "Best when you expect rent lift, capex, or a refinance event to drive returns.",
  },
  multifamily_hold: {
    id: "multifamily_hold",
    name: "Multifamily hold",
    shortDescription: "Permanent debt scenarios for stabilized 5+ unit rental assets.",
    fitSummary: "Best when the building is already close to financeable permanent-rental quality.",
  },
  multifamily_value_add_refi: {
    id: "multifamily_value_add_refi",
    name: "Multifamily value-add / refi",
    shortDescription: "Bridge-first 5+ unit repositioning paths with conventional or CMHC takeout.",
    fitSummary: "Best when the acquisition requires a transition period before the permanent debt is realistic.",
  },
  rental_development: {
    id: "rental_development",
    name: "Rental development",
    shortDescription: "Construction and stabilization paths for purpose-built rental development.",
    fitSummary: "Best when the value comes from creating future density, future units, or a full redevelopment program.",
  },
  land_bank_covered_land: {
    id: "land_bank_covered_land",
    name: "Land bank / covered land",
    shortDescription: "Carry paths for land, parking, and redevelopment basis assets.",
    fitSummary: "Best when the current income is secondary and the main thesis is future optionality.",
  },
};

export const SCENARIO_ORDER: StrategyId[] = [
  "conventional_owner_occupied",
  "cmhc_homeowner",
  "cmhc_home_start",
  "cmhc_improvement_owner_occupied",
  "conventional_investor_small_bay",
  "cmhc_income_property",
  "cmhc_improvement_small_rental",
  "bridge_conventional_small_bay_refi",
  "bridge_cmhc_income_property_takeout",
  "owner_occupied_improvement_refi",
  "personal_plex_lender_exception",
  "conventional_multifamily_hold",
  "cmhc_standard_rental_existing",
  "mli_select_existing",
  "bridge_conventional_multifamily",
  "bridge_standard_rental_takeout",
  "bridge_mli_select_takeout",
  "conventional_construction_takeout",
  "cmhc_standard_rental_new_construction",
  "mli_select_new_construction",
  "aclp_construction_stabilization",
  "conventional_land_bridge_hold",
];

export const STRATEGY_META: Record<StrategyId, StrategyMeta> = {
  conventional_owner_occupied: {
    id: "conventional_owner_occupied",
    businessPlanId: "live_in_homeowner",
    name: "Conventional owner-occupied",
    shortDescription: "Live in the property and use homeowner-style leverage.",
    fitSummary: "Owner-occupied path for 1-4 unit residential assets.",
    programId: "conventional_owner_occupied",
  },
  cmhc_homeowner: {
    id: "cmhc_homeowner",
    businessPlanId: "live_in_homeowner",
    name: "CMHC homeowner insured loan",
    shortDescription: "CMHC-insured owner-occupied financing for 1-4 units.",
    fitSummary: "Fits buyers who will live in the property and want insured homeowner leverage.",
    programId: "cmhc_homeowner",
  },
  cmhc_home_start: {
    id: "cmhc_home_start",
    businessPlanId: "live_in_homeowner",
    name: "CMHC Home Start",
    shortDescription: "High-ratio owner-occupied path with longer amortization.",
    fitSummary: "Fits first-time buyers or qualifying new-build owner-occupied deals.",
    programId: "cmhc_home_start",
  },
  cmhc_improvement_owner_occupied: {
    id: "cmhc_improvement_owner_occupied",
    businessPlanId: "live_in_homeowner",
    name: "CMHC Improvement (owner-occupied)",
    shortDescription: "Owner-occupied buy-and-improve path.",
    fitSummary: "Fits live-in properties with a real near-term improvement scope.",
    programId: "cmhc_improvement_owner_occupied",
  },
  conventional_investor_small_bay: {
    id: "conventional_investor_small_bay",
    businessPlanId: "small_bay_hold",
    name: "Conventional investor",
    shortDescription: "Conventional permanent debt for 1-4 unit rental holds.",
    fitSummary: "Fits stabilized small-bay rentals where the thesis is current income.",
    programId: "conventional_investor",
  },
  cmhc_income_property: {
    id: "cmhc_income_property",
    businessPlanId: "small_bay_hold",
    name: "CMHC Income Property",
    shortDescription: "CMHC-insured 2-4 unit non-owner-occupied rental financing.",
    fitSummary: "Fits stabilized duplexes, triplexes, and fourplexes held as rentals.",
    programId: "cmhc_income_property",
  },
  cmhc_improvement_small_rental: {
    id: "cmhc_improvement_small_rental",
    businessPlanId: "small_bay_hold",
    name: "CMHC Improvement (small rental)",
    shortDescription: "Improvement financing for 2-4 unit rentals.",
    fitSummary: "Fits small rental properties with an immediate, financeable improvement plan.",
    programId: "cmhc_improvement_small_rental",
  },
  bridge_conventional_small_bay_refi: {
    id: "bridge_conventional_small_bay_refi",
    businessPlanId: "small_bay_value_add_refi",
    name: "Bridge + conventional takeout",
    shortDescription: "Bridge-first BRRR path for 1-4 units.",
    fitSummary: "Fits small-bay assets that need work before a conventional refinance is realistic.",
    programId: "conventional_investor",
  },
  bridge_cmhc_income_property_takeout: {
    id: "bridge_cmhc_income_property_takeout",
    businessPlanId: "small_bay_value_add_refi",
    name: "Bridge + CMHC Income Property takeout",
    shortDescription: "Bridge into CMHC 2-4 unit takeout after stabilization.",
    fitSummary: "Fits 2-4 unit value-add deals where the permanent target is insured small-rental debt.",
    programId: "cmhc_income_property",
  },
  owner_occupied_improvement_refi: {
    id: "owner_occupied_improvement_refi",
    businessPlanId: "small_bay_value_add_refi",
    name: "Owner-occupied improvement refi",
    shortDescription: "Live-in improvement path with a post-work refinance mindset.",
    fitSummary: "Fits owner-occupants improving a 1-4 unit property while staying in the deal.",
    programId: "cmhc_improvement_owner_occupied",
  },
  personal_plex_lender_exception: {
    id: "personal_plex_lender_exception",
    businessPlanId: "multifamily_hold",
    name: "RBC/Desjardins personal plex exception",
    shortDescription: "Personal-borrower exception screen for 5-8 unit plex acquisitions.",
    fitSummary: "Fits 5-8 unit plex files only when a lender confirms personal mortgage treatment in writing.",
    programId: "personal_plex_lender_exception",
  },
  conventional_multifamily_hold: {
    id: "conventional_multifamily_hold",
    businessPlanId: "multifamily_hold",
    name: "Conventional stabilized rental",
    shortDescription: "Permanent conventional debt for stabilized 5+ rental.",
    fitSummary: "Fits stabilized multifamily that does not need CMHC leverage to work.",
    programId: "conventional_multifamily",
  },
  cmhc_standard_rental_existing: {
    id: "cmhc_standard_rental_existing",
    businessPlanId: "multifamily_hold",
    name: "CMHC Standard Rental, existing",
    shortDescription: "CMHC permanent debt for existing 5+ rental.",
    fitSummary: "Fits stabilized 5+ unit rental with strong residential use and program fit.",
    programId: "cmhc_standard_rental_existing",
  },
  mli_select_existing: {
    id: "mli_select_existing",
    businessPlanId: "multifamily_hold",
    name: "MLI Select, existing",
    shortDescription: "Existing-asset MLI Select with points-based incentives.",
    fitSummary: "Fits 5+ unit rentals that can credibly score on affordability, energy, or accessibility.",
    programId: "mli_select_existing",
  },
  bridge_conventional_multifamily: {
    id: "bridge_conventional_multifamily",
    businessPlanId: "multifamily_value_add_refi",
    name: "Bridge + conventional takeout",
    shortDescription: "Bridge-first multifamily refi into conventional permanent debt.",
    fitSummary: "Fits 5+ unit repositioning where conventional takeout is the end-state.",
    programId: "conventional_multifamily",
  },
  bridge_standard_rental_takeout: {
    id: "bridge_standard_rental_takeout",
    businessPlanId: "multifamily_value_add_refi",
    name: "Bridge + Standard Rental takeout",
    shortDescription: "Bridge-first multifamily refi into CMHC Standard Rental.",
    fitSummary: "Fits 5+ unit value-add where CMHC Standard Rental is the intended takeout.",
    programId: "cmhc_standard_rental_existing",
  },
  bridge_mli_select_takeout: {
    id: "bridge_mli_select_takeout",
    businessPlanId: "multifamily_value_add_refi",
    name: "Bridge + MLI Select takeout",
    shortDescription: "Bridge-first multifamily refi into MLI Select.",
    fitSummary: "Fits 5+ unit value-add with a real MLI scoring plan.",
    programId: "mli_select_existing",
  },
  conventional_construction_takeout: {
    id: "conventional_construction_takeout",
    businessPlanId: "rental_development",
    name: "Conventional construction + takeout",
    shortDescription: "Construction-style financing with conventional permanent takeout.",
    fitSummary: "Fits rental development where the exit is conventional debt.",
    programId: "conventional_construction_takeout",
  },
  cmhc_standard_rental_new_construction: {
    id: "cmhc_standard_rental_new_construction",
    businessPlanId: "rental_development",
    name: "CMHC Standard Rental, new construction",
    shortDescription: "Purpose-built rental construction with CMHC Standard Rental takeout.",
    fitSummary: "Fits new rental development targeting standard CMHC permanent debt.",
    programId: "cmhc_standard_rental_new_construction",
  },
  mli_select_new_construction: {
    id: "mli_select_new_construction",
    businessPlanId: "rental_development",
    name: "MLI Select, new construction",
    shortDescription: "Points-driven CMHC development execution.",
    fitSummary: "Fits new rental development designed to reach an MLI Select tier.",
    programId: "mli_select_new_construction",
  },
  aclp_construction_stabilization: {
    id: "aclp_construction_stabilization",
    businessPlanId: "rental_development",
    name: "ACLP",
    shortDescription: "Construction-through-stabilization CMHC path.",
    fitSummary: "Fits purpose-built rental development where ACLP execution is realistic.",
    programId: "aclp",
  },
  conventional_land_bridge_hold: {
    id: "conventional_land_bridge_hold",
    businessPlanId: "land_bank_covered_land",
    name: "Conventional land / bridge hold",
    shortDescription: "Carry path for land, parking, and covered-land positions.",
    fitSummary: "Fits land-banking or redevelopment optionality where current income is secondary.",
    programId: "land_bridge_hold",
  },
};

const STATUS_RANK: Record<StrategyApplicabilityStatus, number> = {
  applicable: 0,
  potentially_applicable: 1,
  needs_more_data: 2,
  not_applicable: 3,
};

function confidenceForProfile(profile: NormalizedProfileResult): DataConfidence {
  if (profile.assetTypeConfidence === "low" || profile.unitsConfidence === "low") return "low";
  if (profile.assetTypeConfidence === "medium" || profile.unitsConfidence === "medium") return "medium";
  return "high";
}

function sortByStatus<T extends { status: StrategyApplicabilityStatus }>(items: T[]): T[] {
  return [...items].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);
}

function residentialSharePct(profile: NormalizedProfileResult, investorContext: InvestorContext): number | null {
  if (investorContext.residentialSharePct != null) return investorContext.residentialSharePct;
  if (profile.residentialShareEstimated == null) return null;
  return profile.residentialShareEstimated * 100;
}

function isOneToFourUnitResidential(profile: NormalizedProfileResult): boolean {
  return (
    profile.normalizedUnits >= 1 &&
    profile.normalizedUnits <= 4 &&
    profile.normalizedAssetType !== "land" &&
    profile.normalizedAssetType !== "parking" &&
    profile.residentialUseCategory !== "non_residential"
  );
}

function isFivePlusResidential(profile: NormalizedProfileResult): boolean {
  return profile.normalizedUnits >= 5 && profile.residentialUseCategory !== "non_residential";
}

function isFiveToEightResidential(profile: NormalizedProfileResult): boolean {
  return (
    profile.normalizedUnits >= 5 &&
    profile.normalizedUnits <= 8 &&
    profile.residentialUseCategory !== "non_residential"
  );
}

function isOwnerOccupiedEligibleSmallAsset(profile: NormalizedProfileResult): boolean {
  return (
    profile.normalizedUnits >= 1 &&
    profile.normalizedUnits <= 4 &&
    ["single_family", "townhouse", "condo", "duplex", "triplex", "fourplex"].includes(
      profile.normalizedAssetType
    )
  );
}

function isDevelopmentCandidate(profile: NormalizedProfileResult, investorContext: InvestorContext): boolean {
  return (
    investorContext.dealStage === "new_construction" ||
    profile.redevelopmentCandidate ||
    profile.normalizedAssetType === "land" ||
    profile.normalizedAssetType === "parking"
  );
}

function multifamilyResidentialShareStatus(
  sharePct: number | null
): { ok: boolean; status: StrategyApplicabilityStatus; reason: string } {
  if (sharePct == null) {
    return {
      ok: false,
      status: "needs_more_data",
      reason: "Residential share is not known yet. CMHC 5+ rental scenarios need the residential share to confirm program fit.",
    };
  }

  if (sharePct >= 70) {
    return { ok: true, status: "applicable", reason: "Residential share clears the 70% threshold used for multifamily screening." };
  }

  if (sharePct >= 50) {
    return {
      ok: false,
      status: "potentially_applicable",
      reason: `Residential share is ${sharePct.toFixed(0)}%. This may still work conventionally, but it is below the usual CMHC multifamily threshold.`,
    };
  }

  return {
    ok: false,
    status: "not_applicable",
    reason: `Residential share is ${sharePct.toFixed(0)}%, which is too low for the multifamily CMHC paths shown here.`,
  };
}

function buildScenarioResult(
  scenarioId: StrategyId,
  status: StrategyApplicabilityStatus,
  reason: string,
  profile: NormalizedProfileResult,
  models?: Partial<Record<StrategyId, StrategyModel>>,
  missingInputs: string[] = []
): FinancingScenarioApplicabilityResult {
  const meta = STRATEGY_META[scenarioId];
  const model = models?.[scenarioId];
  const program = FINANCING_PROGRAMS[meta.programId];

  return {
    scenarioId,
    businessPlanId: meta.businessPlanId,
    status,
    reason,
    confidence: confidenceForProfile(profile),
    maxLeveragePct: model?.programEnvelope.maxLeveragePct ?? program.maxLeveragePct ?? null,
    leverageMetric: model?.programEnvelope.leverageMetric ?? program.leverageMetric,
    maxAmortizationYears: model?.programEnvelope.maxAmortizationYears ?? program.maxAmortizationYears ?? null,
    bridgeUsage: model?.bridgeUsage ?? (scenarioId === "conventional_land_bridge_hold" ? "optional" : "not_needed"),
    missingInputs,
  };
}

export function getScenarioApplicability(
  profile: NormalizedProfileResult,
  investorContext: InvestorContext,
  models?: Partial<Record<StrategyId, StrategyModel>>
): FinancingScenarioApplicabilityResult[] {
  const sharePct = residentialSharePct(profile, investorContext);
  const smallResidential = isOneToFourUnitResidential(profile);
  const fivePlusResidential = isFivePlusResidential(profile);
  const fiveToEightResidential = isFiveToEightResidential(profile);
  const ownerOccupiedAsset = isOwnerOccupiedEligibleSmallAsset(profile);
  const developmentCandidate = isDevelopmentCandidate(profile, investorContext);
  const multifamilyShare = multifamilyResidentialShareStatus(sharePct);
  const existingDeal = investorContext.dealStage === "existing";
  const newConstructionDeal = investorContext.dealStage === "new_construction";
  const plansImprovements = investorContext.plansRenovations;
  const results: FinancingScenarioApplicabilityResult[] = [];

  if (ownerOccupiedAsset) {
    results.push(
      buildScenarioResult(
        "conventional_owner_occupied",
        investorContext.willLiveThere ? "applicable" : "not_applicable",
        investorContext.willLiveThere
          ? "1-4 unit residential asset with owner-occupied intent."
          : "This scenario needs the live-there override turned on.",
        profile,
        models
      ),
      buildScenarioResult(
        "cmhc_homeowner",
        investorContext.willLiveThere ? "applicable" : "not_applicable",
        investorContext.willLiveThere
          ? "Owner-occupied 1-4 unit residential fits the CMHC homeowner screen."
          : "CMHC homeowner financing is only relevant when the borrower will live in the property.",
        profile,
        models
      ),
      buildScenarioResult(
        "cmhc_home_start",
        investorContext.willLiveThere && (investorContext.firstPropertyBuyer || newConstructionDeal)
          ? "applicable"
          : investorContext.willLiveThere
            ? "not_applicable"
            : "not_applicable",
        investorContext.willLiveThere
          ? investorContext.firstPropertyBuyer
            ? "Owner-occupied and first-time buyer profile fits the Home Start screen."
            : newConstructionDeal
              ? "Owner-occupied new-construction path fits the Home Start screen."
              : "Home Start generally needs first-time buyer status or a newly built home."
          : "Home Start is only relevant for owner-occupied financing.",
        profile,
        models,
        investorContext.willLiveThere || investorContext.firstPropertyBuyer || newConstructionDeal
          ? []
          : ["first-time buyer status or newly built home"],
      ),
      buildScenarioResult(
        "cmhc_improvement_owner_occupied",
        investorContext.willLiveThere && plansImprovements ? "applicable" : investorContext.willLiveThere ? "potentially_applicable" : "not_applicable",
        investorContext.willLiveThere
          ? plansImprovements
            ? "Owner-occupied property with immediate improvement plan."
            : "Turn this on when you have a real immediate improvement scope."
          : "Owner-occupied improvement only fits when the borrower will live in the property.",
        profile,
        models,
        plansImprovements ? [] : ["immediate improvement scope"]
      )
    );
  } else {
    results.push(
      buildScenarioResult("conventional_owner_occupied", "not_applicable", "Owner-occupied homeowner financing is limited to eligible 1-4 unit residential assets.", profile, models),
      buildScenarioResult("cmhc_homeowner", "not_applicable", "CMHC homeowner financing is limited to eligible 1-4 unit residential assets.", profile, models),
      buildScenarioResult("cmhc_home_start", "not_applicable", "Home Start is limited to eligible 1-4 unit owner-occupied residential assets.", profile, models),
      buildScenarioResult("cmhc_improvement_owner_occupied", "not_applicable", "Owner-occupied improvement only applies to eligible 1-4 unit residential assets.", profile, models)
    );
  }

  results.push(
    buildScenarioResult(
      "conventional_investor_small_bay",
      smallResidential ? (investorContext.willLiveThere ? "potentially_applicable" : "applicable") : "not_applicable",
      smallResidential
        ? investorContext.willLiveThere
          ? "Structurally valid, but your current override says you plan to live there, so the owner-occupied plan is likely the better primary screen."
          : "1-4 unit residential asset fits the conventional investor small-bay hold screen."
        : "This path is only for 1-4 unit residential rental assets.",
      profile,
      models
    )
  );

  const cmhcIncomeStatus =
    profile.normalizedUnits >= 2 && profile.normalizedUnits <= 4 && smallResidential
      ? investorContext.willLiveThere
        ? "not_applicable"
        : "applicable"
      : "not_applicable";
  results.push(
    buildScenarioResult(
      "cmhc_income_property",
      cmhcIncomeStatus,
      cmhcIncomeStatus === "applicable"
        ? "2-4 unit non-owner-occupied residential asset fits CMHC Income Property screening."
        : investorContext.willLiveThere
          ? "CMHC Income Property is a non-owner-occupied 2-4 unit rental path."
          : "This path requires a duplex, triplex, or fourplex operated as a rental.",
      profile,
      models
    ),
    buildScenarioResult(
      "cmhc_improvement_small_rental",
      profile.normalizedUnits >= 2 && profile.normalizedUnits <= 4 && smallResidential && !investorContext.willLiveThere
        ? plansImprovements
          ? "applicable"
          : "potentially_applicable"
        : "not_applicable",
      profile.normalizedUnits >= 2 && profile.normalizedUnits <= 4 && smallResidential && !investorContext.willLiveThere
        ? plansImprovements
          ? "2-4 unit rental with immediate improvement plan."
          : "Turn this on when the 2-4 unit rental has a real near-term improvement scope."
        : "This path requires a 2-4 unit non-owner-occupied rental asset.",
      profile,
      models,
      plansImprovements ? [] : ["immediate improvement scope"]
    )
  );

  results.push(
    buildScenarioResult(
      "bridge_conventional_small_bay_refi",
      smallResidential && existingDeal
        ? plansImprovements
          ? "applicable"
          : "potentially_applicable"
        : "not_applicable",
      smallResidential && existingDeal
        ? plansImprovements
          ? "Existing 1-4 unit residential asset with a value-add thesis fits bridge-to-conventional refi screening."
          : "This becomes the right path once the deal has a real renovation or repositioning plan."
        : "This path is for existing 1-4 unit residential value-add deals.",
      profile,
      models,
      plansImprovements ? [] : ["renovation or repositioning plan"]
    ),
    buildScenarioResult(
      "bridge_cmhc_income_property_takeout",
      profile.normalizedUnits >= 2 && profile.normalizedUnits <= 4 && smallResidential && existingDeal && !investorContext.willLiveThere
        ? plansImprovements
          ? "applicable"
          : "potentially_applicable"
        : "not_applicable",
      profile.normalizedUnits >= 2 && profile.normalizedUnits <= 4 && smallResidential && existingDeal && !investorContext.willLiveThere
        ? plansImprovements
          ? "2-4 unit value-add deal can bridge first and target CMHC Income Property as the permanent takeout."
          : "This path makes sense when the duplex, triplex, or fourplex needs a real bridge-and-stabilize execution."
        : "This path is limited to existing 2-4 unit non-owner-occupied rental deals.",
      profile,
      models,
      plansImprovements ? [] : ["renovation or repositioning plan"]
    ),
    buildScenarioResult(
      "owner_occupied_improvement_refi",
      smallResidential && investorContext.willLiveThere
        ? plansImprovements
          ? "applicable"
          : "potentially_applicable"
        : "not_applicable",
      smallResidential && investorContext.willLiveThere
        ? plansImprovements
          ? "Live-in 1-4 unit deal with improvement plan fits the owner-occupied improvement refi path."
          : "This path becomes relevant when the owner-occupied deal includes a real suite-add or renovation scope."
        : "This path requires an owner-occupied 1-4 unit residential asset.",
      profile,
      models,
      plansImprovements ? [] : ["immediate improvement scope"]
    )
  );

  results.push(
    buildScenarioResult(
      "personal_plex_lender_exception",
      fiveToEightResidential && existingDeal
        ? profile.residentialUseCategory === "mixed_use"
          ? multifamilyShare.status
          : "applicable"
        : "not_applicable",
      fiveToEightResidential && existingDeal
        ? profile.residentialUseCategory === "mixed_use"
          ? multifamilyShare.reason
          : "5-8 unit residential plex can be screened as a personal lender exception when RBC, Desjardins, or another lender confirms the file in writing."
        : "This exception path is only for existing 5-8 unit residential plex assets.",
      profile,
      models,
      fiveToEightResidential && existingDeal && profile.residentialUseCategory === "mixed_use" && sharePct == null
        ? ["residential share", "written personal-lender exception"]
        : fiveToEightResidential && existingDeal
          ? ["written personal-lender exception"]
          : []
    ),
    buildScenarioResult(
      "conventional_multifamily_hold",
      fivePlusResidential && existingDeal
        ? profile.residentialUseCategory === "mixed_use"
          ? multifamilyShare.status
          : "applicable"
        : "not_applicable",
      fivePlusResidential && existingDeal
        ? profile.residentialUseCategory === "mixed_use"
          ? multifamilyShare.reason
          : "Existing 5+ unit residential asset fits conventional multifamily hold screening."
        : "This path is for existing 5+ unit multifamily assets.",
      profile,
      models,
      fivePlusResidential && existingDeal && profile.residentialUseCategory === "mixed_use" && sharePct == null
        ? ["residential share"]
        : []
    )
  );

  results.push(
    buildScenarioResult(
      "cmhc_standard_rental_existing",
      fivePlusResidential && existingDeal
        ? profile.residentialUseCategory === "mixed_use"
          ? multifamilyShare.status
          : "applicable"
        : "not_applicable",
      fivePlusResidential && existingDeal
        ? profile.residentialUseCategory === "mixed_use"
          ? multifamilyShare.reason
          : "Existing 5+ unit residential asset fits the Standard Rental screening path."
        : "This path is for existing stabilized 5+ unit rental assets.",
      profile,
      models,
      fivePlusResidential && existingDeal && profile.residentialUseCategory === "mixed_use" && sharePct == null
        ? ["residential share"]
        : []
    ),
    buildScenarioResult(
      "mli_select_existing",
      fivePlusResidential && existingDeal
        ? profile.residentialUseCategory === "mixed_use"
          ? multifamilyShare.status
          : "applicable"
        : "not_applicable",
      fivePlusResidential && existingDeal
        ? profile.residentialUseCategory === "mixed_use"
          ? multifamilyShare.reason
          : "Existing 5+ unit residential asset can be screened for MLI Select tier eligibility."
        : "This path is for existing 5+ unit rental assets.",
      profile,
      models,
      fivePlusResidential && existingDeal && profile.residentialUseCategory === "mixed_use" && sharePct == null
        ? ["residential share"]
        : []
    )
  );

  results.push(
    buildScenarioResult(
      "bridge_conventional_multifamily",
      fivePlusResidential && existingDeal
        ? plansImprovements
          ? "applicable"
          : "potentially_applicable"
        : "not_applicable",
      fivePlusResidential && existingDeal
        ? plansImprovements
          ? "Existing 5+ unit asset with a repositioning thesis fits bridge-to-conventional multifamily screening."
          : "This path becomes relevant when the 5+ unit deal needs a real transition period before takeout."
        : "This path is for existing 5+ unit multifamily value-add deals.",
      profile,
      models,
      plansImprovements ? [] : ["renovation, lease-up, or repositioning plan"]
    ),
    buildScenarioResult(
      "bridge_standard_rental_takeout",
      fivePlusResidential && existingDeal
        ? profile.residentialUseCategory === "mixed_use"
          ? multifamilyShare.status === "not_applicable"
            ? "not_applicable"
            : plansImprovements
              ? multifamilyShare.status
              : "potentially_applicable"
          : plansImprovements
            ? "applicable"
            : "potentially_applicable"
        : "not_applicable",
      fivePlusResidential && existingDeal
        ? profile.residentialUseCategory === "mixed_use"
          ? multifamilyShare.reason
          : plansImprovements
            ? "Existing 5+ unit value-add deal can bridge first and take out into Standard Rental after stabilization."
            : "This path becomes relevant once the 5+ unit deal has a real bridge-and-stabilize execution plan."
        : "This path is for existing 5+ unit multifamily value-add deals targeting Standard Rental takeout.",
      profile,
      models,
      [
        ...(plansImprovements ? [] : ["renovation, lease-up, or repositioning plan"]),
        ...(fivePlusResidential && existingDeal && profile.residentialUseCategory === "mixed_use" && sharePct == null ? ["residential share"] : []),
      ]
    ),
    buildScenarioResult(
      "bridge_mli_select_takeout",
      fivePlusResidential && existingDeal
        ? profile.residentialUseCategory === "mixed_use"
          ? multifamilyShare.status === "not_applicable"
            ? "not_applicable"
            : plansImprovements
              ? multifamilyShare.status
              : "potentially_applicable"
          : plansImprovements
            ? "applicable"
            : "potentially_applicable"
        : "not_applicable",
      fivePlusResidential && existingDeal
        ? profile.residentialUseCategory === "mixed_use"
          ? multifamilyShare.reason
          : plansImprovements
            ? "Existing 5+ unit value-add deal can bridge first and target an MLI Select takeout once the scorecard is documented."
            : "This path becomes relevant once the asset has both a real transition plan and an MLI scoring thesis."
        : "This path is for existing 5+ unit multifamily value-add deals targeting MLI Select takeout.",
      profile,
      models,
      [
        ...(plansImprovements ? [] : ["renovation, lease-up, or repositioning plan"]),
        ...(fivePlusResidential && existingDeal && profile.residentialUseCategory === "mixed_use" && sharePct == null ? ["residential share"] : []),
      ]
    )
  );

  const developmentUnitCount = models?.conventional_construction_takeout?.modeledUnits.value ?? profile.normalizedUnits;
  const developmentThresholdMet = developmentUnitCount >= 5 || profile.normalizedAssetType === "land" || profile.normalizedAssetType === "parking";

  results.push(
    buildScenarioResult(
      "conventional_construction_takeout",
      developmentCandidate
        ? developmentThresholdMet
          ? "applicable"
          : "potentially_applicable"
        : "not_applicable",
      developmentCandidate
        ? developmentThresholdMet
          ? "Development or redevelopment candidate fits the conventional construction + takeout path."
          : "This path becomes stronger once the redevelopment concept clearly supports 5+ units."
        : "This path is for development, conversion, or redevelopment situations.",
      profile,
      models,
      developmentThresholdMet ? [] : ["future unit count / density plan"]
    ),
    buildScenarioResult(
      "cmhc_standard_rental_new_construction",
      developmentCandidate
        ? developmentThresholdMet
          ? sharePct == null || sharePct >= 70
            ? sharePct == null ? "needs_more_data" : "applicable"
            : sharePct >= 50 ? "potentially_applicable" : "not_applicable"
          : "potentially_applicable"
        : "not_applicable",
      developmentCandidate
        ? developmentThresholdMet
          ? sharePct == null
            ? "Need the projected residential share to confirm Standard Rental new-construction fit."
            : sharePct >= 70
              ? "Development path fits Standard Rental new-construction screening."
              : sharePct >= 50
                ? `Projected residential share is ${sharePct.toFixed(0)}%, which is below the usual CMHC rental threshold.`
                : `Projected residential share is ${sharePct.toFixed(0)}%, which is too low for Standard Rental new-construction screening.`
          : "Need the redevelopment concept to clearly support 5+ rental units."
        : "This path is for 5+ unit rental development or conversion.",
      profile,
      models,
      [
        ...(developmentThresholdMet ? [] : ["future unit count / density plan"]),
        ...(sharePct == null ? ["projected residential share"] : []),
      ]
    ),
    buildScenarioResult(
      "mli_select_new_construction",
      developmentCandidate
        ? developmentThresholdMet
          ? sharePct == null || sharePct >= 70
            ? sharePct == null ? "needs_more_data" : "applicable"
            : sharePct >= 50 ? "potentially_applicable" : "not_applicable"
          : "potentially_applicable"
        : "not_applicable",
      developmentCandidate
        ? developmentThresholdMet
          ? sharePct == null
            ? "Need projected residential share to confirm MLI Select new-construction fit."
            : sharePct >= 70
              ? "Development path can be screened for an MLI Select new-construction tier."
              : sharePct >= 50
                ? `Projected residential share is ${sharePct.toFixed(0)}%, which is below the usual CMHC rental threshold.`
                : `Projected residential share is ${sharePct.toFixed(0)}%, which is too low for MLI Select new-construction screening.`
          : "Need the redevelopment concept to clearly support 5+ rental units."
        : "This path is for 5+ unit rental development or conversion.",
      profile,
      models,
      [
        ...(developmentThresholdMet ? [] : ["future unit count / density plan"]),
        ...(sharePct == null ? ["projected residential share"] : []),
      ]
    ),
    buildScenarioResult(
      "aclp_construction_stabilization",
      developmentCandidate
        ? developmentThresholdMet
          ? sharePct == null || sharePct >= 70
            ? sharePct == null ? "needs_more_data" : "applicable"
            : sharePct >= 50 ? "potentially_applicable" : "not_applicable"
          : "potentially_applicable"
        : "not_applicable",
      developmentCandidate
        ? developmentThresholdMet
          ? sharePct == null
            ? "Need projected residential share to confirm ACLP fit."
            : sharePct >= 70
              ? `Development path fits ACLP screening for ${investorContext.projectUse.replace("_", " ")} use.`
              : sharePct >= 50
                ? `Projected residential share is ${sharePct.toFixed(0)}%, which is below the usual CMHC rental threshold.`
                : `Projected residential share is ${sharePct.toFixed(0)}%, which is too low for ACLP rental screening.`
          : "Need the redevelopment concept to clearly support 5+ rental units."
        : "This path is for purpose-built rental development or conversion.",
      profile,
      models,
      [
        ...(developmentThresholdMet ? [] : ["future unit count / density plan"]),
        ...(sharePct == null ? ["projected residential share"] : []),
      ]
    )
  );

  results.push(
    buildScenarioResult(
      "conventional_land_bridge_hold",
      profile.normalizedAssetType === "land" || profile.normalizedAssetType === "parking" || profile.redevelopmentCandidate
        ? "applicable"
        : "not_applicable",
      profile.normalizedAssetType === "land" || profile.normalizedAssetType === "parking" || profile.redevelopmentCandidate
        ? "Land, parking, or redevelopment basis asset fits the covered-land carry screen."
        : "This path is for land, parking, or redevelopment optionality rather than existing stabilized rental income.",
      profile,
      models
    )
  );

  return sortByStatus(results);
}

function bestStatus(results: FinancingScenarioApplicabilityResult[]): StrategyApplicabilityStatus {
  if (results.some((result) => result.status === "applicable")) return "applicable";
  if (results.some((result) => result.status === "potentially_applicable")) return "potentially_applicable";
  if (results.some((result) => result.status === "needs_more_data")) return "needs_more_data";
  return "not_applicable";
}

export function getBusinessPlanApplicability(
  scenarioResults: FinancingScenarioApplicabilityResult[]
): BusinessPlanApplicabilityResult[] {
  return BUSINESS_PLAN_ORDER.map((businessPlanId) => {
    const grouped = scenarioResults.filter((result) => result.businessPlanId === businessPlanId);
    const status = bestStatus(grouped);
    const leadResult = sortByStatus(grouped)[0];

    return {
      businessPlanId,
      status,
      reason:
        leadResult?.reason ?? BUSINESS_PLAN_META[businessPlanId].fitSummary,
      confidence: leadResult?.confidence ?? "medium",
      scenarioIds: grouped.map((result) => result.scenarioId),
    };
  });
}
