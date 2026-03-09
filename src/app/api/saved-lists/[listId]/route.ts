import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { listId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const listId = params.listId;
  const body = await req.json();
  const listingId = body?.listingId as string;
  if (!listingId) {
    return Response.json({ error: "listingId required" }, { status: 400 });
  }
  await prisma.savedListItem.upsert({
    where: {
      savedListId_listingId: { savedListId: listId, listingId },
    },
    create: { savedListId: listId, listingId },
    update: {},
  });
  return Response.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { listId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const listId = params.listId;
  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get("listingId");
  if (!listingId) {
    return Response.json({ error: "listingId required" }, { status: 400 });
  }
  await prisma.savedListItem.deleteMany({
    where: { savedListId: listId, listingId },
  });
  return Response.json({ ok: true });
}
