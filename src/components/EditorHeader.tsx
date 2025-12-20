import { useState } from "react";
import { ArrowLeft, Database, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SupabaseConnectionModal } from "./SupabaseConnectionModal";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

interface EditorHeaderProps {
  projectName: string;
  projectId: string;
  onBack: () => void;
}

export function EditorHeader({ projectName, projectId, onBack }: EditorHeaderProps) {
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    checkConnection();
  }, [projectId]);

  const checkConnection = async () => {
    try {
      const { data } = await supabase
        .from("project_data")
        .select("value")
        .eq("project_id", projectId)
        .eq("key", "supabase_connection")
        .maybeSingle();

      if (data) {
        const conn = data.value as { connected?: boolean };
        setIsConnected(conn?.connected || false);
      } else {
        setIsConnected(false);
      }
    } catch {
      setIsConnected(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onBack}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-sm">
              <span className="text-primary-foreground font-bold text-sm">
                {projectName.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="font-medium text-foreground">{projectName}</span>
          </div>
        </div>

        <Button
          variant={isConnected ? "outline" : "default"}
          size="sm"
          onClick={() => setShowSupabaseModal(true)}
          className="gap-2"
        >
          {isConnected ? (
            <>
              <CheckCircle className="w-4 h-4 text-success" />
              <span className="hidden sm:inline">Supabase Connected</span>
              <span className="sm:hidden">Connected</span>
            </>
          ) : (
            <>
              <Database className="w-4 h-4" />
              <span className="hidden sm:inline">Connect Supabase</span>
              <span className="sm:hidden">Connect</span>
            </>
          )}
        </Button>
      </div>

      <SupabaseConnectionModal
        open={showSupabaseModal}
        onOpenChange={(open) => {
          setShowSupabaseModal(open);
          if (!open) checkConnection();
        }}
        projectId={projectId}
      />
    </>
  );
}
