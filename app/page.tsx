import Link from "next/link";
import { auth } from "@/auth";
import SiteHeader, { type HeaderUser } from "@/components/site/SiteHeader";

export default async function Home() {
  const session = await auth();
  const user: HeaderUser | null = session
    ? { id: session.user.id, name: session.user.name ?? "Profil", role: session.user.role }
    : null;

  return (
    <main className="min-h-screen">
      <SiteHeader user={user} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-hex">
        {/* Decorative neon slashes */}
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 md:block">
          <div className="absolute right-24 top-1/2 h-72 w-10 -translate-y-1/2 -skew-x-[20deg] bg-violet/70 blur-[1px]" />
          <div className="absolute right-8 top-1/2 h-72 w-16 -translate-y-1/2 -skew-x-[20deg] bg-lime shadow-neon-lime" />
          <div className="absolute right-40 top-1/2 h-72 w-4 -translate-y-1/2 -skew-x-[20deg] bg-violet-bright/60" />
        </div>

        <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 py-24 md:min-h-[78vh] md:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="kicker flex items-center gap-3">
              <span className="slash" aria-hidden />
              Reconstitutions · Tournois · Campements
            </p>
            <h1 className="mt-5 font-display text-6xl font-bold leading-[0.92] text-white md:text-8xl">
              Entrez
              <br />
              en <span className="text-violet-bright">campagne</span>
            </h1>
            <p className="mt-6 max-w-md font-nav text-base leading-relaxed text-ink-soft">
              Organisez vos événements et tournois de reconstitution, gérez les
              inscriptions, forgez le profil de chaque participant et tracez le
              plan de camp au mètre près.
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link href={user ? "/players" : "/register"} className="btn btn-lime">
                {user ? "Voir les participants" : "Rejoindre la campagne"}
              </Link>
              <Link href="/events" className="btn btn-ghost">
                Voir les événements
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="mx-auto grid max-w-7xl gap-4 px-6 py-16 md:grid-cols-3">
        {[
          { k: "01", t: "Événements & tournois", d: "Campagnes, formules, compositions et classements.", c: "text-violet-bright" },
          { k: "02", t: "Profils dynamiques", d: "Fiches de participants : costumes, matériel, palmarès.", c: "text-lime" },
          { k: "03", t: "Plan de camp à l'échelle", d: "Tentes au mètre près, cordage et emprises.", c: "text-faction-3" },
        ].map((c) => (
          <div key={c.k} className="panel group relative overflow-hidden p-6">
            <div className={`font-display text-4xl font-bold ${c.c}`}>{c.k}</div>
            <div className="absolute right-0 top-0 h-1 w-16 -skew-x-[20deg] bg-current opacity-20" />
            <h3 className="mt-3 text-lg text-white">{c.t}</h3>
            <p className="mt-1 font-nav text-sm text-ink-soft">{c.d}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
