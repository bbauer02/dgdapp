-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PLAYER', 'ADMIN');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CostumeReviewStatus" AS ENUM ('NOT_REVIEWED', 'APPROVED', 'NEEDS_CHANGES');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PENDING', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "TentType" AS ENUM ('BELL', 'WEDGE', 'MARQUEE', 'A_FRAME', 'OTHER');

-- CreateEnum
CREATE TYPE "TentShape" AS ENUM ('ROUND', 'RECTANGULAR');

-- CreateTable
CREATE TABLE "Association" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Association_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PLAYER',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "profilePicture" TEXT,
    "civilianCostumePics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "militaryCostumePics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "associationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "documentUrl" TEXT,
    "maxParticipants" INTEGER,
    "basePrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationPackage" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "includedItems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "packageId" TEXT,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "costumeReview" "CostumeReviewStatus" NOT NULL DEFAULT 'NOT_REVIEWED',
    "reviewNote" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "stripeSessionId" TEXT,
    "amountPaid" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampGear" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "registrationId" TEXT,
    "label" TEXT NOT NULL,
    "tentType" "TentType" NOT NULL DEFAULT 'OTHER',
    "shape" "TentShape" NOT NULL DEFAULT 'ROUND',
    "diameterM" DECIMAL(6,2),
    "widthM" DECIMAL(6,2),
    "lengthM" DECIMAL(6,2),
    "footprintAreaM2" DECIMAL(8,2),
    "ropeZoneRadiusM" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampGear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampLayout" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "widthM" DECIMAL(6,2) NOT NULL DEFAULT 20,
    "heightM" DECIMAL(6,2) NOT NULL DEFAULT 30,
    "pixelsPerMeter" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampLayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampToken" (
    "id" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "campGearId" TEXT,
    "label" TEXT,
    "shape" "TentShape" NOT NULL DEFAULT 'ROUND',
    "xM" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "yM" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "rotation" INTEGER NOT NULL DEFAULT 0,
    "diameterM" DECIMAL(6,2),
    "widthM" DECIMAL(6,2),
    "lengthM" DECIMAL(6,2),
    "ropeZoneRadiusM" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "showRopeZone" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT,
    "segments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Association_nameNormalized_key" ON "Association"("nameNormalized");

-- CreateIndex
CREATE INDEX "Association_nameNormalized_idx" ON "Association"("nameNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_associationId_idx" ON "User"("associationId");

-- CreateIndex
CREATE INDEX "Event_startDate_idx" ON "Event"("startDate");

-- CreateIndex
CREATE INDEX "RegistrationPackage_eventId_idx" ON "RegistrationPackage"("eventId");

-- CreateIndex
CREATE INDEX "Registration_eventId_idx" ON "Registration"("eventId");

-- CreateIndex
CREATE INDEX "Registration_status_idx" ON "Registration"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_userId_eventId_key" ON "Registration"("userId", "eventId");

-- CreateIndex
CREATE INDEX "CampGear_userId_idx" ON "CampGear"("userId");

-- CreateIndex
CREATE INDEX "CampGear_registrationId_idx" ON "CampGear"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "CampLayout_eventId_key" ON "CampLayout"("eventId");

-- CreateIndex
CREATE INDEX "CampToken_layoutId_idx" ON "CampToken"("layoutId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationPackage" ADD CONSTRAINT "RegistrationPackage_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "RegistrationPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampGear" ADD CONSTRAINT "CampGear_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampGear" ADD CONSTRAINT "CampGear_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampLayout" ADD CONSTRAINT "CampLayout_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampToken" ADD CONSTRAINT "CampToken_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "CampLayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampToken" ADD CONSTRAINT "CampToken_campGearId_fkey" FOREIGN KEY ("campGearId") REFERENCES "CampGear"("id") ON DELETE SET NULL ON UPDATE CASCADE;
