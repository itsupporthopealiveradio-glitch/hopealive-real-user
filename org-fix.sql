-- 1. Ensure at least one organization exists in the database
INSERT INTO organizations (name, address, office_latitude, office_longitude, geofence_radius_meters)
SELECT 'Hope Alive Headquarters', '123 Main St', 0, 0, 150
WHERE NOT EXISTS (SELECT 1 FROM organizations);

-- 2. Automatically use this organization when an Admin creates an employee
ALTER TABLE employees 
ALTER COLUMN org_id SET DEFAULT (SELECT id FROM organizations LIMIT 1);
