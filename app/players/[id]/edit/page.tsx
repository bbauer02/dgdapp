import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSelfOrAdmin } from "@/lib/auth-guards";
import SiteHeader, { type HeaderUser } from "@/components/site/SiteHeader";
import ProfileEditForm from "@/components/players/ProfileEditForm";
import CampGearManager from "@/components/players/CampGearManager";
import { updateProfile } from "@/lib/actions/profile";

function toDateInput(d: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default async function EditProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSelfOrAdmin(id);

  const headerUser: HeaderUser = {
    id: session.user.id,
    name: session.user.name ?? "Profil",
    image: session.user.image ?? null,
    role: session.user.role,
  };

  const [p, associations] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: {
        association: true,
        campGear: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.association.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!p) notFound();

  // Prisma Decimals aren't serializable to a client component → to numbers.
  const gear = p.campGear.map((g) => ({
    id: g.id,
    label: g.label,
    tentType: g.tentType,
    shape: g.shape,
    diameterM: g.diameterM ? Number(g.diameterM) : null,
    widthM: g.widthM ? Number(g.widthM) : null,
    lengthM: g.lengthM ? Number(g.lengthM) : null,
    footprintAreaM2: g.footprintAreaM2 ? Number(g.footprintAreaM2) : null,
    ropeZoneRadiusM: Number(g.ropeZoneRadiusM),
    color: g.color,
    segments: g.segments,
  }));

  const updateAction = updateProfile.bind(null, p.id);

  return (
    <main className="min-h-screen">
      <SiteHeader user={headerUser} />

      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="kicker">Édition du profil</p>
        <h1 className="mt-2 font-display text-4xl font-bold text-white">
          {p.firstName} {p.lastName}
        </h1>

        <div className="mt-10">
          <ProfileEditForm
            action={updateAction}
            cancelHref={`/players/${p.id}`}
            associations={associations.map((a) => ({ id: a.id, name: a.name }))}
            defaults={{
              firstName: p.firstName,
              lastName: p.lastName,
              birthDate: toDateInput(p.birthDate),
              profilePicture: p.profilePicture ?? "",
              associationId: p.associationId ?? "",
              civilianCostumePics: p.civilianCostumePics.join("\n"),
              militaryCostumePics: p.militaryCostumePics.join("\n"),
            }}
          />
        </div>

        <div className="mt-12 border-t border-hair pt-10">
          <CampGearManager userId={p.id} gear={gear} />
        </div>
      </div>
    </main>
  );
}
