import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_UNDERWRITING_INPUTS,
  type UnderwritingInputs,
} from "@/lib/underwriting";

const underwritingSchema = z.object({
  annualEmploymentIncome: z.number().min(0).max(100_000_000),
  annualOtherIncome: z.number().min(0).max(100_000_000),
  monthlyDebtPayments: z.number().min(0).max(10_000_000),
  monthlyTaxesHeatingCondo: z.number().min(0).max(1_000_000),
  maxDownPayment: z.number().min(0).max(100_000_000),
  closingCostReserve: z.number().min(0).max(10_000_000),
  creditScore: z.number().int().min(300).max(900).nullable(),
  ownerOccupied: z.boolean(),
  rentalIncomeOffsetPct: z.number().min(0).max(1),
  expectedMonthlyRentPerUnit: z.number().min(0).max(1_000_000),
  qualifyingRatePct: z.number().min(0).max(30),
  amortizationYears: z.number().int().min(1).max(50),
  targetCommercialRefinanceYears: z.number().int().min(1).max(20),
  targetCommercialLtvPct: z.number().min(0).max(1),
  targetCommercialDscr: z.number().min(0.5).max(5),
});

type NullableUnderwritingInputs = {
  [Key in keyof UnderwritingInputs]?: UnderwritingInputs[Key] | null;
};

function withDefaults(values: NullableUnderwritingInputs): UnderwritingInputs {
  return {
    annualEmploymentIncome:
      values.annualEmploymentIncome ?? DEFAULT_UNDERWRITING_INPUTS.annualEmploymentIncome,
    annualOtherIncome: values.annualOtherIncome ?? DEFAULT_UNDERWRITING_INPUTS.annualOtherIncome,
    monthlyDebtPayments:
      values.monthlyDebtPayments ?? DEFAULT_UNDERWRITING_INPUTS.monthlyDebtPayments,
    monthlyTaxesHeatingCondo:
      values.monthlyTaxesHeatingCondo ??
      DEFAULT_UNDERWRITING_INPUTS.monthlyTaxesHeatingCondo,
    maxDownPayment: values.maxDownPayment ?? DEFAULT_UNDERWRITING_INPUTS.maxDownPayment,
    closingCostReserve:
      values.closingCostReserve ?? DEFAULT_UNDERWRITING_INPUTS.closingCostReserve,
    creditScore: values.creditScore ?? DEFAULT_UNDERWRITING_INPUTS.creditScore,
    ownerOccupied:
      values.ownerOccupied ?? DEFAULT_UNDERWRITING_INPUTS.ownerOccupied,
    rentalIncomeOffsetPct:
      values.rentalIncomeOffsetPct ?? DEFAULT_UNDERWRITING_INPUTS.rentalIncomeOffsetPct,
    expectedMonthlyRentPerUnit:
      values.expectedMonthlyRentPerUnit ??
      DEFAULT_UNDERWRITING_INPUTS.expectedMonthlyRentPerUnit,
    qualifyingRatePct:
      values.qualifyingRatePct ?? DEFAULT_UNDERWRITING_INPUTS.qualifyingRatePct,
    amortizationYears:
      values.amortizationYears ?? DEFAULT_UNDERWRITING_INPUTS.amortizationYears,
    targetCommercialRefinanceYears:
      values.targetCommercialRefinanceYears ??
      DEFAULT_UNDERWRITING_INPUTS.targetCommercialRefinanceYears,
    targetCommercialLtvPct:
      values.targetCommercialLtvPct ??
      DEFAULT_UNDERWRITING_INPUTS.targetCommercialLtvPct,
    targetCommercialDscr:
      values.targetCommercialDscr ?? DEFAULT_UNDERWRITING_INPUTS.targetCommercialDscr,
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ authenticated: false, inputs: DEFAULT_UNDERWRITING_INPUTS });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      annualEmploymentIncome: true,
      annualOtherIncome: true,
      monthlyDebtPayments: true,
      monthlyTaxesHeatingCondo: true,
      maxDownPayment: true,
      closingCostReserve: true,
      creditScore: true,
      underwritingOwnerOccupied: true,
      rentalIncomeOffsetPct: true,
      expectedMonthlyRentPerUnit: true,
      qualifyingRatePct: true,
      underwritingAmortizationYears: true,
      targetCommercialRefinanceYears: true,
      targetCommercialLtvPct: true,
      targetCommercialDscr: true,
    },
  });

  if (!user) {
    return Response.json({ authenticated: false, inputs: DEFAULT_UNDERWRITING_INPUTS });
  }

  return Response.json({
    authenticated: true,
    inputs: withDefaults({
      annualEmploymentIncome: user.annualEmploymentIncome,
      annualOtherIncome: user.annualOtherIncome,
      monthlyDebtPayments: user.monthlyDebtPayments,
      monthlyTaxesHeatingCondo: user.monthlyTaxesHeatingCondo,
      maxDownPayment: user.maxDownPayment,
      closingCostReserve: user.closingCostReserve,
      creditScore: user.creditScore,
      ownerOccupied: user.underwritingOwnerOccupied,
      rentalIncomeOffsetPct: user.rentalIncomeOffsetPct,
      expectedMonthlyRentPerUnit: user.expectedMonthlyRentPerUnit,
      qualifyingRatePct: user.qualifyingRatePct,
      amortizationYears: user.underwritingAmortizationYears,
      targetCommercialRefinanceYears: user.targetCommercialRefinanceYears,
      targetCommercialLtvPct: user.targetCommercialLtvPct,
      targetCommercialDscr: user.targetCommercialDscr,
    }),
  });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Sign in to save underwriting inputs." }, { status: 401 });
  }

  const parsed = underwritingSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Review the underwriting values and try again." },
      { status: 400 }
    );
  }

  const inputs = parsed.data;
  await prisma.user.update({
    where: { email: session.user.email },
    data: {
      annualEmploymentIncome: inputs.annualEmploymentIncome,
      annualOtherIncome: inputs.annualOtherIncome,
      monthlyDebtPayments: inputs.monthlyDebtPayments,
      monthlyTaxesHeatingCondo: inputs.monthlyTaxesHeatingCondo,
      maxDownPayment: inputs.maxDownPayment,
      closingCostReserve: inputs.closingCostReserve,
      creditScore: inputs.creditScore,
      underwritingOwnerOccupied: inputs.ownerOccupied,
      rentalIncomeOffsetPct: inputs.rentalIncomeOffsetPct,
      expectedMonthlyRentPerUnit: inputs.expectedMonthlyRentPerUnit,
      qualifyingRatePct: inputs.qualifyingRatePct,
      underwritingAmortizationYears: inputs.amortizationYears,
      targetCommercialRefinanceYears: inputs.targetCommercialRefinanceYears,
      targetCommercialLtvPct: inputs.targetCommercialLtvPct,
      targetCommercialDscr: inputs.targetCommercialDscr,
    },
  });

  return Response.json({ ok: true, inputs });
}
