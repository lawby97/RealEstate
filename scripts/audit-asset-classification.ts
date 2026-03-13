import { prisma } from "@/lib/prisma";
import { classifyAsset, formatNormalizedAssetLabel } from "@/lib/asset-classification";

async function main() {
  const rows = await prisma.listing.findMany({
    select: {
      id: true,
      address: true,
      propertyType: true,
      description: true,
      rawJson: true,
      bedrooms: true,
      bathrooms: true,
      squareFeet: true,
      lotSizeSqFt: true,
      units: true,
      price: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const parkingOverrides = rows
    .map((row) => {
      const classification = classifyAsset(row);
      return {
        id: row.id,
        address: row.address,
        sourceType: row.propertyType,
        normalizedAssetType: classification.normalizedAssetType,
        normalizedAssetLabel: formatNormalizedAssetLabel(
          classification.normalizedAssetType,
          classification.normalizedAssetSubtype
        ),
        confidence: classification.classificationConfidence,
        reasons: classification.classificationReasons,
      };
    })
    .filter(
      (row) =>
        /land/i.test(row.sourceType) &&
        row.normalizedAssetType === "parking"
    );

  console.log(
    JSON.stringify(
      {
        processed: rows.length,
        parkingOverridesFromLand: parkingOverrides.length,
        samples: parkingOverrides.slice(0, 20),
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
