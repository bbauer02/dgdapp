import { redirect } from "next/navigation";
import type { AppModule, PermissionLevel } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Per-association module rights (RF-08/RF-09, RG-01).
//   A member's effective rights are the UNION of the rights of all their
//   roles: WRITE beats READ, any right beats none. Role NAMES grant nothing.
//   The global platform ADMIN (User.role) bypasses association checks.
// ---------------------------------------------------------------------------

export const APP_MODULES: AppModule[] = [
  "EVENTS",
  "FINANCES",
  "MEMBERS",
  "CARTOGRAPHY",
  "ACHIEVEMENTS",
];

export const MODULE_LABELS: Record<AppModule, string> = {
  EVENTS: "Événements",
  FINANCES: "Finances",
  MEMBERS: "Membres",
  CARTOGRAPHY: "Cartographie",
  ACHIEVEMENTS: "Hauts faits",
};

export type EffectivePermissions = Partial<Record<AppModule, PermissionLevel>>;

/** Union of the module rights of every role the member holds (RF-09). */
export async function getEffectivePermissions(
  userId: string,
  associationId: string
): Promise<EffectivePermissions> {
  const membership = await prisma.associationMember.findUnique({
    where: { userId_associationId: { userId, associationId } },
    include: { roles: { include: { permissions: true } } },
  });
  if (!membership || membership.status !== "ACTIVE") return {};

  const effective: EffectivePermissions = {};
  for (const role of membership.roles) {
    for (const p of role.permissions) {
      const current = effective[p.module];
      if (current !== "WRITE") effective[p.module] = p.level;
    }
  }
  return effective;
}

/** Does WRITE satisfy READ? Yes — WRITE implies READ (RG-01). */
function satisfies(granted: PermissionLevel | undefined, needed: PermissionLevel): boolean {
  if (!granted) return false;
  return granted === "WRITE" || needed === "READ";
}

export async function can(
  userId: string,
  associationId: string,
  module: AppModule,
  level: PermissionLevel
): Promise<boolean> {
  const perms = await getEffectivePermissions(userId, associationId);
  return satisfies(perms[module], level);
}

/**
 * "Admin d'association" = member holding WRITE on the MEMBERS module
 * (the right to manage members/roles — the CdC's administration right).
 */
export async function isAssoAdmin(userId: string, associationId: string): Promise<boolean> {
  return can(userId, associationId, "MEMBERS", "WRITE");
}

/**
 * Guard for pages AND server actions touching an association module (RG-01).
 * Platform ADMINs pass everything. Redirects when the check fails.
 */
export async function requireModule(
  associationId: string,
  module: AppModule,
  level: PermissionLevel
) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role === "ADMIN") return session;
  const ok = await can(session.user.id, associationId, module, level);
  if (!ok) redirect(`/associations/${associationId}`);
  return session;
}

/** Same check without redirect — for conditional UI. */
export async function checkModule(
  associationId: string,
  module: AppModule,
  level: PermissionLevel
): Promise<boolean> {
  const session = await auth();
  if (!session) return false;
  if (session.user.role === "ADMIN") return true;
  return can(session.user.id, associationId, module, level);
}

/**
 * Associations where the session user holds WRITE on `module` (RG-01) —
 * drives "which associations can I organise for?" selects. Global platform
 * ADMINs see every association.
 */
export async function listWritableAssociations(module: AppModule) {
  const session = await auth();
  if (!session) return [];
  if (session.user.role === "ADMIN") {
    return prisma.association.findMany({ orderBy: { name: "asc" } });
  }
  return prisma.association.findMany({
    where: {
      memberships: {
        some: {
          userId: session.user.id,
          status: "ACTIVE",
          roles: { some: { permissions: { some: { module, level: "WRITE" } } } },
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

/**
 * Guard for event-scoped organiser screens/actions (kanban, planner,
 * inscriptions, édition) : requires `level` on `module` of the ORGANISING
 * association (RG-01). Legacy events without an association fall back to the
 * global platform ADMIN.
 */
export async function requireEventModule(
  eventId: string,
  module: AppModule,
  level: PermissionLevel
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { associationId: true },
  });
  if (!event) redirect("/dashboard");
  if (!event.associationId) {
    const session = await auth();
    if (!session) redirect("/login");
    if (session.user.role !== "ADMIN") redirect("/dashboard");
    return session;
  }
  return requireModule(event.associationId, module, level);
}

/**
 * May the session user enter the organiser back-office at all?
 * True for platform ADMINs and for members holding WRITE on ANY module of
 * ANY association ("Admin d'association" au sens large).
 */
export async function hasOrganiserAccess(): Promise<boolean> {
  const session = await auth();
  if (!session) return false;
  if (session.user.role === "ADMIN") return true;
  const membership = await prisma.associationMember.findFirst({
    where: {
      userId: session.user.id,
      status: "ACTIVE",
      roles: { some: { permissions: { some: { level: "WRITE" } } } },
    },
    select: { id: true },
  });
  return !!membership;
}

// ---------------------------------------------------------------------------
// RG-02 — an association may never end up without an admin: the last member
//   holding admin rights cannot leave nor lose their admin role.
// ---------------------------------------------------------------------------

/** Members (ACTIVE) holding at least one role with WRITE on MEMBERS. */
export async function listAdminMemberIds(associationId: string): Promise<string[]> {
  const members = await prisma.associationMember.findMany({
    where: {
      associationId,
      status: "ACTIVE",
      roles: { some: { permissions: { some: { module: "MEMBERS", level: "WRITE" } } } },
    },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

/**
 * Throws when removing `userId`'s admin rights (or membership) would leave
 * the association without any admin (RG-02). Call BEFORE the mutation.
 */
export async function assertNotLastAdmin(userId: string, associationId: string) {
  const admins = await listAdminMemberIds(associationId);
  if (admins.length === 1 && admins[0] === userId) {
    throw new Error(
      "Impossible : vous êtes le dernier administrateur de l'association. Promouvez d'abord un autre membre (RG-02)."
    );
  }
}

// ---------------------------------------------------------------------------
// Default role set created with every association (RF-06).
//   Names are plain labels — the rights below are what matters (RF-07).
// ---------------------------------------------------------------------------

type RoleTemplate = {
  name: string;
  permissions: Array<{ module: AppModule; level: PermissionLevel }>;
};

export const DEFAULT_ROLE_TEMPLATES: RoleTemplate[] = [
  {
    name: "Président",
    permissions: APP_MODULES.map((module) => ({ module, level: "WRITE" as PermissionLevel })),
  },
  {
    name: "Trésorier",
    permissions: [
      { module: "FINANCES", level: "WRITE" },
      { module: "EVENTS", level: "READ" },
      { module: "MEMBERS", level: "READ" },
      { module: "CARTOGRAPHY", level: "READ" },
      { module: "ACHIEVEMENTS", level: "READ" },
    ],
  },
  {
    name: "Secrétaire",
    permissions: [
      { module: "MEMBERS", level: "WRITE" },
      { module: "EVENTS", level: "READ" },
      { module: "FINANCES", level: "READ" },
      { module: "CARTOGRAPHY", level: "READ" },
      { module: "ACHIEVEMENTS", level: "READ" },
    ],
  },
  {
    name: "Membre du CA",
    permissions: [
      { module: "EVENTS", level: "WRITE" },
      { module: "CARTOGRAPHY", level: "WRITE" },
      { module: "ACHIEVEMENTS", level: "WRITE" },
      { module: "MEMBERS", level: "READ" },
      { module: "FINANCES", level: "READ" },
    ],
  },
  {
    name: "Membre",
    permissions: [
      { module: "EVENTS", level: "READ" },
      { module: "CARTOGRAPHY", level: "READ" },
      { module: "ACHIEVEMENTS", level: "READ" },
    ],
  },
];

/**
 * Creates the default role set for a fresh association and returns them.
 * Idempotent per (associationId, name) unique constraint — safe in seeds.
 */
export async function createDefaultRoles(associationId: string) {
  const roles = [];
  for (const tpl of DEFAULT_ROLE_TEMPLATES) {
    const role = await prisma.assoRole.upsert({
      where: { associationId_name: { associationId, name: tpl.name } },
      update: {},
      create: {
        associationId,
        name: tpl.name,
        isDefault: true,
        permissions: { create: tpl.permissions },
      },
    });
    roles.push(role);
  }
  return roles;
}
