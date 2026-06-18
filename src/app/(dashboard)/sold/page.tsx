import { SoldListingsClient, type SoldListing } from "@/components/SoldListingsClient";
import { prisma } from "@/lib/prisma";
import { computeListingCashOnCashRoi } from "@/lib/listing-roi";
import { getListingCashRequirement } from "@/lib/underwriting";

export const dynamic = "force-dynamic";

export default async function SoldListingsPage() {
  const [rows, total] = await Promise.all([
    prisma.listing.findMany({
      where: { listingStatus: "sold" },
      orderBy: { soldAt: "desc" },
      take: 100,
      include: { evaluation: true },
    }),
    prisma.listing.count({ where: { listingStatus: "sold" } }),
  ]);

  const listings: SoldListing[] = rows.map((listing) => ({
    id: listing.id,
    address: listing.address,
    city: listing.city,
    province: listing.province,
    price: listing.price,
    propertyType: listing.propertyType,
    units: listing.units,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    listingUrl: listing.listingUrl,
    source: listing.source,
    photoUrls: listing.photoUrls,
    listingStatus: listing.listingStatus,
    soldAt: dateToIso(listing.soldAt),
    unavailableSince: dateToIso(listing.unavailableSince),
    lastSyncRunAt: dateToIso(listing.lastSyncRunAt),
    lastSeenAt: dateToIso(listing.lastSeenAt) ?? undefined,
    createdAt: dateToIso(listing.createdAt) ?? undefined,
    isLinkActive: listing.isLinkActive,
    linkCheckedAt: dateToIso(listing.linkCheckedAt),
    linkStatusCode: listing.linkStatusCode,
    linkStatusNote: listing.linkStatusNote,
    evaluation: listing.evaluation
      ? {
          combinedScore: listing.evaluation.combinedScore,
          cashflowScore: listing.evaluation.cashflowScore,
          equityGrowthScore: listing.evaluation.equityGrowthScore,
        }
      : null,
    underwriting: getListingCashRequirement(
      listing.price,
      listing.units,
      false,
      listing.propertyType
    ),
    roi: computeListingCashOnCashRoi({
      price: listing.price,
      city: listing.city,
      units: listing.units,
      propertyType: listing.propertyType,
      ownerOccupied: false,
    }),
  }));

  return <SoldListingsClient initialListings={listings} initialTotal={total} />;
}

function dateToIso(value?: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
