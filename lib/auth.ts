import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { getServerSession, NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { db as prisma } from "./db";
import { checkRateLimit, recordFailedAttempt } from "./rate-limit";
import { ApiError } from "./errors";

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
      // Sign-in is invite-only (see signIn callback below), so an invited user row
      // exists before its first Google login. Linking by email is needed to attach
      // the Google account to that row. Google verifies email ownership.
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
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) return "/login?error=NotInvited";

        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        if (!existingUser) {
          // No users at all means the initial OWNER hasn't been set up yet.
          const userCount = await prisma.user.count();
          if (userCount === 0) return "/login?error=SetupRequired";

          // Invite-only: the owner must create the user first (npm run create-user).
          return "/login?error=NotInvited";
        }
      }
      return true;
    },
  },
};

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new ApiError(401, "Unauthorized");
  }
  return session;
}

/**
 * requireRole checks if the authenticated user has one of the allowed roles.
 * Currently unused, but preserved and documented for future role-gating requirements (e.g. Owner vs Partner access).
 */
export async function requireRole(...allowedRoles: Array<"OWNER" | "PARTNER">) {
  const session = await requireAuth();
  const userRole = session.user.role as "OWNER" | "PARTNER";
  if (!allowedRoles.includes(userRole)) {
    throw new ApiError(403, "Forbidden");
  }
  return session;
}
