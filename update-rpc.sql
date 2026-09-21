CREATE OR REPLACE FUNCTION save_clock_out(p_employee_id uuid, p_clock_out_time timestamp with time zone, p_status text DEFAULT 'clock_out')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE attendance_records
  SET clock_out_at = p_clock_out_time,
      status = p_status
  WHERE employee_id = p_employee_id
    AND clock_out_at IS NULL
    AND clock_in_at::date = p_clock_out_time::date;
END;
$$;
