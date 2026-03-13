import type { DealStage, InvestorContext, ProjectUse } from "@/types/listing";
import type { NormalizedProfileResult } from "./normalized-profile";

export interface InvestorProfileDefaults {
  firstPropertyBuyer: boolean | null;
  willLiveThere: boolean | null;
  preferredAssetBand: "one_to_four_units" | "five_plus_units" | "flexible" | null;
  preferredDealStage: DealStage | "either" | null;
  plansRenovations: boolean | null;
}

function defaultDealStage(
  profile: NormalizedProfileResult,
  preferredDealStage: InvestorProfileDefaults["preferredDealStage"]
): DealStage {
  if (preferredDealStage === "existing" || preferredDealStage === "new_construction") {
    return preferredDealStage;
  }
  if (
    profile.redevelopmentCandidate ||
    profile.normalizedAssetType === "land" ||
    (profile.normalizedAssetType === "parking" && profile.normalizedAssetSubtype === "parking_lot")
  ) {
    return "new_construction";
  }
  return "existing";
}

export function buildInvestorContextDefaults(
  profile: NormalizedProfileResult,
  defaults?: InvestorProfileDefaults | null
): InvestorContext {
  return {
    firstPropertyBuyer: defaults?.firstPropertyBuyer ?? false,
    willLiveThere: defaults?.willLiveThere ?? false,
    preferredAssetBand: defaults?.preferredAssetBand ?? "flexible",
    dealStage: defaultDealStage(profile, defaults?.preferredDealStage ?? null),
    plansRenovations: defaults?.plansRenovations ?? false,
    projectUse: "standard_rental",
    residentialSharePct:
      profile.residentialShareEstimated != null
        ? Math.round(profile.residentialShareEstimated * 100)
        : null,
    mliAffordabilityCommitmentYears: 10,
    mliEnergyPoints: 0,
    mliAccessibilityPoints: 0,
  };
}

export function projectUseLabel(projectUse: ProjectUse): string {
  switch (projectUse) {
    case "student":
      return "Student";
    case "seniors":
      return "Seniors";
    case "supportive_sro":
      return "Supportive / SRO";
    case "standard_rental":
    default:
      return "Standard rental";
  }
}
