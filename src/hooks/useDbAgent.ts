import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DbAgentResponse {
  sql: string;
  tables_affected: string[];
  success: boolean;
  error?: string;
}

export function useDbAgent(projectId: string | null) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastSql, setLastSql] = useState<string | null>(null);
  const [tablesAffected, setTablesAffected] = useState<string[]>([]);

  const generateSql = async (prompt: string): Promise<DbAgentResponse | null> => {
    if (!prompt.trim()) {
      toast.error("Please provide a prompt");
      return null;
    }

    setIsGenerating(true);
    setLastSql(null);
    setTablesAffected([]);

    try {
      const { data, error } = await supabase.functions.invoke<DbAgentResponse>("db-agent", {
        body: { prompt, projectId },
      });

      if (error) {
        console.error("[useDbAgent] Error:", error);
        toast.error("Failed to generate SQL: " + error.message);
        return null;
      }

      if (!data?.success) {
        toast.error(data?.error || "Failed to generate SQL");
        return null;
      }

      setLastSql(data.sql);
      setTablesAffected(data.tables_affected || []);
      
      return data;
    } catch (err) {
      console.error("[useDbAgent] Exception:", err);
      toast.error("An unexpected error occurred");
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generateSql,
    isGenerating,
    lastSql,
    tablesAffected,
  };
}
