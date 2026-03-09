import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : null;
    const lastName = typeof body.lastName === "string" ? body.lastName.trim() : null;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Valid email is required." }, { status: 400 });
    }
    if (password.length < 8) {
      return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return Response.json(
        { error: "Password must include at least one letter and one number." },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return Response.json({ error: "An account with this email already exists." }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 10);
    const name = [firstName, lastName].filter(Boolean).join(" ") || email.split("@")[0];
    await prisma.user.create({
      data: {
        email,
        password: hashed,
        name,
        firstName: firstName || null,
        lastName: lastName || null,
      },
    });

    return Response.json({ ok: true, message: "Account created. You can sign in." });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Registration failed." }, { status: 500 });
  }
}
