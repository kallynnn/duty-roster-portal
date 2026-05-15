-- DropEnum
DROP TYPE "public"."Status";

-- AddForeignKey
ALTER TABLE "Soldier" ADD CONSTRAINT "Soldier_lastDutyTypeId_fkey" FOREIGN KEY ("lastDutyTypeId") REFERENCES "DutyType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
