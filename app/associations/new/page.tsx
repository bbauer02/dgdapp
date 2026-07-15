import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import SiteHeader, { type HeaderUser } from "@/components/site/SiteHeader";
import AssociationCreateForm from "@/components/associations/AssociationCreateForm";

// RF-05 : tout utilisateur connecté peut créer une association.
export default async function NewAssociationPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const headerUser: HeaderUser = {
    id: session.user.id,
    name: session.user.name ?? "Profil",
    image: session.user.image ?? null,
    role: session.user.role,
  };

  return (
    <main className="min-h-screen">
      <SiteHeader user={headerUser} />

      <section className="mx-auto max-w-xl px-6 py-12">
        <Link
          href="/associations"
          className="font-nav text-xs uppercase tracking-wider text-ink-soft hover:text-lime"
        >
          ← Toutes les associations
        </Link>

        <p className="kicker mt-6 flex items-center gap-3">
          <span className="slash" aria-hidden />
          Nouvelle bannière
        </p>
        <h1 className="mt-3 font-display text-5xl font-bold text-white">
          Fonder une association
        </h1>

        <div className="panel mt-8 p-6">
          <AssociationCreateForm />
        </div>
      </section>
    </main>
  );
}
