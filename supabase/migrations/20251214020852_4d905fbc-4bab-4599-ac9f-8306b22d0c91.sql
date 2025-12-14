-- Create a table for user project data storage
CREATE TABLE public.project_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, key)
);

-- Enable Row Level Security
ALTER TABLE public.project_data ENABLE ROW LEVEL SECURITY;

-- Create policies for user access (users can only access data for their own projects)
CREATE POLICY "Users can view their project data"
ON public.project_data
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_data.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their project data"
ON public.project_data
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_data.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their project data"
ON public.project_data
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_data.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their project data"
ON public.project_data
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_data.project_id 
    AND projects.user_id = auth.uid()
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_project_data_updated_at
BEFORE UPDATE ON public.project_data
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();