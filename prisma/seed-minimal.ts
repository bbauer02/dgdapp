import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { normalizeAssociationName } from "../lib/associations";
import { DEFAULT_ROLE_TEMPLATES } from "../lib/permissions";

const prisma = new PrismaClient();

// Minimal seed: a single ADMIN account + the "DGDA" (De Gueules et
// d'Argent) association (with its default roles) and the Président membership.
async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@dgd.test",
      passwordHash,
      role: "ADMIN",
      firstName: "Alice",
      lastName: "Admin",
      profileComplete: true,
      profilePicture:
        "https://api.dicebear.com/9.x/adventurer/svg?seed=Alice-Admin&backgroundColor=241F33",
    },
  });

  const association = await prisma.association.create({
    data: {
      name: "DGDA",
      nameNormalized: normalizeAssociationName("DGDA"),
      description:
        "De Gueules et d'Argent — Compagnie de reconstitution médiévale : campements, tournois et vie de camp.",
      createdById: admin.id,
    },
  });

  // Default role set (RF-06).
  const roles: Record<string, string> = {};
  for (const tpl of DEFAULT_ROLE_TEMPLATES) {
    const role = await prisma.assoRole.create({
      data: {
        associationId: association.id,
        name: tpl.name,
        isDefault: true,
        permissions: { create: tpl.permissions },
      },
    });
    roles[tpl.name] = role.id;
  }

  // The creator holds the admin role (Président) — RF-05.
  const member = await prisma.associationMember.create({
    data: { userId: admin.id, associationId: association.id, status: "ACTIVE" },
  });
  await prisma.associationMember.update({
    where: { id: member.id },
    data: { roles: { set: [{ id: roles["Président"] }] } },
  });

  // Keep the denormalized "primary association" display coherent.
  await prisma.user.update({
    where: { id: admin.id },
    data: { associationId: association.id },
  });

  console.log("Minimal seed done:", {
    admin: admin.email,
    association: association.name,
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
