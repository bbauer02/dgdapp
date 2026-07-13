-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "bannerUrl" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "socialLinks" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "characterRoleId" TEXT;

-- AlterTable
ALTER TABLE "RegistrationPackage" ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "EventCharacterRole" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "packageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventCharacterRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventInvitation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "userId" TEXT,
    "invitedById" TEXT,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventCharacterRole_eventId_idx" ON "EventCharacterRole"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EventCharacterRole_eventId_name_key" ON "EventCharacterRole"("eventId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "EventInvitation_token_key" ON "EventInvitation"("token");

-- CreateIndex
CREATE INDEX "EventInvitation_userId_idx" ON "EventInvitation"("userId");

-- CreateIndex
CREATE INDEX "EventInvitation_eventId_idx" ON "EventInvitation"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EventInvitation_eventId_email_key" ON "EventInvitation"("eventId", "email");

-- AddForeignKey
ALTER TABLE "EventCharacterRole" ADD CONSTRAINT "EventCharacterRole_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCharacterRole" ADD CONSTRAINT "EventCharacterRole_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "RegistrationPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInvitation" ADD CONSTRAINT "EventInvitation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInvitation" ADD CONSTRAINT "EventInvitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInvitation" ADD CONSTRAINT "EventInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_characterRoleId_fkey" FOREIGN KEY ("characterRoleId") REFERENCES "EventCharacterRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
