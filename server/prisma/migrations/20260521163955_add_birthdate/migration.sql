-- AlterTable
ALTER TABLE "Soldier" ADD COLUMN     "birthDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "isFirstLogin" SET DEFAULT true;
