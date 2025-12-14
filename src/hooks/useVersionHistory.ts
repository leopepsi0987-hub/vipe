import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Version {
  id: string;
  project_id: string;
  html_code: string;
  version_number: number;
  created_at: string;
}

export function useVersionHistory(projectId: string) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchVersions();
    }
  }, [projectId]);

  const fetchVersions = async () => {
    if (!projectId) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from("project_versions")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Error fetching versions:", error);
    } else {
      setVersions(data || []);
    }
    setLoading(false);
  };

  const saveVersion = async (htmlCode: string) => {
    if (!projectId) return null;

    // Get the next version number
    const nextVersionNumber = versions.length > 0 
      ? Math.max(...versions.map(v => v.version_number)) + 1 
      : 1;

    const { data, error } = await supabase
      .from("project_versions")
      .insert({
        project_id: projectId,
        html_code: htmlCode,
        version_number: nextVersionNumber,
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving version:", error);
      return null;
    }

    setVersions((prev) => [data, ...prev]);
    return data;
  };

  const deleteVersion = async (versionId: string) => {
    const { error } = await supabase
      .from("project_versions")
      .delete()
      .eq("id", versionId);

    if (error) {
      console.error("Error deleting version:", error);
      return false;
    }

    setVersions((prev) => prev.filter((v) => v.id !== versionId));
    return true;
  };

  return {
    versions,
    loading,
    saveVersion,
    deleteVersion,
    refreshVersions: fetchVersions,
  };
}
