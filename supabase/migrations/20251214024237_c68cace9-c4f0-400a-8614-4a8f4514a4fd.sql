-- Allow service role to access project_data for published projects via app-api
-- The edge function uses service role key, so it bypasses RLS
-- But we need to ensure the function only accesses data for published projects (handled in code)

-- Add a policy for public read access to project_data for published projects
-- This allows the app-api to work correctly
CREATE POLICY "Public can read data for published projects"
ON public.project_data
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_data.project_id 
    AND projects.is_published = true
  )
);

-- Allow public insert/update for published projects (via app-api)
CREATE POLICY "Public can insert data for published projects"
ON public.project_data
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_data.project_id 
    AND projects.is_published = true
  )
);

CREATE POLICY "Public can update data for published projects"
ON public.project_data
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_data.project_id 
    AND projects.is_published = true
  )
);

CREATE POLICY "Public can delete data for published projects"
ON public.project_data
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_data.project_id 
    AND projects.is_published = true
  )
);