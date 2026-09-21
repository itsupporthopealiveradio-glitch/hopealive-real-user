-- 1. Add the new columns to the employees table
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS id_number TEXT,
ADD COLUMN IF NOT EXISTS department TEXT;

-- 2. Convert onboarding_status to TEXT to remove strict enum restrictions
ALTER TABLE employees ALTER COLUMN onboarding_status TYPE TEXT;

-- 3. Add RLS Policies so Admins can Insert, Update, and Delete employees
CREATE POLICY "Admins can insert employees" ON employees
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM employees e WHERE e.auth_user_id = auth.uid() AND e.role = 'admin')
);

CREATE POLICY "Admins can delete employees" ON employees
FOR DELETE USING (
  EXISTS (SELECT 1 FROM employees e WHERE e.auth_user_id = auth.uid() AND e.role = 'admin')
);

CREATE POLICY "Admins can update employees" ON employees
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM employees e WHERE e.auth_user_id = auth.uid() AND e.role = 'admin')
);

-- 4. Create RPC function for checking if an employee email and ID number match the pre-authorized record
DROP FUNCTION IF EXISTS check_employee_exists(TEXT);

CREATE OR REPLACE FUNCTION check_employee_exists(emp_email TEXT, emp_id_number TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as Postgres (bypasses RLS)
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM employees 
    WHERE email = LOWER(emp_email) 
      AND id_number = emp_id_number
  );
END;
$$;

-- 5. Create Trigger function to automatically link auth.users to employees
CREATE OR REPLACE FUNCTION link_employee_to_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Link the new auth.user to the pre-authorized employee record based on email
  UPDATE employees 
  SET auth_user_id = NEW.id
  WHERE email = NEW.email;
  RETURN NEW;
END;
$$;

-- 6. Attach Trigger to auth.users (Executes after a new user signs up)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION link_employee_to_auth();
