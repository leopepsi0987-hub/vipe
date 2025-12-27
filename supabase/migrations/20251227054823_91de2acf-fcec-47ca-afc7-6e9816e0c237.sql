-- Add supabase_connection column to generation_sessions
ALTER TABLE public.generation_sessions 
ADD COLUMN supabase_connection jsonb;