-- AlterEnum
BEGIN;
CREATE TYPE "TentType_new" AS ENUM ('POIVRIERE', 'SOLDAT', 'PAVILLON');
ALTER TABLE "public"."CampGear" ALTER COLUMN "tentType" DROP DEFAULT;
ALTER TABLE "CampGear" ALTER COLUMN "tentType" TYPE "TentType_new" USING ("tentType"::text::"TentType_new");
ALTER TYPE "TentType" RENAME TO "TentType_old";
ALTER TYPE "TentType_new" RENAME TO "TentType";
DROP TYPE "public"."TentType_old";
ALTER TABLE "CampGear" ALTER COLUMN "tentType" SET DEFAULT 'SOLDAT';
COMMIT;

-- AlterTable
ALTER TABLE "CampGear" ALTER COLUMN "tentType" SET DEFAULT 'SOLDAT';
