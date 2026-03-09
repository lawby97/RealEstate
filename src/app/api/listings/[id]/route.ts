import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { evaluation: true, area: true },
  });
  if (!listing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json(listing);
}
