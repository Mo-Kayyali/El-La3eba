-- AlterEnum
BEGIN;
CREATE TYPE "Position_new" AS ENUM ('GK', 'RB', 'CB', 'LB', 'CDM', 'CM', 'CAM', 'RM', 'LM', 'RW', 'LW', 'CF', 'ST');
ALTER TABLE "Player" ALTER COLUMN "positions" DROP DEFAULT;
ALTER TABLE "Player" ALTER COLUMN "positions" TYPE "Position_new"[] USING ("positions"::text::"Position_new"[]);
ALTER TABLE "Player" ALTER COLUMN "primaryPosition" TYPE "Position_new" USING ("primaryPosition"::text::"Position_new");
ALTER TYPE "Position" RENAME TO "Position_old";
ALTER TYPE "Position_new" RENAME TO "Position";
DROP TYPE "Position_old";
ALTER TABLE "Player" ALTER COLUMN "positions" SET DEFAULT ARRAY[]::"Position"[];
COMMIT;
