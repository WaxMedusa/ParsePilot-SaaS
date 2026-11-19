-- Documents now upload straight to object storage through a presigned PUT, so
-- the Vercel Function request-body limit no longer caps the advertised size.
-- Raise every public plan to the new 10 MB catalogue default.
UPDATE "Plan"
SET "maxUploadMb" = 10,
    "features" = '["100 pages per month","10 MB max file size","2 team seats","CSV exports"]'::jsonb
WHERE "code" = 'free';

UPDATE "Plan"
SET "maxUploadMb" = 10,
    "features" = '["1,500 pages per month","10 MB max file size","5 team seats","CSV and XLSX exports"]'::jsonb
WHERE "code" = 'starter';

UPDATE "Plan"
SET "maxUploadMb" = 10,
    "features" = '["6,000 pages per month","10 MB max file size","20 team seats","CSV and XLSX exports"]'::jsonb
WHERE "code" = 'growth';

UPDATE "Plan"
SET "maxUploadMb" = 10,
    "features" = '["25,000 pages per month","10 MB max file size","100 team seats","CSV and XLSX exports","Data processing agreement"]'::jsonb
WHERE "code" = 'enterprise';
