-- Uploads are accepted through a Vercel Function, which rejects request bodies
-- above roughly 4.5 MB. Advertise the safe 4 MB application limit instead of
-- plan sizes the production platform cannot deliver.
UPDATE "Plan"
SET "maxUploadMb" = 4,
    "features" = '["100 pages per month","4 MB max file size","2 team seats","CSV exports"]'::jsonb
WHERE "code" = 'free';

UPDATE "Plan"
SET "maxUploadMb" = 4,
    "features" = '["1,500 pages per month","4 MB max file size","5 team seats","CSV and XLSX exports"]'::jsonb
WHERE "code" = 'starter';

UPDATE "Plan"
SET "maxUploadMb" = 4,
    "features" = '["6,000 pages per month","4 MB max file size","20 team seats","CSV and XLSX exports"]'::jsonb
WHERE "code" = 'growth';

UPDATE "Plan"
SET "maxUploadMb" = 4,
    "features" = '["25,000 pages per month","4 MB max file size","100 team seats","Data processing agreement"]'::jsonb
WHERE "code" = 'enterprise';
