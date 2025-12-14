-- Add publishing fields to projects table
ALTER TABLE public.projects
ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN slug TEXT UNIQUE;

-- Create index for faster slug lookups
CREATE INDEX idx_projects_slug ON public.projects(slug) WHERE slug IS NOT NULL;

-- Allow public read access to published projects
CREATE POLICY "Anyone can view published projects"
ON public.projects
FOR SELECT
USING (is_published = true);
