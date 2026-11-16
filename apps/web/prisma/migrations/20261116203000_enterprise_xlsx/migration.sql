-- Enterprise is a paid plan, so the export entitlement must include XLSX just
-- like Starter and Growth. Keep the DPA claim in the same feature list.
UPDATE "Plan"
SET "features" = '["25,000 pages per month","4 MB max file size","100 team seats","CSV and XLSX exports","Data processing agreement"]'::jsonb
WHERE "code" = 'enterprise';
