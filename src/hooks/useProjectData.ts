import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

interface ProjectDataItem {
  id: string;
  project_id: string;
  key: string;
  value: Json;
  created_at: string;
  updated_at: string;
}

export function useProjectData(projectId: string | null) {
  const queryClient = useQueryClient();

  const { data: projectData = [], isLoading } = useQuery({
    queryKey: ["project-data", projectId],
    queryFn: async (): Promise<ProjectDataItem[]> => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from("project_data")
        .select("*")
        .eq("project_id", projectId)
        .order("key");

      if (error) throw error;
      return (data || []) as ProjectDataItem[];
    },
    enabled: !!projectId,
  });

  const setDataMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: Json }) => {
      if (!projectId) throw new Error("No project selected");
      
      const { data, error } = await supabase
        .from("project_data")
        .upsert(
          { project_id: projectId, key, value },
          { onConflict: "project_id,key" }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-data", projectId] });
    },
  });

  const deleteDataMutation = useMutation({
    mutationFn: async (key: string) => {
      if (!projectId) throw new Error("No project selected");
      
      const { error } = await supabase
        .from("project_data")
        .delete()
        .eq("project_id", projectId)
        .eq("key", key);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-data", projectId] });
    },
  });

  return {
    projectData,
    isLoading,
    setData: setDataMutation.mutateAsync,
    deleteData: deleteDataMutation.mutateAsync,
    isUpdating: setDataMutation.isPending || deleteDataMutation.isPending,
  };
}
