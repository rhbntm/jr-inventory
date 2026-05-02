import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { db as prisma } from "./db";
import { checkRateLimit, recordFailedAttempt } from "./rate-limit";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Check rate limit before processing
        const rateLimit = checkRateLimit(credentials.email.toLowerCase());
        if (!rateLimit.allowed) {
          throw new Error("TooManyAttempts");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          recordFailedAttempt(credentials.email.toLowerCase());
          return null;
        }

        // Check if user has no password (Google-only account)
        if (!user.password) {
          recordFailedAttempt(credentials.email.toLowerCase());
          throw new Error("OAuthUser");
        }

        const isValid = await compare(credentials.password, user.password);

        if (!isValid) {
          recordFailedAttempt(credentials.email.toLowerCase());
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      if (account?.provider === "google" && user) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });
        if (dbUser) {
          token.role = dbUser.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        if (!existingUser) {
          // Check if setup has been completed (any users exist)
          const userCount = await prisma.user.count();

          // Block Google sign-in if no users exist - require setup first
          if (userCount === 0) {
            throw new Error("SetupRequired");
          }

          // Create new Google user as PARTNER (setup already done)
          await prisma.user.create({
            data: {
              email: user.email!,
              name: user.name || profile?.name || "User",
              image: user.image,
              role: "PARTNER",
            },
          });
        }
      }
      return true;
    },
  },
};
