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

  const env = Deno.env.toObject();
  const SUPABASE_OAUTH_CLIENT_ID = env["SUPABASE_OAUTH_CLIENT_ID"];
  const SUPABASE_OAUTH_CLIENT_SECRET = env["SUPABASE_OAUTH_CLIENT_SECRET"];
  const SUPABASE_URL = env["SUPABASE_URL"];
  const SUPABASE_SERVICE_ROLE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"];

  const oauthEnvKeys = Object.keys(env).filter((k) => k.includes("OAUTH"));
  console.log("[supabase-oauth] Env keys containing 'OAUTH':", oauthEnvKeys);

  const hasGemini = !!env["GOOGLE_GEMINI_API_KEY"];

  console.log("[supabase-oauth] Environment check:", {
    envKeyCount: Object.keys(env).length,
    hasClientId: !!SUPABASE_OAUTH_CLIENT_ID,
    hasClientSecret: !!SUPABASE_OAUTH_CLIENT_SECRET,
    hasSupabaseUrl: !!SUPABASE_URL,
    clientIdLength: SUPABASE_OAUTH_CLIENT_ID?.length || 0,
    clientSecretLength: SUPABASE_OAUTH_CLIENT_SECRET?.length || 0,
    hasGemini,
    geminiLength: env["GOOGLE_GEMINI_API_KEY"]?.length || 0,
  });

  console.log("[supabase-oauth] Available env keys:", Object.keys(env));

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Generate OAuth authorization URL
    if (action === "authorize") {
      const { projectId, redirectUri } = await req.json();
      
      if (!SUPABASE_OAUTH_CLIENT_ID) {
        console.error("[supabase-oauth] SUPABASE_OAUTH_CLIENT_ID is missing or empty");
        throw new Error("OAuth not configured - missing client ID");
      }

      // State contains projectId to link connection after callback
      const state = btoa(JSON.stringify({ projectId, redirectUri }));
      
      const authUrl = new URL("https://api.supabase.com/v1/oauth/authorize");
      authUrl.searchParams.set("client_id", SUPABASE_OAUTH_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("state", state);
      
      console.log("[supabase-oauth] Generated auth URL for project:", projectId);
      
      return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle OAuth callback - exchange code for tokens
    if (action === "callback") {
      const { code, state } = await req.json();
      
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
      
      if (!SUPABASE_OAUTH_CLIENT_ID || !SUPABASE_OAUTH_CLIENT_SECRET) {
        throw new Error("OAuth not configured");
      }

      // Exchange code for tokens
      const tokenResponse = await fetch("https://api.supabase.com/v1/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${btoa(`${SUPABASE_OAUTH_CLIENT_ID}:${SUPABASE_OAUTH_CLIENT_SECRET}`)}`,
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

      // Fetch user's Supabase organizations and projects
      const orgsResponse = await fetch("https://api.supabase.com/v1/organizations", {
        headers: {
          "Authorization": `Bearer ${tokens.access_token}`,
        },
      });

      if (!orgsResponse.ok) {
        throw new Error("Failed to fetch organizations");
      }

      const organizations = await orgsResponse.json();

      // Fetch projects for each org
      const allProjects = [];
      for (const org of organizations) {
        const projectsResponse = await fetch(`https://api.supabase.com/v1/projects`, {
          headers: {
            "Authorization": `Bearer ${tokens.access_token}`,
          },
        });

        if (projectsResponse.ok) {
          const projects = await projectsResponse.json();
          allProjects.push(...projects.map((p: any) => ({
            id: p.id,
            name: p.name,
            region: p.region,
            organization_id: p.organization_id,
            // Construct the API URL
            apiUrl: `https://${p.id}.supabase.co`,
          })));
        }
      }

      // Store tokens temporarily (will be used when user selects a project)
      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        
        // Store OAuth session temporarily
        await supabase.from("project_data").upsert({
          project_id: projectId,
          key: "supabase_oauth_session",
          value: {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: Date.now() + (tokens.expires_in * 1000),
          },
        }, { onConflict: "project_id,key" });
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
      const { projectId, supabaseProjectId } = await req.json();
      
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Server not configured");
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Get stored OAuth session
      const { data: sessionData } = await supabase
        .from("project_data")
        .select("value")
        .eq("project_id", projectId)
        .eq("key", "supabase_oauth_session")
        .single();

      if (!sessionData?.value) {
        throw new Error("No OAuth session found");
      }

      const session = sessionData.value as { access_token: string };

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

      await supabase.from("project_data").upsert({
        project_id: projectId,
        key: "supabase_connection",
        value: connectionData,
      }, { onConflict: "project_id,key" });

      // Clean up OAuth session
      await supabase.from("project_data")
        .delete()
        .eq("project_id", projectId)
        .eq("key", "supabase_oauth_session");

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
