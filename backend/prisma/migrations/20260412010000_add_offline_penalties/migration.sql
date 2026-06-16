-- Add offline disconnect tracking columns to User
ALTER TABLE "User"
  ADD COLUMN "offlineDisconnectCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastDisconnectAt" TIMESTAMP(3);

-- Create offline penalties table for durable pending-penalty records
CREATE TABLE "OfflinePenalty" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mmrLost" INTEGER NOT NULL,
  "gameSessionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt" TIMESTAMP(3),
  CONSTRAINT "OfflinePenalty_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OfflinePenalty"
  ADD CONSTRAINT "OfflinePenalty_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "OfflinePenalty_userId_acknowledgedAt_idx"
  ON "OfflinePenalty"("userId", "acknowledgedAt");

CREATE INDEX "OfflinePenalty_createdAt_idx"
  ON "OfflinePenalty"("createdAt");
