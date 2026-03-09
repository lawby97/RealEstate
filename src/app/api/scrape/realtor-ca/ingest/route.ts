import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluateListing } from "@/lib/evaluation";
import { mapRealtorCaListing, type RealtorCaListing } from "@/lib/realtor-ca-api";

const MAX_LISTINGS_PER_REQUEST = 1000;

/**
 * POST /api/scrape/realtor-ca/ingest
 *
 * Ingest Realtor.ca-shaped listing data (e.g. from Apify, browser scraper, or
 * saved JSON). Body: { "listings": [ ... ] } or { "items": [ ... ] } (Apify) or [ ... ].
 *
 * Supports both PascalCase (realtor.ca API) and camelCase (Apify-style) field names.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawList =
      Array.isArray(body.listings) ? body.listings
      : Array.isArray(body.items) ? body.items
      : Array.isArray(body) ? body
      : Array.isArray(body.data) ? body.data
      : [];
    const rawListings = rawList.slice(0, MAX_LISTINGS_PER_REQUEST) as RealtorCaListing[];

    if (rawListings.length === 0) {
      return Response.json(
        {
          ok: false,
          error: "Missing or empty listings. Send { listings: [ ... ] } or { items: [ ... ] } (Apify) or a JSON array. Supports PascalCase (Id, City, Price) or camelCase (id, city, price).",
          source: "realtor_ca",
        },
        { status: 400 }
      );
    }

    let created = 0;
    let updated = 0;

    for (const raw of rawListings) {
      try {
        const mapped = mapRealtorCaListing(raw);
        const listing = await prisma.listing.upsert({
          where: { externalId: mapped.externalId },
          create: mapped,
          update: {
            price: mapped.price,
            address: mapped.address,
            city: mapped.city,
            province: mapped.province,
            postalCode: mapped.postalCode,
            latitude: mapped.latitude,
            longitude: mapped.longitude,
            bedrooms: mapped.bedrooms,
            bathrooms: mapped.bathrooms,
            squareFeet: mapped.squareFeet,
            lotSizeSqFt: mapped.lotSizeSqFt,
            yearBuilt: mapped.yearBuilt,
            description: mapped.description,
            photoUrls: mapped.photoUrls,
            listingUrl: mapped.listingUrl,
            lastSeenAt: new Date(),
            rawJson: mapped.rawJson,
          },
        });
        if (listing.createdAt.getTime() === listing.updatedAt.getTime()) created++;
        else updated++;

        const result = evaluateListing({
          price: listing.price,
          city: listing.city,
          province: listing.province,
          postalCode: listing.postalCode,
          units: listing.units,
          bedrooms: listing.bedrooms,
        });

        await prisma.listingEvaluation.upsert({
          where: { listingId: listing.id },
          create: {
            listingId: listing.id,
            cashflowScore: result.cashflowScore,
            equityGrowthScore: result.equityGrowthScore,
            combinedScore: result.combinedScore,
            cashflowNotes: result.cashflowNotes,
            equityNotes: result.equityNotes,
          },
          update: {
            cashflowScore: result.cashflowScore,
            equityGrowthScore: result.equityGrowthScore,
            combinedScore: result.combinedScore,
            cashflowNotes: result.cashflowNotes,
            equityNotes: result.equityNotes,
            computedAt: new Date(),
          },
        });
      } catch (e) {
        console.warn("Skip listing:", raw?.Id ?? raw, e);
      }
    }

    return Response.json({
      ok: true,
      source: "realtor_ca",
      received: rawListings.length,
      created,
      updated,
      evaluated: created + updated,
      message: `Ingested ${rawListings.length} Realtor.ca listings (${created} new, ${updated} updated).`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingest failed";
    return Response.json(
      { ok: false, error: message, source: "realtor_ca" },
      { status: 500 }
    );
  }
}
