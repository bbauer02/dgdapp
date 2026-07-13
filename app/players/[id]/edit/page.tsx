import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSelfOrAdmin } from "@/lib/auth-guards";
import SiteHeader, { type HeaderUser } from "@/components/site/SiteHeader";
import ProfileEditForm from "@/components/players/ProfileEditForm";
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
    role: session.user.role,
  };

  const [p, associations] = await Promise.all([
    prisma.user.findUnique({ where: { id }, include: { association: true } }),
    prisma.association.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!p) notFound();

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
      </div>
    </main>
  );
}
