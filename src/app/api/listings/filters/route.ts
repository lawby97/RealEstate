import { prisma } from "@/lib/prisma";

export async function GET() {
  const [cities, propertyTypes] = await Promise.all([
    prisma.listing.findMany({
      select: { city: true },
      distinct: ["city"],
      orderBy: { city: "asc" },
    }),
    prisma.listing.findMany({
      select: { propertyType: true },
      distinct: ["propertyType"],
      orderBy: { propertyType: "asc" },
    }),
  ]);
  return Response.json({
    cities: cities.map((c) => c.city).filter(Boolean),
    propertyTypes: propertyTypes.map((p) => p.propertyType).filter(Boolean),
  });
}
