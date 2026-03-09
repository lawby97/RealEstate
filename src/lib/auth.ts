import NextAuth, { type DefaultSession } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user) {
          const hashed = credentials.password
            ? await bcrypt.hash(credentials.password, 10)
            : null;
          return prisma.user.create({
            data: {
              email: credentials.email,
              name: credentials.email.split("@")[0],
              password: hashed,
            },
          });
        }
        if (credentials.password && user.password) {
          const ok = await bcrypt.compare(credentials.password, user.password);
          if (!ok) return null;
        }
        return user;
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  session: { strategy: "jwt" as const, maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/signin" },
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: { id: string } }) {
      if (user) (token as JWT & { id?: string }).id = user.id;
      return token;
    },
    async session({ session, token }: { session: DefaultSession; token: JWT }) {
      if (session.user) (session.user as DefaultSession["user"] & { id?: string }).id = (token as JWT & { id?: string }).id;
      return session;
    },
  },
};
