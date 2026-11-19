-- Documents may share one stored object after a sha256 dedupe.
DROP INDEX "Document_storageKey_key";

-- CreateIndex
CREATE INDEX "Document_storageKey_idx" ON "Document"("storageKey");

-- CreateTable
CREATE TABLE "StorageConnection" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google-drive',
    "accountEmail" TEXT,
    "folderId" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StorageConnection_userId_key" ON "StorageConnection"("userId");

-- AddForeignKey
ALTER TABLE "StorageConnection" ADD CONSTRAINT "StorageConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
