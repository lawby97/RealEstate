import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return unauthorized();

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      firstPropertyBuyer: true,
      willLiveThere: true,
      preferredAssetBand: true,
      preferredDealStage: true,
      plansRenovations: true,
      averageManagementFeePct: true,
      insuranceDefaultBasis: true,
      insuranceDefaultValue: true,
      repairsDefaultBasis: true,
      repairsDefaultValue: true,
      utilitiesDefaultBasis: true,
      utilitiesDefaultValue: true,
      snowDefaultBasis: true,
      snowDefaultValue: true,
      onboardingCompletedAt: true,
      onboardingSkippedAt: true,
    },
  });

  if (!user) return unauthorized();

  return Response.json({
    ...user,
    onboardingRequired: !user.onboardingCompletedAt && !user.onboardingSkippedAt,
  });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return unauthorized();

  const body = await req.json();
  const skip = body?.skip === true;
  const saveToProfile = body?.saveToProfile !== false;

  if (skip || !saveToProfile) {
    const user = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        onboardingSkippedAt: new Date(),
      },
      select: {
        onboardingCompletedAt: true,
        onboardingSkippedAt: true,
      },
    });

    return Response.json({
      ok: true,
      skipped: true,
      onboardingCompletedAt: user.onboardingCompletedAt,
      onboardingSkippedAt: user.onboardingSkippedAt,
    });
  }

  const firstPropertyBuyer =
    typeof body?.firstPropertyBuyer === "boolean" ? body.firstPropertyBuyer : null;
  const willLiveThere =
    typeof body?.willLiveThere === "boolean" ? body.willLiveThere : null;
  const preferredAssetBand =
    typeof body?.preferredAssetBand === "string" ? body.preferredAssetBand : null;
  const preferredDealStage =
    typeof body?.preferredDealStage === "string" ? body.preferredDealStage : null;
  const plansRenovations =
    typeof body?.plansRenovations === "boolean" ? body.plansRenovations : null;
  const averageManagementFeePct =
    typeof body?.averageManagementFeePct === "number" && Number.isFinite(body.averageManagementFeePct)
      ? body.averageManagementFeePct
      : null;
  const insuranceDefaultBasis =
    typeof body?.insuranceDefaultBasis === "string" ? body.insuranceDefaultBasis : null;
  const insuranceDefaultValue =
    typeof body?.insuranceDefaultValue === "number" && Number.isFinite(body.insuranceDefaultValue)
      ? body.insuranceDefaultValue
      : null;
  const repairsDefaultBasis =
    typeof body?.repairsDefaultBasis === "string" ? body.repairsDefaultBasis : null;
  const repairsDefaultValue =
    typeof body?.repairsDefaultValue === "number" && Number.isFinite(body.repairsDefaultValue)
      ? body.repairsDefaultValue
      : null;
  const utilitiesDefaultBasis =
    typeof body?.utilitiesDefaultBasis === "string" ? body.utilitiesDefaultBasis : null;
  const utilitiesDefaultValue =
    typeof body?.utilitiesDefaultValue === "number" && Number.isFinite(body.utilitiesDefaultValue)
      ? body.utilitiesDefaultValue
      : null;
  const snowDefaultBasis =
    typeof body?.snowDefaultBasis === "string" ? body.snowDefaultBasis : null;
  const snowDefaultValue =
    typeof body?.snowDefaultValue === "number" && Number.isFinite(body.snowDefaultValue)
      ? body.snowDefaultValue
      : null;

  const allowedAssetBands = new Set(["one_to_four_units", "five_plus_units", "flexible"]);
  const allowedDealStages = new Set(["existing", "new_construction", "either"]);
  const allowedExpenseBases = new Set([
    "percent_of_egi",
    "annual_total",
    "annual_per_unit",
    "annual_per_sqft",
  ]);

  if (firstPropertyBuyer == null || willLiveThere == null) {
    return Response.json(
      { error: "First property and live-there questions are required." },
      { status: 400 }
    );
  }

  if (preferredAssetBand != null && !allowedAssetBands.has(preferredAssetBand)) {
    return Response.json({ error: "Invalid preferred asset band." }, { status: 400 });
  }

  if (preferredDealStage != null && !allowedDealStages.has(preferredDealStage)) {
    return Response.json({ error: "Invalid preferred deal stage." }, { status: 400 });
  }

  for (const [fieldName, basis] of [
    ["insuranceDefaultBasis", insuranceDefaultBasis],
    ["repairsDefaultBasis", repairsDefaultBasis],
    ["utilitiesDefaultBasis", utilitiesDefaultBasis],
    ["snowDefaultBasis", snowDefaultBasis],
  ] as const) {
    if (basis != null && !allowedExpenseBases.has(basis)) {
      return Response.json({ error: `Invalid ${fieldName}.` }, { status: 400 });
    }
  }

  const user = await prisma.user.update({
    where: { email: session.user.email },
    data: {
      firstPropertyBuyer,
      willLiveThere,
      preferredAssetBand,
      preferredDealStage,
      plansRenovations,
      averageManagementFeePct,
      insuranceDefaultBasis,
      insuranceDefaultValue,
      repairsDefaultBasis,
      repairsDefaultValue,
      utilitiesDefaultBasis,
      utilitiesDefaultValue,
      snowDefaultBasis,
      snowDefaultValue,
      onboardingCompletedAt: new Date(),
      onboardingSkippedAt: null,
    },
    select: {
      onboardingCompletedAt: true,
      onboardingSkippedAt: true,
    },
  });

  return Response.json({
    ok: true,
    skipped: false,
    onboardingCompletedAt: user.onboardingCompletedAt,
    onboardingSkippedAt: user.onboardingSkippedAt,
  });
}
