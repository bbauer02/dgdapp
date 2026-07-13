"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { AuthFormState } from "@/lib/actions/auth";

type Action = (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;

const inputCls =
  "rounded-none border border-hair bg-base px-3 py-2 text-ink outline-none transition focus:border-violet focus:shadow-neon-violet";

export default function AuthForm({
  mode,
  action,
  oauth,
  oauthAction,
}: {
  mode: "login" | "register";
  action: Action;
  /** Which OAuth providers are configured (buttons hidden otherwise). */
  oauth?: { google: boolean; discord: boolean };
  oauthAction?: (provider: "google" | "discord") => Promise<void>;
}) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    action,
    undefined
  );
  const isRegister = mode === "register";
  const hasOauth = !!oauthAction && (oauth?.google || oauth?.discord);

  return (
    <div className="flex flex-col gap-5">
      {hasOauth && (
        <div className="flex flex-col gap-3">
          {oauth?.google && (
            <button
              type="button"
              onClick={() => oauthAction!("google")}
              className="btn btn-ghost w-full justify-center"
            >
              {isRegister ? "S'enrôler" : "Connexion"} avec Google
            </button>
          )}
          {oauth?.discord && (
            <button
              type="button"
              onClick={() => oauthAction!("discord")}
              className="btn btn-ghost w-full justify-center"
            >
              {isRegister ? "S'enrôler" : "Connexion"} avec Discord
            </button>
          )}
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-hair" />
            <span className="font-nav text-[10px] uppercase tracking-widest text-ink-faint">
              ou par email
            </span>
            <span className="h-px flex-1 bg-hair" />
          </div>
        </div>
      )}

      <form action={formAction} className="flex flex-col gap-4">
      {isRegister && (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="stat-label">Prénom</span>
            <input name="firstName" required className={inputCls} autoComplete="given-name" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="stat-label">Nom</span>
            <input name="lastName" required className={inputCls} autoComplete="family-name" />
          </label>
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className="stat-label">Email</span>
        <input name="email" type="email" required className={inputCls} autoComplete="email" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="stat-label">Mot de passe</span>
        <input
          name="password"
          type="password"
          required
          minLength={isRegister ? 8 : undefined}
          className={inputCls}
          autoComplete={isRegister ? "new-password" : "current-password"}
        />
      </label>

      {state?.error && (
        <p className="badge badge-no w-full justify-center py-2">{state.error}</p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary mt-1 disabled:opacity-60">
        {pending ? "…" : isRegister ? "S'enrôler" : "Se connecter"}
      </button>

      <p className="text-center font-nav text-xs uppercase tracking-wider text-ink-faint">
        {isRegister ? (
          <>
            Déjà enrôlé ?{" "}
            <Link href="/login" className="text-lime hover:underline">
              Connexion
            </Link>
          </>
        ) : (
          <>
            Pas de compte ?{" "}
            <Link href="/register" className="text-lime hover:underline">
              S'enrôler
            </Link>
          </>
        )}
      </p>
      </form>
    </div>
  );
}
