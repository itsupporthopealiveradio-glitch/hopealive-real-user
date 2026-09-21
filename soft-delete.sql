-- Add status column for soft deletes (active, terminated)
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Update any existing null statuses to active
UPDATE employees SET status = 'active' WHERE status IS NULL;
