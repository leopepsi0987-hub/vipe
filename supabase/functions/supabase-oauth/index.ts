import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Try multiple possible secret names for OAuth credentials
  const OAUTH_CLIENT_ID = Deno.env.get("OAUTH_CLIENT_ID") || Deno.env.get("SUPABASE_OAUTH_CLIENT_ID");
  const OAUTH_CLIENT_SECRET = Deno.env.get("OAUTH_CLIENT_SECRET") || Deno.env.get("SUPABASE_OAUTH_CLIENT_SECRET");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  console.log("[supabase-oauth] Environment check:", {
    hasClientId: !!OAUTH_CLIENT_ID,
    hasClientSecret: !!OAUTH_CLIENT_SECRET,
    hasSupabaseUrl: !!SUPABASE_URL,
    clientIdLength: OAUTH_CLIENT_ID?.length || 0,
  });

  try {
    const url = new URL(req.url);

    // Support action passed via querystring OR JSON body (for supabase.functions.invoke)
    let payload: any = null;
    if (req.method !== "GET") {
      try {
        payload = await req.json();
      } catch {
        payload = null;
      }
    }

    const action = url.searchParams.get("action") ?? payload?.action;

    // Generate OAuth authorization URL
    if (action === "authorize") {
      const { projectId, redirectUri } = payload ?? {};

      if (!OAUTH_CLIENT_ID) {
        console.error("[supabase-oauth] OAuth client ID is missing");
        throw new Error("OAuth not configured - missing client ID");
      }

      // State contains projectId to link connection after callback
      const state = btoa(JSON.stringify({ projectId, redirectUri }));

      const authUrl = new URL("https://api.supabase.com/v1/oauth/authorize");
      authUrl.searchParams.set("client_id", OAUTH_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("state", state);

      console.log("[supabase-oauth] Generated auth URL", {
        projectId,
        redirectUri,
        authUrl: authUrl.toString(),
      });

      return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle OAuth callback - exchange code for tokens
    if (action === "callback") {
      const { code, state } = payload ?? {};

      if (!code || !state) {
        throw new Error("Missing code or state");
      }

      // Decode state to get projectId
      let stateData;
      try {
        stateData = JSON.parse(atob(state));
      } catch {
        throw new Error("Invalid state");
      }

      const { projectId, redirectUri } = stateData;
      
      if (!OAUTH_CLIENT_ID || !OAUTH_CLIENT_SECRET) {
        throw new Error("OAuth not configured");
      }

      // Exchange code for tokens
      const tokenResponse = await fetch("https://api.supabase.com/v1/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${btoa(`${OAUTH_CLIENT_ID}:${OAUTH_CLIENT_SECRET}`)}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("[supabase-oauth] Token exchange failed:", errorText);
        throw new Error("Failed to exchange code for tokens");
      }

      const tokens = await tokenResponse.json();
      console.log("[supabase-oauth] Got tokens for project:", projectId);

      // Fetch user's projects
      const projectsResponse = await fetch("https://api.supabase.com/v1/projects", {
        headers: {
          "Authorization": `Bearer ${tokens.access_token}`,
        },
      });

      if (!projectsResponse.ok) {
        const errorText = await projectsResponse.text();
        console.error("[supabase-oauth] Failed to fetch projects:", {
          status: projectsResponse.status,
          errorText,
        });
        throw new Error("Failed to fetch projects");
      }

      const projects = await projectsResponse.json();

      const allProjects = (Array.isArray(projects) ? projects : []).map((p: any) => ({
        id: p.id,
        name: p.name,
        region: p.region,
        organization_id: p.organization_id,
        apiUrl: `https://${p.id}.supabase.co`,
      }));

      console.log("[supabase-oauth] Loaded projects:", allProjects.length);

      // Store tokens in oauth_sessions table (no foreign key constraint)
      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        
        // Store OAuth session in dedicated table
        const { error: upsertError } = await supabase.from("oauth_sessions").upsert({
          session_id: projectId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: Date.now() + (tokens.expires_in * 1000),
        }, { onConflict: "session_id" });
        
        if (upsertError) {
          console.error("[supabase-oauth] Failed to store OAuth session:", upsertError);
        } else {
          console.log("[supabase-oauth] Stored OAuth session for:", projectId);
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        projects: allProjects,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Select a project to connect
    if (action === "select-project") {
      const { projectId, supabaseProjectId } = payload ?? {};

      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Server not configured");
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Get stored OAuth session from dedicated table
      const { data: sessionData, error: sessionError } = await supabase
        .from("oauth_sessions")
        .select("*")
        .eq("session_id", projectId)
        .single();

      if (sessionError) {
        console.error("[supabase-oauth] Session lookup error:", sessionError);
      }

      if (!sessionData?.access_token) {
        console.error("[supabase-oauth] No OAuth session found for:", projectId);
        throw new Error("No OAuth session found. Please try connecting again.");
      }

      const session = { access_token: sessionData.access_token };

      // Get API keys for the selected project
      const keysResponse = await fetch(`https://api.supabase.com/v1/projects/${supabaseProjectId}/api-keys`, {
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      if (!keysResponse.ok) {
        const errorText = await keysResponse.text();
        console.error("[supabase-oauth] Failed to get API keys:", errorText);
        throw new Error("Failed to get API keys");
      }

      const keys = await keysResponse.json();
      const serviceRoleKey = keys.find((k: any) => k.name === "service_role")?.api_key;
      const anonKey = keys.find((k: any) => k.name === "anon")?.api_key;

      if (!serviceRoleKey) {
        throw new Error("Could not find service role key");
      }

      // Store the connection
      const connectionData = {
        url: `https://${supabaseProjectId}.supabase.co`,
        serviceRoleKey,
        anonKey,
        connected: true,
        connectedVia: "oauth",
        supabaseProjectId,
      };

      // Store connection in generation_sessions for the generation page
      const { error: upsertGenError } = await supabase
        .from("generation_sessions")
        .upsert({
          session_id: projectId,
          supabase_connection: connectionData,
        }, { onConflict: "session_id" });

      if (upsertGenError) {
        console.log("[supabase-oauth] Could not store in generation_sessions:", upsertGenError.message);
      } else {
        console.log("[supabase-oauth] Stored connection in generation_sessions for:", projectId);
      }

      // Also try to store in project_data if it's a real project (may fail due to FK constraint)
      const { error: upsertPdError } = await supabase.from("project_data").upsert({
        project_id: projectId,
        key: "supabase_connection",
        value: connectionData,
      }, { onConflict: "project_id,key" });
      
      if (upsertPdError) {
        console.log("[supabase-oauth] Could not store in project_data (expected for generation sessions):", upsertPdError.message);
      }

      // Clean up OAuth session from the dedicated table
      await supabase.from("oauth_sessions")
        .delete()
        .eq("session_id", projectId);

      console.log("[supabase-oauth] Connected project:", supabaseProjectId);

      return new Response(JSON.stringify({ 
        success: true, 
        connection: {
          url: connectionData.url,
          connected: true,
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (error) {
    console.error("[supabase-oauth] Error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
