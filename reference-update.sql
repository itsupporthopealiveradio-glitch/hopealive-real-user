-- Add reference_descriptor column to employees table to store the Admin's uploaded photo signature
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS reference_descriptor JSONB;
