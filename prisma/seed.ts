import { PrismaClient, type EventRole, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { normalizeAssociationName } from "../lib/associations";
import { DEFAULT_ROLE_FEES } from "../lib/roles";
import { DEFAULT_ROLE_TEMPLATES } from "../lib/permissions";

const prisma = new PrismaClient();

// email is no longer unique (RF-02) — seed accounts are credentials accounts
// (provider null) and are looked up by email + provider null.
async function ensureUser(opts: {
  email: string;
  firstName: string;
  lastName: string;
  role?: Role;
  passwordHash: string;
  associationId?: string;
}) {
  // Generated avatar so profile pictures show up everywhere (kanban, listes…).
  const avatar = `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(
    `${opts.firstName}-${opts.lastName}`
  )}&backgroundColor=241F33`;
  const existing = await prisma.user.findFirst({
    where: { email: opts.email, provider: null },
  });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        role: opts.role ?? existing.role,
        profileComplete: true,
        profilePicture: existing.profilePicture ?? avatar,
      },
    });
  }
  return prisma.user.create({
    data: {
      email: opts.email,
      passwordHash: opts.passwordHash,
      role: opts.role ?? "PLAYER",
      firstName: opts.firstName,
      lastName: opts.lastName,
      associationId: opts.associationId,
      profileComplete: true,
      profilePicture: avatar,
    },
  });
}

async function ensureAssociation(name: string, description: string, createdById?: string) {
  return prisma.association.upsert({
    where: { nameNormalized: normalizeAssociationName(name) },
    update: { description },
    create: {
      name,
      nameNormalized: normalizeAssociationName(name),
      description,
      createdById,
    },
  });
}

// RF-06: default role set, from the shared templates.
async function ensureDefaultRoles(associationId: string) {
  const byName: Record<string, string> = {};
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
    byName[tpl.name] = role.id;
  }
  return byName;
}

async function ensureMembership(userId: string, associationId: string, roleNames: string[], roles: Record<string, string>) {
  const member = await prisma.associationMember.upsert({
    where: { userId_associationId: { userId, associationId } },
    update: {},
    create: { userId, associationId, status: "ACTIVE" },
  });
  await prisma.associationMember.update({
    where: { id: member.id },
    data: { roles: { set: roleNames.map((n) => ({ id: roles[n] })) } },
  });
  return member;
}

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  // --- Users -----------------------------------------------------------
  const admin = await ensureUser({
    email: "admin@dgd.test",
    firstName: "Alice",
    lastName: "Admin",
    role: "ADMIN",
    passwordHash,
  });
  const player = await ensureUser({
    email: "michel@dgd.test",
    firstName: "Michel",
    lastName: "Dupont",
    passwordHash,
  });
  const sophie = await ensureUser({ email: "sophie@dgd.test", firstName: "Sophie", lastName: "Laval", passwordHash });
  const jean = await ensureUser({ email: "jean@dgd.test", firstName: "Jean", lastName: "Perrin", passwordHash });
  const claire = await ensureUser({ email: "claire@dgd.test", firstName: "Claire", lastName: "Moreau", passwordHash });

  // --- Associations + default roles + memberships ----------------------
  const association = await ensureAssociation(
    "De Gueules et d'argent",
    "Compagnie de reconstitution médiévale — campements, tournois et vie de camp.",
    admin.id
  );
  const roles = await ensureDefaultRoles(association.id);

  // RF-05: the creator holds the admin role (Président). Cumulated roles
  // are allowed (RF-09) — Sophie is both Trésorier and Membre du CA.
  await ensureMembership(admin.id, association.id, ["Président"], roles);
  await ensureMembership(player.id, association.id, ["Membre"], roles);
  await ensureMembership(sophie.id, association.id, ["Trésorier", "Membre du CA"], roles);
  await ensureMembership(claire.id, association.id, ["Membre"], roles);

  // A second association to exercise multi-asso + join flows.
  const asso2 = await ensureAssociation(
    "Compagnie du Lion Noir",
    "Mercenaires du XVe — AMHE, escorte de convois et campements itinérants.",
    sophie.id
  );
  const roles2 = await ensureDefaultRoles(asso2.id);
  await ensureMembership(sophie.id, asso2.id, ["Président"], roles2);
  await ensureMembership(jean.id, asso2.id, ["Membre"], roles2);

  // Keep the denormalized "primary association" displays coherent.
  await prisma.user.update({ where: { id: player.id }, data: { associationId: association.id } });
  await prisma.user.update({ where: { id: sophie.id }, data: { associationId: association.id } });
  await prisma.user.update({ where: { id: claire.id }, data: { associationId: association.id } });
  await prisma.user.update({ where: { id: jean.id }, data: { associationId: asso2.id } });

  // --- Event (owned by the association, RF-11/12) -----------------------
  const event = await prisma.event.upsert({
    where: { id: "seed-event-1" },
    update: {
      associationId: association.id,
      visibility: "PUBLIC",
      requiresCostume: true,
      location: "Château de Crèvecœur, Normandie",
    },
    create: {
      id: "seed-event-1",
      title: "Tournoi 2027 Pentecôte",
      description: "Grand tournoi de reconstitution — week-end de Pentecôte.",
      startDate: new Date("2027-05-15T09:00:00Z"),
      endDate: new Date("2027-05-17T18:00:00Z"),
      location: "Château de Crèvecœur, Normandie",
      maxParticipants: 120,
      associationId: association.id,
      visibility: "PUBLIC",
      requiresCostume: true,
      packages: {
        create: [
          { name: "Weekend complet", price: "45.00", includedItems: ["Bivouac 2 nuits", "Repas samedi", "Assurance"] },
          { name: "Journée", price: "20.00", includedItems: ["Accès site", "Repas midi"] },
        ],
      },
    },
  });

  // A members-only event (RF-12).
  await prisma.event.upsert({
    where: { id: "seed-event-2" },
    update: {},
    create: {
      id: "seed-event-2",
      title: "Banquet d'hiver de la compagnie",
      description: "Banquet réservé aux membres — clôture de saison.",
      startDate: new Date("2026-12-12T18:00:00Z"),
      endDate: new Date("2026-12-13T01:00:00Z"),
      location: "Salle des fêtes, Lisieux",
      associationId: association.id,
      visibility: "MEMBERS",
    },
  });

  // --- Camp gear (planner) ----------------------------------------------
  const existingGear = await prisma.campGear.findFirst({
    where: { userId: player.id, label: "Tente cloche de Michel" },
  });
  if (!existingGear) {
    await prisma.campGear.create({
      data: {
        userId: player.id,
        label: "Poivrière de Michel",
        tentType: "POIVRIERE",
        shape: "ROUND",
        diameterM: "4",
        footprintAreaM2: "12.57",
        ropeZoneRadiusM: "1.2",
        color: "#b45309",
      },
    });
  }

  // --- Per-event role prices ---------------------------------------------
  for (const [role, price] of Object.entries(DEFAULT_ROLE_FEES)) {
    await prisma.eventRolePrice.upsert({
      where: { eventId_role: { eventId: event.id, role: role as EventRole } },
      update: {},
      create: { eventId: event.id, role: role as EventRole, price: price.toFixed(2) },
    });
  }

  // --- Registrations (RF-13) ---------------------------------------------
  const regs: Array<[typeof player, EventRole, "PENDING" | "APPROVED" | "REJECTED"]> = [
    [player, "CHEVALIER", "APPROVED"],
    [sophie, "SERGENT_MONTE", "APPROVED"],
    [jean, "SOLDAT", "PENDING"],
    [claire, "INTENDANT", "PENDING"],
  ];
  const regByUser: Record<string, string> = {};
  for (const [u, role, status] of regs) {
    const reg = await prisma.registration.upsert({
      where: { userId_eventId: { userId: u.id, eventId: event.id } },
      update: { role, status, roleFee: DEFAULT_ROLE_FEES[role].toFixed(2) },
      create: {
        userId: u.id,
        eventId: event.id,
        role,
        roleFee: DEFAULT_ROLE_FEES[role].toFixed(2),
        status,
        paymentStatus: status === "APPROVED" ? "PAID" : "UNPAID",
      },
    });
    regByUser[u.id] = reg.id;
  }

  // --- Costume dossier with refusal thread (RF-14..16) --------------------
  const dossier = await prisma.costumeDossier.upsert({
    where: { registrationId: regByUser[jean.id] },
    update: {},
    create: {
      registrationId: regByUser[jean.id],
      type: "MILITARY",
      fileUrls: ["/uploads/seed/costume-jean-1.jpg"],
      status: "PENDING",
    },
  });
  if ((await prisma.dossierMessage.count({ where: { dossierId: dossier.id } })) === 0) {
    // RG-03: a refusal always carries a reason; the user's reply re-opened it.
    await prisma.costumeDossier.update({ where: { id: dossier.id }, data: { status: "PENDING" } });
    await prisma.dossierMessage.createMany({
      data: [
        {
          dossierId: dossier.id,
          authorId: admin.id,
          fromAdmin: true,
          body: "Refusé : la boucle de ceinturon est moderne et les chausses ne correspondent pas à la période (XVe).",
        },
        {
          dossierId: dossier.id,
          authorId: jean.id,
          fromAdmin: false,
          body: "Boucle remplacée par un modèle forgé main, photo mise à jour. Les chausses sont en laine tissée, modèle Musée de Cluny.",
        },
      ],
    });
  }

  // --- Kanban tasks (RF-18/19) --------------------------------------------
  if ((await prisma.eventTask.count({ where: { eventId: event.id } })) === 0) {
    // Card members are a m2m relation — create rows one by one to connect them.
    const tasks: Array<{
      title: string;
      status: "TODO" | "IN_PROGRESS" | "DONE";
      priority: number;
      position: number;
      description?: string;
      memberId?: string;
    }> = [
      { title: "Réserver la prairie du château", status: "DONE", priority: 2, position: 0, memberId: admin.id },
      { title: "Commander le bois de chauffe", status: "IN_PROGRESS", priority: 1, position: 0, memberId: sophie.id },
      { title: "Plan de camp : zones de cordage", description: "Vérifier les distances entre tentes sur la carte.", status: "IN_PROGRESS", priority: 2, position: 1, memberId: player.id },
      { title: "Contacter la presse locale", status: "TODO", priority: 0, position: 0 },
      { title: "Prévoir l'intendance du banquet", status: "TODO", priority: 1, position: 1, memberId: claire.id },
    ];
    for (const { memberId, ...t } of tasks) {
      await prisma.eventTask.create({
        data: {
          eventId: event.id,
          ...t,
          ...(memberId ? { members: { connect: { id: memberId } } } : {}),
        },
      });
    }
  }

  // --- Achievements (RF-21..26) --------------------------------------------
  // System badge: automatic + repeatable (RF-17, RF-26).
  const participation = await prisma.achievement.upsert({
    where: { associationId_name: { associationId: association.id, name: "Participation à l'événement" } },
    update: { points: 10 },
    create: {
      associationId: association.id,
      name: "Participation à l'événement",
      description: "Attribué automatiquement à chaque inscription validée.",
      points: 10,
      repeatable: true,
      isAuto: true,
    },
  });
  const bivouac = await prisma.achievement.upsert({
    where: { associationId_name: { associationId: association.id, name: "Maître du bivouac" } },
    update: { points: 50 },
    create: {
      associationId: association.id,
      name: "Maître du bivouac",
      description: "Camp exemplaire : montage, période, vie de camp.",
      points: 50,
      repeatable: false,
    },
  });
  const lame = await prisma.achievement.upsert({
    where: { associationId_name: { associationId: association.id, name: "Première lame" } },
    update: { points: 100 },
    create: {
      associationId: association.id,
      name: "Première lame",
      description: "Vainqueur d'un tournoi d'escrime de la compagnie.",
      points: 100,
      repeatable: false,
    },
  });

  // Automatic awards mirror the two APPROVED registrations (RG-04).
  for (const u of [player, sophie]) {
    const already = await prisma.achievementAward.findFirst({
      where: { achievementId: participation.id, userId: u.id, eventId: event.id },
    });
    if (!already) {
      await prisma.achievementAward.create({
        data: { achievementId: participation.id, userId: u.id, mode: "AUTOMATIC", eventId: event.id },
      });
    }
  }
  // A manual grant (RF-22).
  if (!(await prisma.achievementAward.findFirst({ where: { achievementId: bivouac.id, userId: player.id } }))) {
    await prisma.achievementAward.create({
      data: { achievementId: bivouac.id, userId: player.id, mode: "MANUAL", grantedById: admin.id },
    });
  }
  // A claim refused with reason + user reply → back to PENDING (RF-24/25).
  let claim = await prisma.achievementClaim.findFirst({
    where: { achievementId: lame.id, userId: sophie.id },
  });
  if (!claim) {
    claim = await prisma.achievementClaim.create({
      data: { achievementId: lame.id, userId: sophie.id, status: "PENDING" },
    });
    await prisma.claimMessage.createMany({
      data: [
        {
          claimId: claim.id,
          authorId: admin.id,
          fromAdmin: true,
          body: "Refusé : la finale du tournoi 2026 n'a pas été jouée (orage), le titre n'a pas été décerné.",
        },
        {
          claimId: claim.id,
          authorId: sophie.id,
          fromAdmin: false,
          body: "La finale a été rejouée au banquet d'hiver — j'ai gagné 5 touches à 2, l'arbitre était Michel.",
        },
      ],
    });
  }

  // --- Participation history / feats (gamified CV, unchanged) --------------
  const feats: Array<[typeof player, string, "EVENT" | "TRAINING" | "DISTINCTION", number, number]> = [
    [player, "Campement 2014 — Soldat", "EVENT", 2014, 10],
    [player, "Campement 2016 — Sergent", "EVENT", 2016, 15],
    [player, "Stage AMHE — épée longue", "TRAINING", 2018, 20],
    [player, "Meilleur bivouac 2019", "DISTINCTION", 2019, 25],
    [sophie, "Campement 2017 — Cavalerie", "EVENT", 2017, 15],
  ];
  for (const [u, title, category, year, points] of feats) {
    const exists = await prisma.memberFeat.findFirst({ where: { userId: u.id, title } });
    if (!exists) {
      await prisma.memberFeat.create({
        data: { userId: u.id, title, category, year, points, createdById: admin.id },
      });
    }
  }

  console.log("Seed done:", {
    admin: admin.email,
    players: [player.email, sophie.email, jean.email, claire.email],
    associations: [association.name, asso2.name],
    event: event.title,
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
