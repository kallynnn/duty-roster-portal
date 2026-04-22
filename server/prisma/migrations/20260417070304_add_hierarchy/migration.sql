/*
  Warnings:

  - The `status` column on the `Soldier` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `GalleryImage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `News` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `phoneNumber` on table `Soldier` required. This step will fail if there are existing NULL values in that column.
  - Made the column `position` on table `Soldier` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Schedule" ALTER COLUMN "date" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Soldier" ADD COLUMN     "company" TEXT,
ADD COLUMN     "platoon" TEXT,
ADD COLUMN     "squad" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ALTER COLUMN "phoneNumber" SET NOT NULL,
ALTER COLUMN "position" SET NOT NULL;

-- DropTable
DROP TABLE "public"."GalleryImage";

-- DropTable
DROP TABLE "public"."News";

-- CreateTable
CREATE TABLE "SwapRequest" (
    "id" SERIAL NOT NULL,
    "scheduleId" INTEGER NOT NULL,
    "requesterId" INTEGER NOT NULL,
    "targetSoldierId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SwapRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Soldier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_targetSoldierId_fkey" FOREIGN KEY ("targetSoldierId") REFERENCES "Soldier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
