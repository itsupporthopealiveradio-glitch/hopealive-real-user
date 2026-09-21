-- Enable RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (so the frontend can log events)
CREATE POLICY "Allow public inserts" ON public.audit_log FOR INSERT WITH CHECK (true);

-- Allow public reads (so the Admin Dashboard can fetch the logs)
CREATE POLICY "Allow public reads" ON public.audit_log FOR SELECT USING (true);

-- Also, if we ever need to delete or update logs
CREATE POLICY "Allow public deletes" ON public.audit_log FOR DELETE USING (true);
CREATE POLICY "Allow public updates" ON public.audit_log FOR UPDATE USING (true);
