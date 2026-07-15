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

      {/* DEV: one-click login using the seed admin account. */}
      <div className="mt-6 border-t border-hair pt-5">
        <p className="stat-label mb-3 text-center">Accès rapide · dev</p>
        <form action={quickLoginAction.bind(null, "admin")}>
          <button type="submit" className="btn btn-lime w-full">
            Connexion rapide (Admin)
          </button>
        </form>
      </div>
    </>
  );
}
