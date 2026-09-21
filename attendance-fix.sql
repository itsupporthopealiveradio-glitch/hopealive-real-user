-- 1. Drop old attendance_records policies
DROP POLICY IF EXISTS "Employees can view own attendance" ON attendance_records;
DROP POLICY IF EXISTS "Employees can insert own attendance" ON attendance_records;
DROP POLICY IF EXISTS "Employees can update own attendance" ON attendance_records;
DROP POLICY IF EXISTS "Admins can view all attendance" ON attendance_records;

-- 2. Create new attendance_records policies using is_admin()
CREATE POLICY "Employees can view own attendance" ON attendance_records
FOR SELECT USING (
  employee_id IN (SELECT id FROM employees WHERE auth_user_id = auth.uid()) 
  OR is_admin()
);

-- Note: We use RPC functions for insert/update to bypass RLS securely

-- 3. Create secure RPC for clocking in
CREATE OR REPLACE FUNCTION save_clock_in(p_employee_id UUID, p_clock_in_time TIMESTAMP WITH TIME ZONE)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Security check
  IF NOT EXISTS (
    SELECT 1 FROM employees 
    WHERE id = p_employee_id 
      AND (auth_user_id = auth.uid() OR email = (auth.jwt() ->> 'email'))
  ) THEN
    RAISE EXCEPTION 'Unauthorized: employee does not match logged-in user';
  END IF;

  -- Get org_id for the employee
  SELECT org_id INTO v_org_id FROM employees WHERE id = p_employee_id;

  -- Insert clock-in
  INSERT INTO attendance_records (employee_id, org_id, clock_in_at, status, clock_in_method)
  VALUES (p_employee_id, v_org_id, p_clock_in_time, 'in_progress', 'face');

  RETURN TRUE;
END;
$$;

-- 4. Create secure RPC for clocking out
CREATE OR REPLACE FUNCTION save_clock_out(p_employee_id UUID, p_clock_out_time TIMESTAMP WITH TIME ZONE)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record_id UUID;
BEGIN
  -- Security check
  IF NOT EXISTS (
    SELECT 1 FROM employees 
    WHERE id = p_employee_id 
      AND (auth_user_id = auth.uid() OR email = (auth.jwt() ->> 'email'))
  ) THEN
    RAISE EXCEPTION 'Unauthorized: employee does not match logged-in user';
  END IF;

  -- Find the open record
  SELECT id INTO v_record_id 
  FROM attendance_records 
  WHERE employee_id = p_employee_id 
    AND clock_out_at IS NULL 
  ORDER BY clock_in_at DESC 
  LIMIT 1;

  IF v_record_id IS NOT NULL THEN
    UPDATE attendance_records 
    SET clock_out_at = p_clock_out_time, status = 'complete', clock_out_method = 'face'
    WHERE id = v_record_id;
  END IF;

  RETURN TRUE;
END;
$$;
