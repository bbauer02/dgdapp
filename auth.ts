import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Discord from "next-auth/providers/discord";
import bcrypt from "bcryptjs";
import type { OAuthProvider } from "@prisma/client";
import { authConfig } from "./auth.config";
import { prisma } from "./lib/prisma";

// Map an Auth.js provider id to our DB enum.
function toDbProvider(provider: string): OAuthProvider | null {
  if (provider === "google") return "GOOGLE";
  if (provider === "discord") return "DISCORD";
  return null;
}

// RF-01: sign-in is OAuth-first (Google, Discord). Providers are wired only
// when their env credentials exist, so the app still runs before the OAuth
// apps are provisioned. Credentials remains as a dev/seed fallback.
export const oauthProviders = {
  google: !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
  discord: !!(process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET),
};

const providers = [
  ...(oauthProviders.google ? [Google] : []),
  ...(oauthProviders.discord ? [Discord] : []),
  Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Mot de passe", type: "password" },
    },
    async authorize(credentials) {
      const email = String(credentials?.email ?? "").trim().toLowerCase();
      const password = String(credentials?.password ?? "");
      if (!email || !password) return null;

      // Email is only a lookup key for credentials accounts (provider null);
      // OAuth accounts are keyed by (provider, providerId) — RF-02.
      const user = await prisma.user.findFirst({
        where: { email, provider: null },
      });
      if (!user?.passwordHash) return null;

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return null;

      return {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`.trim(),
        image: user.profilePicture,
        role: user.role,
        profileComplete: user.profileComplete,
      };
    },
  }),
];

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers,
  callbacks: {
    ...authConfig.callbacks,

    // First OAuth sign-in provisions the local account. Strictly keyed by
    // (provider, providerId): same email on another provider = distinct
    // account, never merged (RF-02).
    async signIn({ user, account, profile }) {
      if (!account || account.provider === "credentials") return true;
      const provider = toDbProvider(account.provider);
      if (!provider) return false;

      const providerId = account.providerAccountId;
      const existing = await prisma.user.findUnique({
        where: { provider_providerId: { provider, providerId } },
      });
      if (existing) return true;

      const name = (user.name ?? (profile?.name as string) ?? "").trim();
      const [firstName, ...rest] = name.split(/\s+/);
      await prisma.user.create({
        data: {
          email: (user.email ?? "").toLowerCase(),
          provider,
          providerId,
          firstName: firstName || "Nouveau",
          lastName: rest.join(" ") || "Membre",
          profilePicture: user.image ?? null,
          profileComplete: false, // RF-03: complete after first sign-in
        },
      });
      return true;
    },

    // Node-side JWT: resolve the DB account so the token carries OUR user id
    // (not the provider's). Overrides the edge-safe jwt in auth.config.
    async jwt({ token, user, account, trigger }) {
      // Profile edits call unstable_update(): reload the DB user so the token
      // (and thus the header name/avatar) reflects the new firstName/lastName.
      if (trigger === "update" && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
        });
        if (dbUser) {
          token.name = `${dbUser.firstName} ${dbUser.lastName}`.trim();
          token.picture = dbUser.profilePicture ?? null;
          token.role = dbUser.role;
          token.profileComplete = dbUser.profileComplete;
        }
        return token;
      }
      if (account && account.provider !== "credentials") {
        const provider = toDbProvider(account.provider);
        if (provider) {
          const dbUser = await prisma.user.findUnique({
            where: {
              provider_providerId: {
                provider,
                providerId: account.providerAccountId,
              },
            },
          });
          if (dbUser) {
            token.id = dbUser.id;
            token.role = dbUser.role;
            token.profileComplete = dbUser.profileComplete;
          }
        }
      } else if (user) {
        token.id = user.id;
        token.role = user.role;
        token.profileComplete = user.profileComplete;
      }
      return token;
    },
  },
});
