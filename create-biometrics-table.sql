-- Run this SQL in your Supabase Dashboard > SQL Editor
-- This creates the user_biometrics table for storing the Face ID references

CREATE TABLE IF NOT EXISTS public.user_biometrics (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  user_email text,
  face_descriptor jsonb NOT NULL, -- Stores the 128 floating point array of the face reference
  enrolled_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_biometrics ENABLE ROW LEVEL SECURITY;

-- Policies: Users can view, insert, and update their own biometrics
DROP POLICY IF EXISTS "Users can view own biometrics" ON public.user_biometrics;
CREATE POLICY "Users can view own biometrics"
  ON public.user_biometrics FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own biometrics" ON public.user_biometrics;
CREATE POLICY "Users can insert own biometrics"
  ON public.user_biometrics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own biometrics" ON public.user_biometrics;
CREATE POLICY "Users can update own biometrics"
  ON public.user_biometrics FOR UPDATE
  USING (auth.uid() = user_id);
