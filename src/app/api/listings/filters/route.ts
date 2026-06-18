import { prisma } from "@/lib/prisma";
import { normalizePropertyTypeOption } from "@/lib/property-type-filters";

export async function GET() {
  const [cities, propertyTypes] = await Promise.all([
    prisma.listing.findMany({
      where: { listingStatus: { not: "sold" } },
      select: { city: true },
      distinct: ["city"],
      orderBy: { city: "asc" },
    }),
    prisma.listing.findMany({
      where: { listingStatus: { not: "sold" } },
      select: { propertyType: true },
      distinct: ["propertyType"],
      orderBy: { propertyType: "asc" },
    }),
  ]);
  return Response.json({
    cities: cities.map((c) => c.city).filter(Boolean),
    propertyTypes: Array.from(
      new Set(
        propertyTypes
          .map((p) => normalizePropertyTypeOption(p.propertyType))
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b)),
  });
}
