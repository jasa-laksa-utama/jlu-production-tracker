import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";
import { authConfig } from "./auth.config";

import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

export const { 
  handlers: { GET, POST }, 
  auth, 
  signIn, 
  signOut 
} = NextAuth({
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { username: credentials.username as string },
          include: { roles: true },
        });

        if (!user || !user.isActive) return null;

        const isPasswordCorrect = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isPasswordCorrect) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          position: user.position,
          roles: user.roles.map((r) => r.name),
        };
      },
    }),
  ],
});

// Type definitions for NextAuth
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      position: string;
      roles: string[];
    } & DefaultSession["user"];
  }

  interface User {
    username: string;
    position: string | null;
    roles: string[];
  }
}

import { DefaultSession } from "next-auth";
