import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Project {
  id: string;
  user_id: string;
  name: string;
  html_code: string;
  is_published: boolean;
  slug: string | null;
  created_at: string;
  updated_at: string;
}

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>My App</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    h1 {
      font-size: 3rem;
      margin-bottom: 1rem;
      background: linear-gradient(90deg, #00d9ff, #a855f7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p {
      color: #94a3b8;
      font-size: 1.25rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Welcome to Vipe</h1>
    <p>Start building by sending a message to the AI</p>
  </div>
</body>
</html>`;

export function useProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProjects();
    } else {
      setProjects([]);
      setCurrentProject(null);
      setLoading(false);
    }
  }, [user]);

  const fetchProjects = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching projects:", error);
    } else {
      setProjects(data || []);
      if (data && data.length > 0 && !currentProject) {
        setCurrentProject(data[0]);
      }
    }
    setLoading(false);
  };

  const createProject = async (name: string = "Untitled Project") => {
    if (!user) return null;

    const { data, error } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        name,
        html_code: DEFAULT_HTML,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating project:", error);
      return null;
    }

    setProjects((prev) => [data, ...prev]);
    setCurrentProject(data);
    return data;
  };

  const updateProject = async (id: string, updates: Partial<Project>) => {
    const { data, error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating project:", error);
      return null;
    }

    setProjects((prev) =>
      prev.map((p) => (p.id === id ? data : p))
    );
    if (currentProject?.id === id) {
      setCurrentProject(data);
    }
    return data;
  };

  const deleteProject = async (id: string) => {
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting project:", error);
      return false;
    }

    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (currentProject?.id === id) {
      setCurrentProject(projects.find((p) => p.id !== id) || null);
    }
    return true;
  };

  const publishProject = async (id: string) => {
    // Generate a unique slug
    const slug = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
    
    const { data, error } = await supabase
      .from("projects")
      .update({ is_published: true, slug })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error publishing project:", error);
      return null;
    }

    setProjects((prev) =>
      prev.map((p) => (p.id === id ? data : p))
    );
    if (currentProject?.id === id) {
      setCurrentProject(data);
    }
    return data;
  };

  const unpublishProject = async (id: string) => {
    const { data, error } = await supabase
      .from("projects")
      .update({ is_published: false })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error unpublishing project:", error);
      return null;
    }

    setProjects((prev) =>
      prev.map((p) => (p.id === id ? data : p))
    );
    if (currentProject?.id === id) {
      setCurrentProject(data);
    }
    return data;
  };

  return {
    projects,
    currentProject,
    setCurrentProject,
    loading,
    createProject,
    updateProject,
    deleteProject,
    publishProject,
    unpublishProject,
    refreshProjects: fetchProjects,
  };
}
