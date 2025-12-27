import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database, Link, Unlink, CheckCircle, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SupabaseConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onConnected?: (connection: SupabaseConnection) => void;
}

interface SupabaseConnection {
  url: string;
  serviceRoleKey?: string;
  anonKey?: string;
  connected: boolean;
  connectedVia?: "oauth" | "manual";
  supabaseProjectId?: string;
}

interface SupabaseProject {
  id: string;
  name: string;
  region: string;
  apiUrl: string;
}

export function SupabaseConnectionModal({ open, onOpenChange, projectId, onConnected }: SupabaseConnectionModalProps) {
  const [url, setUrl] = useState("");
  const [serviceRoleKey, setServiceRoleKey] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connection, setConnection] = useState<SupabaseConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [showManual, setShowManual] = useState(false);
  
  // OAuth flow state
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const [oauthProjects, setOauthProjects] = useState<SupabaseProject[] | null>(null);
  const [selectingProject, setSelectingProject] = useState<string | null>(null);

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

  const handleOAuthConnect = async () => {
    setIsOAuthLoading(true);
    
    try {
      // Use a single fixed callback URL that's whitelisted in Supabase OAuth settings
      const redirectUri = `${window.location.origin}/oauth/callback`;
      
      const { data, error } = await supabase.functions.invoke("supabase-oauth", {
        body: {
          action: "authorize",
          projectId,
          redirectUri,
        },
      });

      if (error) throw error;

      if ((data as any)?.error) {
        throw new Error((data as any).error);
      }

      if ((data as any)?.authUrl) {
        // Redirect to OAuth
        window.location.href = (data as any).authUrl;
      }
    } catch (error) {
      console.error("OAuth error:", error);
      toast.error("Failed to start OAuth flow");
      setIsOAuthLoading(false);
    }
  };

  const handleSelectProject = async (supabaseProject: SupabaseProject) => {
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
        const connectionData: SupabaseConnection = {
          url: supabaseProject.apiUrl,
          connected: true,
          connectedVia: "oauth",
          supabaseProjectId: supabaseProject.id,
        };
        toast.success(`Connected to ${supabaseProject.name}!`);
        setOauthProjects(null);
        loadConnection();
        onConnected?.(connectionData);
      }
    } catch (error) {
      console.error("Project selection error:", error);
      toast.error("Failed to connect project");
    } finally {
      setSelectingProject(null);
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

  const handleManualConnect = async () => {
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
      const isValid = await testConnection();
      if (!isValid) {
        setIsConnecting(false);
        return;
      }

      const connectionData: SupabaseConnection = {
        url: url.replace(/\/$/, ""),
        serviceRoleKey: keyToSave,
        connected: true,
        connectedVia: "manual",
      };

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
      setShowManual(false);
      toast.success("Supabase connected! The AI can now create tables and schemas.");
      onConnected?.(connectionData);
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
      setOauthProjects(null);
      toast.success("Supabase disconnected");
    } catch (error) {
      console.error("Error disconnecting:", error);
      toast.error("Failed to disconnect");
    }
  };

  // Project selection view
  if (oauthProjects) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              Select a Project
            </DialogTitle>
            <DialogDescription>
              Choose which Supabase project to connect to this app.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {oauthProjects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No projects found in your Supabase account.</p>
                  <p className="text-sm mt-2">Create a project in Supabase first.</p>
                </div>
              ) : (
                oauthProjects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => handleSelectProject(project)}
                    disabled={selectingProject !== null}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                        <Database className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-foreground">{project.name}</p>
                        <p className="text-xs text-muted-foreground">{project.region}</p>
                      </div>
                    </div>
                    {selectingProject === project.id ? (
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    ) : (
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                ))
              )}
            </div>
          </ScrollArea>

          <Button variant="outline" onClick={() => setOauthProjects(null)}>
            Cancel
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

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

        {loading || isOAuthLoading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {isOAuthLoading ? "Connecting to Supabase..." : "Loading..."}
            </p>
          </div>
        ) : connection?.connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/20">
              <CheckCircle className="w-5 h-5 text-success" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Connected</p>
                <p className="text-xs text-muted-foreground truncate">{connection.url}</p>
                {connection.connectedVia === "oauth" && (
                  <span className="text-xs text-success">via Supabase Login</span>
                )}
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
                Reconnect
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
        ) : showManual ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supabase-url">Supabase URL</Label>
              <Input
                id="supabase-url"
                placeholder="https://your-project.supabase.co"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
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
                  Service Role Key has full database access. Keep it secure.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowManual(false)}>
                Back
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={testConnection}
                disabled={isTesting || !url || !serviceRoleKey || serviceRoleKey.includes("•")}
              >
                {isTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Test
              </Button>
              <Button
                className="flex-1"
                onClick={handleManualConnect}
                disabled={isConnecting || !url || !serviceRoleKey || serviceRoleKey.includes("•")}
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
        ) : (
          <div className="space-y-4">
            {/* OAuth Connect Button */}
            <Button
              className="w-full h-12 gap-3"
              onClick={handleOAuthConnect}
              disabled={isOAuthLoading}
            >
              {isOAuthLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 109 113" fill="none">
                  <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="url(#paint0_linear)"/>
                  <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="url(#paint1_linear)" fillOpacity="0.2"/>
                  <path d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z" fill="#3ECF8E"/>
                  <defs>
                    <linearGradient id="paint0_linear" x1="53.9738" y1="54.974" x2="94.1635" y2="71.8295" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#249361"/>
                      <stop offset="1" stopColor="#3ECF8E"/>
                    </linearGradient>
                    <linearGradient id="paint1_linear" x1="36.1558" y1="30.578" x2="54.4844" y2="65.0806" gradientUnits="userSpaceOnUse">
                      <stop/>
                      <stop offset="1" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                </svg>
              )}
              <span>Connect with Supabase</span>
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>

            {/* Manual Connect Button */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowManual(true)}
            >
              Enter credentials manually
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
