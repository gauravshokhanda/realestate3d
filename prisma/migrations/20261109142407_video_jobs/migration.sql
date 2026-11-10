-- AlterTable
ALTER TABLE "Scene" ADD COLUMN "analysis" JSONB;
ALTER TABLE "Scene" ADD COLUMN "duration" REAL;
ALTER TABLE "Scene" ADD COLUMN "leaseExpiresAt" DATETIME;
ALTER TABLE "Scene" ADD COLUMN "leaseOwner" TEXT;
ALTER TABLE "Scene" ADD COLUMN "nextAttemptAt" DATETIME;
ALTER TABLE "Scene" ADD COLUMN "operationName" TEXT;
ALTER TABLE "Scene" ADD COLUMN "sequencePath" TEXT;
ALTER TABLE "Scene" ADD COLUMN "settings" JSONB;
