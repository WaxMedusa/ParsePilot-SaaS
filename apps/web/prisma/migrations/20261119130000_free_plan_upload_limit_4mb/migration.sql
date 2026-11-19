-- The raise to 10 MB applies to the paid plans. Free keeps the smaller 4 MB
-- allowance so a bigger upload is a reason to upgrade. This corrective
-- migration also restores Free if the earlier raise already moved it to 10.
UPDATE "Plan"
SET "maxUploadMb" = 4,
    "features" = '["100 pages per month","4 MB max file size","2 team seats","CSV exports"]'::jsonb
WHERE "code" = 'free';
