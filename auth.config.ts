import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

// Edge-safe config: no Prisma / bcrypt here so it can run in middleware.
// The Credentials provider (Node-only) is added in auth.ts.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    // Route protection — runs in middleware.
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      const isAdminRoute = pathname.startsWith("/admin");
      // Owner-only pages (e.g. /players/[id]/edit) guard themselves server-side
      // via requireSelfOrAdmin. The /players roster + profiles are public, so
      // we must NOT gate the "/players" prefix here.
      const isProfileEdit = /^\/players\/[^/]+\/edit\/?$/.test(pathname);

      if (isAdminRoute) {
        // The back-office is open to association admins too (per-module
        // rights need the DB, unavailable in edge middleware) — the admin
        // layout + every page/action enforce the fine-grained checks.
        return isLoggedIn; // false → redirect to signIn
      }
      if (isProfileEdit) {
        return isLoggedIn; // fine-grained owner/admin check runs in the action + page
      }

      // RF-03: a freshly provisioned OAuth account must complete its profile
      // before browsing. Only page navigations are rerouted.
      if (
        isLoggedIn &&
        auth.user.profileComplete === false &&
        auth.user.id &&
        !pathname.startsWith("/api") &&
        !pathname.startsWith("/login") &&
        !pathname.startsWith("/_next")
      ) {
        return Response.redirect(
          new URL(`/players/${auth.user.id}/edit`, request.url)
        );
      }
      return true;
    },
    // Carry id + role into the JWT (user is present only at sign-in).
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.profileComplete = user.profileComplete;
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.profileComplete = token.profileComplete as boolean | undefined;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
