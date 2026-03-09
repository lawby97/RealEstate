import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  const minUnits = searchParams.get("minUnits");
  const minScore = searchParams.get("minScore");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "24", 10), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  const where: Record<string, unknown> = {};
  if (city) {
    const c = city.trim();
    if (c.toLowerCase() === "montreal") {
      where.OR = [
        { city: { contains: "Montreal" } },
        { city: { contains: "Montréal" } },
      ];
    } else {
      where.city = { contains: c };
    }
  }
  if (minPrice) where.price = { ...((where.price as object) || {}), gte: parseFloat(minPrice) };
  if (maxPrice) where.price = { ...((where.price as object) || {}), lte: parseFloat(maxPrice) };
  if (minUnits) where.units = { gte: parseInt(minUnits, 10) };
  if (minScore) {
    where.evaluation = {
      combinedScore: { gte: parseFloat(minScore) },
    };
  }

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy: { price: "asc" },
      take: limit,
      skip: offset,
      include: { evaluation: true },
    }),
    prisma.listing.count({ where }),
  ]);

  return Response.json({ listings, total });
}
