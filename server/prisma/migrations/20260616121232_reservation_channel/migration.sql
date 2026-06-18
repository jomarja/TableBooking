-- CreateEnum
CREATE TYPE "ReservationChannel" AS ENUM ('ONLINE', 'PHONE', 'WALK_IN');

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "channel" "ReservationChannel" NOT NULL DEFAULT 'ONLINE';
