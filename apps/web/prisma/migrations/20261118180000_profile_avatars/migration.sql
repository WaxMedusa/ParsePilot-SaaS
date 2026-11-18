-- Profile avatars: a private object key plus the time it last changed, which
-- doubles as a cache-busting version for the authenticated image route.
-- Written idempotently so it can be applied to an environment that already
-- has the columns without failing the migration run.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarKey" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUpdatedAt" TIMESTAMP(3);
