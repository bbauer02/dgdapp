import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Edge middleware using only the edge-safe config (JWT read, no DB).
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Run on app routes but skip static assets, images, and the auth API.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|uploads).*)"],
};
