import AuthForm from "@/components/auth/AuthForm";
import { oauthLoginAction, registerAction } from "@/lib/actions/auth";
import { oauthProviders } from "@/auth";

export default function RegisterPage() {
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold">Créer un compte</h1>
      <AuthForm
        mode="register"
        action={registerAction}
        oauth={oauthProviders}
        oauthAction={oauthLoginAction}
      />
    </>
  );
}
