-- Clear sessions issued before device binding. Those tokens have no deviceId.
DELETE FROM "AuthSession";

-- AlterTable
ALTER TABLE "AuthSession" ADD COLUMN "deviceId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_userId_deviceId_key" ON "AuthSession"("userId", "deviceId");
