-- AlterEnum: drop the NO_SHOW value from ReservationStatus.
BEGIN;
-- Re-map any existing NO_SHOW bookings to CANCELLED before the value is removed,
-- so the cast below cannot fail on legacy data.
UPDATE "Reservation" SET "status" = 'CANCELLED' WHERE "status" = 'NO_SHOW';
CREATE TYPE "ReservationStatus_new" AS ENUM ('PENDING', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED');
ALTER TABLE "Reservation" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Reservation" ALTER COLUMN "status" TYPE "ReservationStatus_new" USING ("status"::text::"ReservationStatus_new");
ALTER TYPE "ReservationStatus" RENAME TO "ReservationStatus_old";
ALTER TYPE "ReservationStatus_new" RENAME TO "ReservationStatus";
DROP TYPE "ReservationStatus_old";
ALTER TABLE "Reservation" ALTER COLUMN "status" SET DEFAULT 'CONFIRMED';
COMMIT;
