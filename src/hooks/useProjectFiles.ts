import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProjectFile {
  id: string;
  project_id: string;
  file_path: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface FileOperation {
  path: string;
  action: "create" | "update" | "delete";
  content?: string;
}

export function useProjectFiles(projectId: string | null) {
  const [files, setFiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all files for a project
  const fetchFiles = useCallback(async () => {
    if (!projectId) {
      setFiles({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("project_files")
        .select("*")
        .eq("project_id", projectId);

      if (fetchError) throw fetchError;

      const fileMap: Record<string, string> = {};
      (data || []).forEach((file: ProjectFile) => {
        fileMap[file.file_path] = file.content;
      });

      setFiles(fileMap);
    } catch (err) {
      console.error("Error fetching project files:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch files");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Apply file operations (create/update/delete)
  const applyOperations = useCallback(async (operations: FileOperation[]) => {
    if (!projectId) return false;

    try {
      for (const op of operations) {
        if (op.action === "create" || op.action === "update") {
          // Upsert file
          const { error: upsertError } = await supabase
            .from("project_files")
            .upsert(
              {
                project_id: projectId,
                file_path: op.path,
                content: op.content || "",
              },
              {
                onConflict: "project_id,file_path",
              }
            );

          if (upsertError) throw upsertError;

          // Update local state
          setFiles(prev => ({
            ...prev,
            [op.path]: op.content || "",
          }));

        } else if (op.action === "delete") {
          // Delete file
          const { error: deleteError } = await supabase
            .from("project_files")
            .delete()
            .eq("project_id", projectId)
            .eq("file_path", op.path);

          if (deleteError) throw deleteError;

          // Update local state
          setFiles(prev => {
            const newFiles = { ...prev };
            delete newFiles[op.path];
            return newFiles;
          });
        }
      }

      return true;
    } catch (err) {
      console.error("Error applying file operations:", err);
      setError(err instanceof Error ? err.message : "Failed to apply operations");
      return false;
    }
  }, [projectId]);

  // Update a single file
  const updateFile = useCallback(async (path: string, content: string) => {
    return applyOperations([{ path, action: "update", content }]);
  }, [applyOperations]);

  // Delete a single file
  const deleteFile = useCallback(async (path: string) => {
    return applyOperations([{ path, action: "delete" }]);
  }, [applyOperations]);

  // Get file content by path
  const getFile = useCallback((path: string): string | undefined => {
    return files[path];
  }, [files]);

  return {
    files,
    loading,
    error,
    fetchFiles,
    applyOperations,
    updateFile,
    deleteFile,
    getFile,
  };
}
