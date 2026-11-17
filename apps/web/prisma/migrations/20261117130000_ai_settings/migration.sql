-- Per-workspace AI provider settings. Only ciphertext and a last-4 hint are
-- stored; the plaintext key is never returned by the API.
CREATE TABLE "AiSettings" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "baseUrl" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "apiKeyCiphertext" TEXT NOT NULL,
    "apiKeyHint" TEXT NOT NULL,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiSettings_workspaceId_key" ON "AiSettings"("workspaceId");
CREATE INDEX "AiSettings_updatedById_idx" ON "AiSettings"("updatedById");

ALTER TABLE "AiSettings"
    ADD CONSTRAINT "AiSettings_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiSettings"
    ADD CONSTRAINT "AiSettings_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
