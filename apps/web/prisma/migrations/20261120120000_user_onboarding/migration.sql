-- First-login onboarding gate. A new account is sent through the welcome wizard
-- once, then recorded here. Accounts that already existed when this shipped are
-- marked complete so nobody is interrupted mid-flow.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardedAt" TIMESTAMP(3);

UPDATE "User" SET "onboardedAt" = CURRENT_TIMESTAMP WHERE "onboardedAt" IS NULL;
