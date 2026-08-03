-- CreateEnum
CREATE TYPE "ProfileChangeType" AS ENUM ('ALIAS', 'NAME', 'PROFILE_IMAGE');

-- CreateEnum
CREATE TYPE "ProfileChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "profileRestricted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "profileImageUrl" TEXT,
ADD COLUMN "profileImageStorageId" TEXT;

-- CreateTable
CREATE TABLE "ProfileChangeRequest" (
    "id" TEXT NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "type" "ProfileChangeType" NOT NULL,
    "status" "ProfileChangeStatus" NOT NULL DEFAULT 'PENDING',
    "currentData" JSONB NOT NULL,
    "requestedData" JSONB NOT NULL,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProfileChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProfileChangeRequest_status_type_idx" ON "ProfileChangeRequest"("status", "type");
CREATE INDEX "ProfileChangeRequest_submittedByUserId_status_idx" ON "ProfileChangeRequest"("submittedByUserId", "status");
CREATE INDEX "ProfileChangeRequest_reviewedByUserId_idx" ON "ProfileChangeRequest"("reviewedByUserId");
CREATE INDEX "ProfileChangeRequest_createdAt_idx" ON "ProfileChangeRequest"("createdAt");

ALTER TABLE "ProfileChangeRequest" ADD CONSTRAINT "ProfileChangeRequest_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfileChangeRequest" ADD CONSTRAINT "ProfileChangeRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
