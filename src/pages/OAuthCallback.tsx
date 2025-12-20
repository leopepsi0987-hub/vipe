import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const OAuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"processing" | "selecting" | "error">("processing");
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [selectingProject, setSelectingProject] = useState<string | null>(null);

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");

    if (!code || !state) {
      toast.error("Invalid OAuth callback");
      navigate("/");
      return;
    }

    // Clean up URL
    window.history.replaceState({}, "", window.location.pathname);

    try {
      // Decode state to get project ID
      let stateData;
      try {
        stateData = JSON.parse(atob(state));
      } catch {
        throw new Error("Invalid state");
      }

      setProjectId(stateData.projectId);

      const { data, error } = await supabase.functions.invoke("supabase-oauth", {
        body: {
          action: "callback",
          code,
          state,
        },
      });

      if (error) throw error;

      if ((data as any)?.error) {
        throw new Error((data as any).error);
      }

      if ((data as any)?.projects) {
        setProjects((data as any).projects);
        setStatus("selecting");
        toast.success("Authenticated! Select a project to connect.");
      }
    } catch (error) {
      console.error("OAuth callback error:", error);
      toast.error("Failed to complete OAuth flow");
      setStatus("error");
      // Redirect back to project after a delay
      setTimeout(() => {
        if (projectId) {
          navigate(`/project/${projectId}`);
        } else {
          navigate("/");
        }
      }, 2000);
    }
  };

  const handleSelectProject = async (supabaseProject: any) => {
    if (!projectId) return;
    
    setSelectingProject(supabaseProject.id);

    try {
      const { data, error } = await supabase.functions.invoke("supabase-oauth", {
        body: {
          action: "select-project",
          projectId,
          supabaseProjectId: supabaseProject.id,
        },
      });

      if (error) throw error;

      if ((data as any)?.error) {
        throw new Error((data as any).error);
      }

      if ((data as any)?.success) {
        toast.success(`Connected to ${supabaseProject.name}!`);
        navigate(`/project/${projectId}`);
      }
    } catch (error) {
      console.error("Project selection error:", error);
      toast.error("Failed to connect project");
      setSelectingProject(null);
    }
  };

  if (status === "processing") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Connecting to Supabase...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <p className="text-destructive">Failed to connect. Redirecting...</p>
      </div>
    );
  }

  // Project selection view
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-6 shadow-lg">
        <h2 className="text-xl font-semibold text-foreground mb-2">Select a Project</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Choose which Supabase project to connect.
        </p>

        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {projects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No projects found in your Supabase account.</p>
              <p className="text-sm mt-2">Create a project in Supabase first.</p>
            </div>
          ) : (
            projects.map((project) => (
              <button
                key={project.id}
                onClick={() => handleSelectProject(project)}
                disabled={selectingProject !== null}
                className="w-full flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    <span className="text-white font-bold">
                      {project.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-foreground">{project.name}</p>
                    <p className="text-xs text-muted-foreground">{project.region}</p>
                  </div>
                </div>
                {selectingProject === project.id && (
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                )}
              </button>
            ))
          )}
        </div>

        <button
          onClick={() => projectId ? navigate(`/project/${projectId}`) : navigate("/")}
          className="w-full mt-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default OAuthCallback;
