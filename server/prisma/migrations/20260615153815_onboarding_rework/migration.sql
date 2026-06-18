-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "photo" TEXT;

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "cuisines" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "googleSyncedAt" TIMESTAMP(3),
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "restDays" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "reviewCount" INTEGER NOT NULL DEFAULT 0;
