/*
  Warnings:

  - A unique constraint covering the columns `[assignedSoldierId]` on the table `DutyType` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "DutyType" ADD COLUMN     "assignedSoldierId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "DutyType_assignedSoldierId_key" ON "DutyType"("assignedSoldierId");

-- AddForeignKey
ALTER TABLE "DutyType" ADD CONSTRAINT "DutyType_assignedSoldierId_fkey" FOREIGN KEY ("assignedSoldierId") REFERENCES "Soldier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
