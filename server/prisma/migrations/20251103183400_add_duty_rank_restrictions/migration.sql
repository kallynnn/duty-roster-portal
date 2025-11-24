-- AlterTable
ALTER TABLE "DutyType" ADD COLUMN     "allowedRanks" TEXT[] DEFAULT ARRAY[]::TEXT[];
