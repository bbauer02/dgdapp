"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MAIN_NAV } from "@/lib/nav";
import { signOutAction } from "@/lib/actions/auth";

export interface HeaderUser {
  id: string;
  name: string;
  role: "ADMIN" | "PLAYER";
}

interface HeaderAsso {
  id: string;
  name: string;
  /** Éléments en attente de traitement (adhésions, réclamations…). */
  pending?: number;
}

function PendingBadge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-gold px-1 font-nav text-[0.6rem] font-bold text-base">
      {count}
    </span>
  );
}

const itemCls =
  "block px-4 py-2.5 font-nav text-xs font-semibold uppercase tracking-wider text-ink-soft transition hover:bg-surface-raised hover:text-lime";

/**
 * Switcher d'association : un dashboard par asso. Affiche l'asso "courante"
 * (déduite de l'URL) et permet de basculer vers le dashboard d'une autre.
 */
function AssoSwitcher({ assos }: { assos: HeaderAsso[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const currentId = pathname.match(/^\/associations\/([^/]+)/)?.[1];
  const current = assos.find((a) => a.id === currentId);

  // Une seule association : lien direct vers son dashboard, pas de menu.
  if (assos.length === 1) {
    return (
      <Link
        href={`/associations/${assos[0].id}/dashboard`}
        className="hidden max-w-40 items-center gap-1.5 truncate px-2 font-nav text-xs font-semibold uppercase tracking-wider text-ink-soft transition hover:text-white sm:flex"
        title={`Dashboard — ${assos[0].name}`}
      >
        <span className="slash !h-3" aria-hidden />
        <span className="truncate">{assos[0].name}</span>
        <PendingBadge count={assos[0].pending} />
      </Link>
    );
  }

  const totalPending = assos.reduce((s, a) => s + (a.pending ?? 0), 0);

  return (
    <div
      className="relative hidden sm:block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex max-w-44 items-center gap-1.5 px-2 py-2 font-nav text-xs font-semibold uppercase tracking-wider text-ink-soft transition hover:text-white"
      >
        <span className="slash !h-3" aria-hidden />
        <span className="truncate">{current?.name ?? "Mes assos"}</span>
        <PendingBadge count={totalPending} />
        <span className="text-lime">+</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full min-w-52 border border-hair bg-surface shadow-neon-violet"
        >
          {assos.map((a) => (
            <Link
              key={a.id}
              role="menuitem"
              href={`/associations/${a.id}/dashboard`}
              onClick={() => setOpen(false)}
              className={`${itemCls} flex items-center gap-2 ${a.id === currentId ? "!text-lime" : ""}`}
            >
              {a.id === currentId && <span aria-hidden>▸ </span>}
              <span className="min-w-0 flex-1 truncate">{a.name}</span>
              <PendingBadge count={a.pending} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Menu utilisateur : le nom devient la porte d'entrée vers "mes" pages. */
function UserMenu({ user }: { user: HeaderUser }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative hidden sm:block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1 px-2 py-2 font-nav text-xs font-semibold uppercase tracking-wider text-lime transition hover:text-white"
      >
        {user.name}
        <span className="text-lime">+</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full min-w-48 border border-hair bg-surface shadow-neon-violet"
        >
          <Link role="menuitem" href={`/players/${user.id}`} onClick={() => setOpen(false)} className={itemCls}>
            Mon profil
          </Link>
          <Link role="menuitem" href="/me/inscriptions" onClick={() => setOpen(false)} className={itemCls}>
            Mes inscriptions
          </Link>
          <Link role="menuitem" href="/dashboard" onClick={() => setOpen(false)} className={itemCls}>
            Mon QG
          </Link>
          {user.role === "ADMIN" && (
            <Link role="menuitem" href="/admin" onClick={() => setOpen(false)} className={itemCls}>
              Admin plateforme
            </Link>
          )}
          <form action={signOutAction}>
            <button role="menuitem" className={`${itemCls} w-full text-left hover:!text-danger`}>
              Sortir
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default function SiteHeader({ user }: { user: HeaderUser | null }) {
  const [open, setOpen] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [assos, setAssos] = useState<HeaderAsso[]>([]);
  const pathname = usePathname();

  // Les associations du membre (switcher). Un fetch client évite de modifier
  // chaque page qui instancie le header.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/me/associations")
      .then((r) => (r.ok ? r.json() : { associations: [] }))
      .then((d) => {
        if (!cancelled) setAssos(d.associations ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!user]);

  // Fermer le panneau mobile à chaque navigation.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-hair bg-base/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        {/* Wordmark */}
        <Link href="/" className="flex items-center gap-2">
          <span className="slash" aria-hidden />
          <span className="font-display text-lg font-bold uppercase tracking-tight text-white">
            DGD
          </span>
        </Link>

        {/* Data-driven nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {MAIN_NAV.map((item) => (
            <div
              key={item.label}
              className="relative"
              onMouseEnter={() => setOpen(item.label)}
              onMouseLeave={() => setOpen(null)}
            >
              <Link
                href={item.href}
                className="flex items-center gap-1 px-4 py-2 font-nav text-xs font-semibold uppercase tracking-wider text-ink-soft transition hover:text-white"
              >
                {item.label}
                {item.children && <span className="text-lime">+</span>}
              </Link>
              {item.children && open === item.label && (
                <div className="absolute left-0 top-full min-w-44 border border-hair bg-surface shadow-neon-violet">
                  {item.children.map((c) => (
                    <Link key={c.label} href={c.href} className={itemCls}>
                      {c.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Session zone */}
        <div className="flex items-center gap-3">
          {!user ? (
            <>
              <Link
                href="/login"
                className="font-nav text-xs font-semibold uppercase tracking-wider text-ink-soft hover:text-white"
              >
                Connexion
              </Link>
              <Link href="/register" className="btn btn-primary !py-2 !px-4">
                S'enrôler
              </Link>
            </>
          ) : (
            <>
              {assos.length > 0 && <AssoSwitcher assos={assos} />}
              <UserMenu user={user} />
            </>
          )}

          {/* Burger mobile */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={mobileOpen}
            className="flex h-9 w-9 flex-col items-center justify-center gap-1.5 border border-hair text-ink md:hidden"
          >
            <span
              className={`h-0.5 w-5 bg-current transition ${mobileOpen ? "translate-y-2 rotate-45" : ""}`}
            />
            <span className={`h-0.5 w-5 bg-current transition ${mobileOpen ? "opacity-0" : ""}`} />
            <span
              className={`h-0.5 w-5 bg-current transition ${mobileOpen ? "-translate-y-2 -rotate-45" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Panneau mobile : nav + mes assos + mon compte */}
      {mobileOpen && (
        <nav className="border-t border-hair bg-surface md:hidden">
          {MAIN_NAV.map((item) => (
            <Link key={item.label} href={item.href} className={itemCls}>
              {item.label}
            </Link>
          ))}

          {user && assos.length > 0 && (
            <>
              <p className="stat-label border-t border-hair px-4 pb-1 pt-3">Mes associations</p>
              {assos.map((a) => (
                <Link key={a.id} href={`/associations/${a.id}/dashboard`} className={itemCls}>
                  {a.name}
                </Link>
              ))}
            </>
          )}

          {user ? (
            <>
              <p className="stat-label border-t border-hair px-4 pb-1 pt-3">{user.name}</p>
              <Link href={`/players/${user.id}`} className={itemCls}>
                Mon profil
              </Link>
              <Link href="/me/inscriptions" className={itemCls}>
                Mes inscriptions
              </Link>
              <Link href="/dashboard" className={itemCls}>
                Mon QG
              </Link>
              {user.role === "ADMIN" && (
                <Link href="/admin" className={itemCls}>
                  Admin plateforme
                </Link>
              )}
              <form action={signOutAction}>
                <button className={`${itemCls} w-full text-left hover:!text-danger`}>Sortir</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className={`${itemCls} border-t border-hair`}>
                Connexion
              </Link>
              <Link href="/register" className={itemCls}>
                S'enrôler
              </Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
