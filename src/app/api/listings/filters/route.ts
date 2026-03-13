import { prisma } from "@/lib/prisma";
import { deriveNormalizedProfile } from "@/lib/normalized-profile";

export async function GET() {
  const [cities, listings] = await Promise.all([
    prisma.listing.findMany({
      where: { duplicateOfListingId: null },
      select: { city: true },
      distinct: ["city"],
      orderBy: { city: "asc" },
    }),
    prisma.listing.findMany({
      where: { duplicateOfListingId: null },
      orderBy: { propertyType: "asc" },
      include: { profile: true },
    }),
  ]);
  const propertyTypes = Array.from(
    new Set(
      listings
        .map((listing) => listing.profile?.normalizedAssetLabel ?? deriveNormalizedProfile(listing).normalizedAssetLabel)
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));
  return Response.json({
    cities: cities.map((c) => c.city).filter(Boolean),
    propertyTypes,
  });
}
