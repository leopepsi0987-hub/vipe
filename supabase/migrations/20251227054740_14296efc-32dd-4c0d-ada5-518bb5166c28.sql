-- Create a separate table for OAuth sessions (without foreign key constraints)
CREATE TABLE public.oauth_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text,
  expires_at bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.oauth_sessions ENABLE ROW LEVEL SECURITY;

-- Open policies (anyone can manage their session by knowing the ID)
CREATE POLICY "Anyone can view oauth sessions" ON public.oauth_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can create oauth sessions" ON public.oauth_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update oauth sessions" ON public.oauth_sessions FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete oauth sessions" ON public.oauth_sessions FOR DELETE USING (true);

-- Index for lookups
CREATE INDEX idx_oauth_sessions_session_id ON public.oauth_sessions(session_id);