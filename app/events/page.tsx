import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import SiteHeader, { type HeaderUser } from "@/components/site/SiteHeader";
import { visibleEventsWhere } from "@/lib/event-visibility";
import { eventPriceLabel } from "@/lib/event-pricing";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

function dateRange(start: Date, end: Date): string {
  return `${dateFmt.format(start)} — ${dateFmt.format(end)}`;
}

export default async function EventsPage() {
  const session = await auth();
  const headerUser: HeaderUser | null = session
    ? { id: session.user.id, name: session.user.name ?? "Profil", role: session.user.role, image: session.user.image ?? null }
    : null;

  // RF-12: MEMBERS events are only listed for ACTIVE members of the
  // organising association (or a platform ADMIN); PUBLIC for everyone.
  const events = await prisma.event.findMany({
    where: visibleEventsWhere(session),
    orderBy: { startDate: "asc" },
    include: {
      _count: { select: { registrations: true, packages: true } },
      packages: { select: { price: true } },
    },
  });

  const now = new Date();
  const upcoming = events.filter((e) => e.endDate >= now);
  const past = events.filter((e) => e.endDate < now);

  return (
    <main className="min-h-screen">
      <SiteHeader user={headerUser} />

      <section className="mx-auto max-w-7xl px-6 py-12">
        <p className="kicker flex items-center gap-3">
          <span className="slash" aria-hidden />
          Le calendrier
        </p>
        <h1 className="mt-3 font-display text-5xl font-bold text-white">Événements</h1>

        {events.length === 0 ? (
          <p className="mt-8 font-nav text-ink-soft">Aucun événement au programme.</p>
        ) : (
          <div className="mt-10 space-y-12">
            <EventGroup title="À venir" events={upcoming} accent="#A3FF12" />
            <EventGroup title="Passés" events={past} accent="#7C4DFF" muted />
          </div>
        )}
      </section>
    </main>
  );
}

type EventCard = {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  maxParticipants: number | null;
  visibility: "PUBLIC" | "MEMBERS";
  packages: { price: unknown }[];
  _count: { registrations: number; packages: number };
};

function EventGroup({
  title,
  events,
  accent,
  muted = false,
}: {
  title: string;
  events: EventCard[];
  accent: string;
  muted?: boolean;
}) {
  return (
    <section>
      <h2 className="flex items-center gap-3 font-display text-2xl font-bold uppercase text-white">
        <span className="inline-block h-4 w-8 -skew-x-[20deg]" style={{ background: accent }} />
        {title}
        <span className="font-nav text-xs font-semibold uppercase tracking-wider text-ink-faint">
          {events.length}
        </span>
      </h2>
      {events.length === 0 ? (
        <div className="mt-5 border border-dashed border-hair p-8 text-center font-nav text-sm uppercase tracking-wider text-ink-faint">
          {muted ? "Aucun événement passé." : "Aucun événement à venir."}
        </div>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <Link
              key={e.id}
              href={`/events/${e.id}`}
              className={`panel group relative flex flex-col gap-3 overflow-hidden p-5 transition hover:border-violet hover:shadow-neon-violet ${
                muted ? "opacity-80" : ""
              }`}
            >
              <span
                className="absolute right-0 top-0 h-full w-1.5 -skew-x-[20deg]"
                style={{ background: accent }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <span className="stat-label">{dateRange(e.startDate, e.endDate)}</span>
                {e.visibility === "MEMBERS" && (
                  <span className="badge badge-wait">Réservé aux membres</span>
                )}
              </div>
              <div className="font-display text-2xl font-bold uppercase leading-tight text-white">
                {e.title}
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 font-nav text-sm text-ink-soft">
                <span className="text-lime">
                  {e._count.registrations}
                  {e.maxParticipants != null ? ` / ${e.maxParticipants}` : ""} inscrit(s)
                </span>
                <span>· {eventPriceLabel(e.packages.map((p) => Number(p.price)))}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
