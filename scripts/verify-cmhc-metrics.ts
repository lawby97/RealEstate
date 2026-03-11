import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function assertMetric(label: string, actual: number | null | undefined, expected: number) {
  if (actual == null) {
    throw new Error(`${label}: missing metric, expected ${expected}`);
  }
  if (actual !== expected) {
    throw new Error(`${label}: got ${actual}, expected ${expected}`);
  }
  console.log(`ok ${label}: ${actual}`);
}

async function main() {
  const montreal = await prisma.marketCity.findUniqueOrThrow({
    where: { city_province: { city: "Montreal", province: "QC" } },
  });
  const zone7 = await prisma.marketZone.findUniqueOrThrow({
    where: { marketCityId_zoneCode: { marketCityId: montreal.id, zoneCode: "7" } },
  });

  const montrealIsland2015 = await prisma.marketMetric.findFirst({
    where: {
      marketCityId: montreal.id,
      zoneId: zone7.id,
      metricType: "average_rent",
      bedroomType: "2_bed",
      yearBuiltBucket: "2015_plus",
      surveyYear: 2025,
      value: { not: null },
      suppressionFlag: false,
    },
  });
  await assertMetric("Montreal Zone 7 2015+ 2-bed", montrealIsland2015?.value, 1971);

  const lavalZone19 = await prisma.marketZone.findUniqueOrThrow({
    where: { marketCityId_zoneCode: { marketCityId: montreal.id, zoneCode: "19" } },
  });
  const laval2015 = await prisma.marketMetric.findFirst({
    where: {
      marketCityId: montreal.id,
      zoneId: lavalZone19.id,
      metricType: "average_rent",
      bedroomType: "2_bed",
      yearBuiltBucket: "2015_plus",
      surveyYear: 2025,
      value: { not: null },
      suppressionFlag: false,
    },
  });
  await assertMetric("Laval Zone 19 2015+ 2-bed", laval2015?.value, 2032);

  const toronto = await prisma.marketCity.findUniqueOrThrow({
    where: { city_province: { city: "Toronto", province: "ON" } },
  });
  const zone2 = await prisma.marketZone.findUniqueOrThrow({
    where: { marketCityId_zoneCode: { marketCityId: toronto.id, zoneCode: "2" } },
  });
  const torontoFormerCity = await prisma.marketMetric.findFirst({
    where: {
      marketCityId: toronto.id,
      zoneId: zone2.id,
      metricType: "average_rent",
      bedroomType: "2_bed",
      yearBuiltBucket: "2015_plus",
      surveyYear: 2025,
      value: { not: null },
      suppressionFlag: false,
    },
  });
  await assertMetric("Toronto Zone 2 2015+ 2-bed", torontoFormerCity?.value, 3569);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
