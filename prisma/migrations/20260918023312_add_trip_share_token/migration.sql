-- AlterTable
ALTER TABLE "trips" ADD COLUMN     "share_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "trips_share_token_key" ON "trips"("share_token");
