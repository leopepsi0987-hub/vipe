import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database, Link, Unlink, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface SupabaseConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

interface SupabaseConnection {
  url: string;
  serviceRoleKey: string;
  connected: boolean;
}

export function SupabaseConnectionModal({ open, onOpenChange, projectId }: SupabaseConnectionModalProps) {
  const [url, setUrl] = useState("");
  const [serviceRoleKey, setServiceRoleKey] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connection, setConnection] = useState<SupabaseConnection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && projectId) {
      loadConnection();
    }
  }, [open, projectId]);

  const loadConnection = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("project_data")
        .select("value")
        .eq("project_id", projectId)
        .eq("key", "supabase_connection")
        .maybeSingle();

      if (data && !error) {
        const conn = data.value as unknown as SupabaseConnection;
        setConnection(conn);
        setUrl(conn.url || "");
        // Don't show the key for security - just indicate it's set
        setServiceRoleKey(conn.serviceRoleKey ? "••••••••••••••••" : "");
      } else {
        setConnection(null);
        setUrl("");
        setServiceRoleKey("");
      }
    } catch (error) {
      console.error("Error loading connection:", error);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    if (!url) {
      toast.error("Please enter your Supabase URL");
      return;
    }

    const keyToTest = serviceRoleKey.includes("•") ? connection?.serviceRoleKey : serviceRoleKey;
    if (!keyToTest) {
      toast.error("Please enter your Service Role Key");
      return;
    }

    setIsTesting(true);
    try {
      // Test the connection by making a request to the Supabase REST API
      const response = await fetch(`${url}/rest/v1/`, {
        method: "GET",
        headers: {
          "apikey": keyToTest,
          "Authorization": `Bearer ${keyToTest}`,
        },
      });

      if (response.ok || response.status === 200) {
        toast.success("Connection successful! ✅");
        return true;
      } else {
        toast.error("Connection failed. Check your credentials.");
        return false;
      }
    } catch (error) {
      toast.error("Connection failed. Check your URL and credentials.");
      return false;
    } finally {
      setIsTesting(false);
    }
  };

  const handleConnect = async () => {
    if (!url) {
      toast.error("Please enter your Supabase URL");
      return;
    }

    const keyToSave = serviceRoleKey.includes("•") ? connection?.serviceRoleKey : serviceRoleKey;
    if (!keyToSave) {
      toast.error("Please enter your Service Role Key");
      return;
    }

    setIsConnecting(true);
    try {
      // Test connection first
      const isValid = await testConnection();
      if (!isValid) {
        setIsConnecting(false);
        return;
      }

      const connectionData: SupabaseConnection = {
        url: url.replace(/\/$/, ""), // Remove trailing slash
        serviceRoleKey: keyToSave,
        connected: true,
      };

      // Check if record exists
      const { data: existing } = await supabase
        .from("project_data")
        .select("id")
        .eq("project_id", projectId)
        .eq("key", "supabase_connection")
        .maybeSingle();

      if (existing) {
        await supabase
          .from("project_data")
          .update({ value: connectionData as any })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("project_data")
          .insert({
            project_id: projectId,
            key: "supabase_connection",
            value: connectionData as any,
          });
      }

      setConnection(connectionData);
      toast.success("Supabase connected! The AI can now create tables and schemas.");
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving connection:", error);
      toast.error("Failed to save connection");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await supabase
        .from("project_data")
        .delete()
        .eq("project_id", projectId)
        .eq("key", "supabase_connection");

      setConnection(null);
      setUrl("");
      setServiceRoleKey("");
      toast.success("Supabase disconnected");
    } catch (error) {
      console.error("Error disconnecting:", error);
      toast.error("Failed to disconnect");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            Connect Your Supabase
          </DialogTitle>
          <DialogDescription>
            Connect your Supabase project so the AI can create tables, schemas, and RLS policies.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : connection?.connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/20">
              <CheckCircle className="w-5 h-5 text-success" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Connected</p>
                <p className="text-xs text-muted-foreground truncate">{connection.url}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setConnection(null);
                  setServiceRoleKey("");
                }}
              >
                Update Credentials
              </Button>
              <Button
                variant="destructive"
                onClick={handleDisconnect}
              >
                <Unlink className="w-4 h-4 mr-2" />
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supabase-url">Supabase URL</Label>
              <Input
                id="supabase-url"
                placeholder="https://your-project.supabase.co"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Find this in your Supabase Dashboard → Settings → API
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-role-key">Service Role Key</Label>
              <Input
                id="service-role-key"
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={serviceRoleKey}
                onChange={(e) => setServiceRoleKey(e.target.value)}
              />
              <div className="flex items-start gap-2 p-2 rounded-md bg-warning/10 border border-warning/20">
                <AlertCircle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                <p className="text-xs text-warning">
                  Service Role Key has full database access. Keep it secure and never share it publicly.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={testConnection}
                disabled={isTesting || !url || (!serviceRoleKey || serviceRoleKey.includes("•"))}
              >
                {isTesting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Test Connection
              </Button>
              <Button
                className="flex-1"
                onClick={handleConnect}
                disabled={isConnecting || !url || (!serviceRoleKey || serviceRoleKey.includes("•"))}
              >
                {isConnecting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Link className="w-4 h-4 mr-2" />
                )}
                Connect
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
