import AuthForm from "@/components/auth/AuthForm";
import { loginAction, oauthLoginAction, quickLoginAction } from "@/lib/actions/auth";
import { oauthProviders } from "@/auth";

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold">Connexion</h1>
      <AuthForm
        mode="login"
        action={loginAction}
        oauth={oauthProviders}
        oauthAction={oauthLoginAction}
      />

      {/* DEV: quick account-type switch (seed accounts) */}
      <div className="mt-6 border-t border-hair pt-5">
        <p className="stat-label mb-3 text-center">Accès rapide · dev</p>
        <div className="grid grid-cols-2 gap-3">
          <form action={quickLoginAction.bind(null, "admin")}>
            <button type="submit" className="btn btn-ghost w-full">
              Admin
            </button>
          </form>
          <form action={quickLoginAction.bind(null, "player")}>
            <button type="submit" className="btn btn-lime w-full">
              Joueur
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
