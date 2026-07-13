"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signIn, signOut } from "@/auth";

export type AuthFormState = { error?: string } | undefined;

const registerSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis"),
  lastName: z.string().trim().min(1, "Nom requis"),
  email: z.string().trim().toLowerCase().email("Email invalide"),
  password: z.string().min(8, "8 caractères minimum"),
});

export async function registerAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }
  const { firstName, lastName, email, password } = parsed.data;

  // Only credentials accounts (provider null) are keyed by email — RF-02.
  const existing = await prisma.user.findFirst({ where: { email, provider: null } });
  if (existing) {
    return { error: "Un compte existe déjà avec cet email." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { firstName, lastName, email, passwordHash, role: "PLAYER", profileComplete: true },
  });

  // Auto sign-in after registration.
  await signIn("credentials", { email, password, redirectTo: "/" });
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  try {
    // /dashboard aiguille : 1 asso → son dashboard, plusieurs → écran de choix.
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email ou mot de passe incorrect." };
    }
    throw error; // re-throw NEXT_REDIRECT
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

// RF-01: OAuth sign-in (Google / Discord). The provider must be enabled via
// its env credentials; the login page only shows configured providers.
export async function oauthLoginAction(provider: "google" | "discord") {
  await signIn(provider, { redirectTo: "/dashboard" });
}

// --- DEV: one-click login to switch account type quickly. Uses the seed
// accounts (all share "password123"). Remove before production. ---
const DEV_ACCOUNTS = {
  admin: { email: "admin@dgd.test", redirectTo: "/admin" },
  player: { email: "michel@dgd.test", redirectTo: "/dashboard" },
} as const;

export async function quickLoginAction(role: "admin" | "player") {
  const acc = DEV_ACCOUNTS[role];
  try {
    await signIn("credentials", {
      email: acc.email,
      password: "password123",
      redirectTo: acc.redirectTo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // Seed accounts missing → send back to the login form.
      redirect("/login?error=quicklogin");
    }
    throw error; // re-throw NEXT_REDIRECT
  }
}
