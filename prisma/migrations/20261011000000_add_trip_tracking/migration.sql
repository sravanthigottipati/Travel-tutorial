-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('PLANNED', 'DONE', 'SKIPPED');

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "status" "ActivityStatus" NOT NULL DEFAULT 'PLANNED';

-- CreateTable
CREATE TABLE "spend_entries" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "note" TEXT,
    "spent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spend_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "spend_entries_trip_id_idx" ON "spend_entries"("trip_id");

-- AddForeignKey
ALTER TABLE "spend_entries" ADD CONSTRAINT "spend_entries_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

