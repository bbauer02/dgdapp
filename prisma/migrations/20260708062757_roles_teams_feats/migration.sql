-- CreateEnum
CREATE TYPE "EventRole" AS ENUM ('CHEVALIER', 'SERGENT_MONTE', 'SERGENT', 'SOLDAT', 'INTENDANT');

-- CreateEnum
CREATE TYPE "FeatCategory" AS ENUM ('EVENT', 'TRAINING', 'DISTINCTION', 'OTHER');

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "role" "EventRole",
ADD COLUMN     "roleFee" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "EventRolePrice" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "role" "EventRole" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "EventRolePrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "isLeader" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberFeat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "category" "FeatCategory" NOT NULL DEFAULT 'EVENT',
    "year" INTEGER,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberFeat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventRolePrice_eventId_idx" ON "EventRolePrice"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EventRolePrice_eventId_role_key" ON "EventRolePrice"("eventId", "role");

-- CreateIndex
CREATE INDEX "Team_eventId_idx" ON "Team"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_registrationId_key" ON "TeamMember"("registrationId");

-- CreateIndex
CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember"("teamId");

-- CreateIndex
CREATE INDEX "MemberFeat_userId_idx" ON "MemberFeat"("userId");

-- AddForeignKey
ALTER TABLE "EventRolePrice" ADD CONSTRAINT "EventRolePrice_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberFeat" ADD CONSTRAINT "MemberFeat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
