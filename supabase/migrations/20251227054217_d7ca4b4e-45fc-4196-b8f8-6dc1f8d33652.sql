-- Create table for storing generation sessions
CREATE TABLE public.generation_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text NOT NULL UNIQUE,
  sandbox_id text,
  sandbox_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create table for storing chat messages
CREATE TABLE public.generation_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text NOT NULL,
  content text NOT NULL,
  type text NOT NULL DEFAULT 'user',
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create table for storing generated files
CREATE TABLE public.generation_files (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text NOT NULL,
  file_path text NOT NULL,
  content text NOT NULL,
  file_type text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(session_id, file_path)
);

-- Create indexes for performance
CREATE INDEX idx_generation_messages_session ON public.generation_messages(session_id);
CREATE INDEX idx_generation_files_session ON public.generation_files(session_id);

-- Enable RLS
ALTER TABLE public.generation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_files ENABLE ROW LEVEL SECURITY;

-- Create open policies (anyone can access their session by knowing the ID)
CREATE POLICY "Anyone can view sessions" ON public.generation_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can create sessions" ON public.generation_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update sessions" ON public.generation_sessions FOR UPDATE USING (true);

CREATE POLICY "Anyone can view messages" ON public.generation_messages FOR SELECT USING (true);
CREATE POLICY "Anyone can create messages" ON public.generation_messages FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view files" ON public.generation_files FOR SELECT USING (true);
CREATE POLICY "Anyone can create files" ON public.generation_files FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update files" ON public.generation_files FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete files" ON public.generation_files FOR DELETE USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_generation_sessions_updated_at
BEFORE UPDATE ON public.generation_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_generation_files_updated_at
BEFORE UPDATE ON public.generation_files
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();