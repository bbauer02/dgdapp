import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasOrganiserAccess } from "@/lib/permissions";
import SiteHeader, { type HeaderUser } from "@/components/site/SiteHeader";
import AdminNav from "@/components/admin/AdminNav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  // "Admin d'association" (Écriture sur au moins un module) ou ADMIN
  // plateforme — chaque page/action re-vérifie ensuite le module précis
  // (RG-01).
  if (!(await hasOrganiserAccess())) redirect("/");

  const headerUser: HeaderUser = {
    id: session.user.id,
    name: session.user.name ?? "Profil",
    image: session.user.image ?? null,
    role: session.user.role,
  };

  return (
    <div className="flex min-h-screen flex-col bg-base">
      {/* Le même header que partout ailleurs : l'admin n'est plus un monde à part. */}
      <SiteHeader user={headerUser} />
      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-hair bg-surface md:flex">
          <span className="kicker block border-b border-hair p-4 !text-ink-faint">
            Poste de commandement
          </span>
          <AdminNav />
        </aside>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
