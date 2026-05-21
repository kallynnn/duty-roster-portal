-- RBAC: Replace old Role enum with new military hierarchy
-- Step 1: Create new enum type
CREATE TYPE "Role_new" AS ENUM ('CADET', 'SQUAD_COMMANDER', 'GROUP_COMMANDER', 'COURSE_SERGEANT', 'COURSE_HEAD', 'FACULTY_HEAD', 'ADMIN');

-- Step 2: Add temporary column with new type, mapping old → new
ALTER TABLE "User" ADD COLUMN "role_new" "Role_new";

UPDATE "User" SET "role_new" = CASE
  WHEN "role"::text = 'SOLDIER'   THEN 'CADET'::"Role_new"
  WHEN "role"::text = 'STARSHYNA' THEN 'COURSE_SERGEANT'::"Role_new"
  WHEN "role"::text = 'COMMANDER' THEN 'GROUP_COMMANDER'::"Role_new"
  WHEN "role"::text = 'ADMIN'     THEN 'ADMIN'::"Role_new"
  ELSE 'CADET'::"Role_new"
END;

-- Step 3: Drop old column and rename new one
ALTER TABLE "User" DROP COLUMN "role";
ALTER TABLE "User" RENAME COLUMN "role_new" TO "role";
ALTER TABLE "User" ALTER COLUMN "role" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CADET'::"Role_new";

-- Step 4: Drop old enum, rename new one
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";

-- Step 5: Add isFirstLogin — existing users already "onboarded" so default false
ALTER TABLE "User" ADD COLUMN "isFirstLogin" BOOLEAN NOT NULL DEFAULT false;
-- Future registrations will have true (set by application logic)
