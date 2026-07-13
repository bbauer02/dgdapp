import type { CostumeDossier, DossierMessage } from "@prisma/client";
import type { DossierView } from "@/components/dossiers/DossierThread";

const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

type DossierWithMessages = CostumeDossier & {
  messages: Array<DossierMessage & { author: { firstName: string; lastName: string } }>;
};

/** Serialize a dossier (+ thread) for the client components — dates are
 *  formatted server-side so both sides render the exact same strings. */
export function toDossierView(dossier: DossierWithMessages | null): DossierView | null {
  if (!dossier) return null;
  return {
    id: dossier.id,
    type: dossier.type,
    status: dossier.status,
    fileUrls: dossier.fileUrls,
    submittedAtLabel: dateTimeFmt.format(dossier.submittedAt),
    messages: dossier.messages.map((m) => ({
      id: m.id,
      fromAdmin: m.fromAdmin,
      body: m.body,
      authorName: `${m.author.firstName} ${m.author.lastName}`.trim(),
      createdAtLabel: dateTimeFmt.format(m.createdAt),
    })),
  };
}

/** Prisma `include` fragment matching `DossierWithMessages`. */
export const dossierInclude = {
  messages: {
    include: { author: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "asc" as const },
  },
};
