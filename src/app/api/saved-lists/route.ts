import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ lists: [] });
  }
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { savedLists: { include: { items: true } } },
  });
  return Response.json({ lists: user?.savedLists ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const name = body?.name as string;
  if (!name?.trim()) {
    return Response.json({ error: "Name required" }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });
  const list = await prisma.savedList.create({
    data: { userId: user.id, name: name.trim() },
  });
  return Response.json(list);
}
