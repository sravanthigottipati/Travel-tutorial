-- CreateTable
CREATE TABLE "activity_votes" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "voter_key" TEXT NOT NULL,
    "voter_name" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_votes_trip_id_idx" ON "activity_votes"("trip_id");

-- CreateIndex
CREATE UNIQUE INDEX "activity_votes_activity_id_voter_key_key" ON "activity_votes"("activity_id", "voter_key");

-- AddForeignKey
ALTER TABLE "activity_votes" ADD CONSTRAINT "activity_votes_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_votes" ADD CONSTRAINT "activity_votes_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
