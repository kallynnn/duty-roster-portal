/*
  Warnings:

  - You are about to drop the column `assignedSoldierId` on the `DutyType` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."DutyType" DROP CONSTRAINT "DutyType_assignedSoldierId_fkey";

-- DropIndex
DROP INDEX "public"."DutyType_assignedSoldierId_key";

-- AlterTable
ALTER TABLE "DutyType" DROP COLUMN "assignedSoldierId";

-- AlterTable
ALTER TABLE "Soldier" ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "position" TEXT;
