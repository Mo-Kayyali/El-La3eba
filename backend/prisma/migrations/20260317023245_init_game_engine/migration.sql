CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateTable
CREATE TABLE "FootballPlayer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clubs" TEXT[],
    "activeYear" INTEGER NOT NULL,

    CONSTRAINT "FootballPlayer_pkey" PRIMARY KEY ("id")
);
