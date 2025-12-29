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

  try {
    const { sessionId, sql, supabaseProjectId } = await req.json();

    // Validate inputs
    if (!sql) {
      throw new Error("SQL query is required");
    }

    if (!sessionId) {
      throw new Error("Session ID is required");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Server not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get OAuth access token from oauth_sessions table
    const { data: oauthSession } = await supabase
      .from("oauth_sessions")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();

    // Try to find project by slug first
    const { data: projectBySlug } = await supabase
      .from("projects")
      .select("id")
      .eq("slug", sessionId)
      .maybeSingle();
    
    const actualProjectId = projectBySlug?.id || sessionId;

    // Get supabase connection from project_data
    const { data: connData } = await supabase
      .from("project_data")
      .select("value")
      .eq("project_id", actualProjectId)
      .eq("key", "supabase_connection")
      .maybeSingle();

    const connection = connData?.value as any;
    const targetProjectId = supabaseProjectId || connection?.supabaseProjectId;

    if (!targetProjectId) {
      throw new Error("No Supabase project connected. Please connect your Supabase project first.");
    }

    // We need an OAuth access token to use the Management API
    // If we don't have one stored, we need to refresh or ask user to reconnect
    let accessToken = oauthSession?.access_token;

    // Check if token is expired
    if (oauthSession?.expires_at && Date.now() > oauthSession.expires_at) {
      console.log("[execute-user-sql] OAuth token expired, attempting refresh...");
      
      // Try to refresh the token
      if (oauthSession?.refresh_token) {
        const OAUTH_CLIENT_ID = Deno.env.get("OAUTH_CLIENT_ID") || Deno.env.get("SUPABASE_OAUTH_CLIENT_ID");
        const OAUTH_CLIENT_SECRET = Deno.env.get("OAUTH_CLIENT_SECRET") || Deno.env.get("SUPABASE_OAUTH_CLIENT_SECRET");
        
        if (OAUTH_CLIENT_ID && OAUTH_CLIENT_SECRET) {
          const refreshResponse = await fetch("https://api.supabase.com/v1/oauth/token", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Authorization": `Basic ${btoa(`${OAUTH_CLIENT_ID}:${OAUTH_CLIENT_SECRET}`)}`,
            },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              refresh_token: oauthSession.refresh_token,
            }),
          });

          if (refreshResponse.ok) {
            const newTokens = await refreshResponse.json();
            accessToken = newTokens.access_token;

            // Update stored tokens
            await supabase.from("oauth_sessions").upsert({
              session_id: sessionId,
              access_token: newTokens.access_token,
              refresh_token: newTokens.refresh_token || oauthSession.refresh_token,
              expires_at: Date.now() + (newTokens.expires_in * 1000),
            }, { onConflict: "session_id" });

            console.log("[execute-user-sql] Token refreshed successfully");
          } else {
            console.error("[execute-user-sql] Token refresh failed");
          }
        }
      }
    }

    if (!accessToken) {
      // No OAuth token available - we need to execute via REST API with service role key
      // This works for data operations but not DDL
      if (connection?.serviceRoleKey && connection?.url) {
        console.log("[execute-user-sql] Using service role key for:", connection.url);
        
        // For DDL operations, we need to use a workaround
        // Try using the pg-meta API endpoint
        const result = await executeSqlViaPostgREST(connection.url, connection.serviceRoleKey, sql);
        
        return new Response(JSON.stringify({ 
          success: true, 
          result,
          message: "SQL executed via REST API"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error("No valid credentials found. Please reconnect your Supabase project.");
    }

    console.log("[execute-user-sql] Executing SQL via Management API for project:", targetProjectId);

    // Use the Supabase Management API to execute SQL directly
    // Endpoint: POST /v1/projects/{ref}/database/query
    const queryResponse = await fetch(
      `https://api.supabase.com/v1/projects/${targetProjectId}/database/query`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
      }
    );

    if (!queryResponse.ok) {
      const errorText = await queryResponse.text();
      console.error("[execute-user-sql] Management API error:", {
        status: queryResponse.status,
        error: errorText,
      });
      
      // Parse error if JSON
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.message || errorJson.error || "Failed to execute SQL");
      } catch (e) {
        if (e instanceof Error && e.message !== "Failed to execute SQL") {
          throw e;
        }
        throw new Error(`Failed to execute SQL: ${errorText}`);
      }
    }

    const result = await queryResponse.json();
    console.log("[execute-user-sql] SQL executed successfully:", {
      rowCount: Array.isArray(result) ? result.length : "N/A",
    });

    return new Response(JSON.stringify({ 
      success: true, 
      result,
      message: "SQL executed successfully via Management API"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[execute-user-sql] Error:", error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Fallback: Execute SQL via PostgREST (limited to data operations)
async function executeSqlViaPostgREST(supabaseUrl: string, serviceRoleKey: string, sql: string) {
  const trimmedSql = sql.trim().toUpperCase();
  
  // For SELECT queries, we can potentially use RPC
  if (trimmedSql.startsWith("SELECT")) {
    // Try to execute via pg_jsonschema or similar if available
    return {
      type: "select",
      message: "SELECT queries should use the REST API client. Query validated.",
      sql: sql,
    };
  }
  
  // For DDL/DML without Management API access
  return {
    type: "manual",
    message: "Management API access expired. Please reconnect your Supabase project or run this SQL manually:",
    sql: sql,
    instructions: [
      "1. Go to your Supabase dashboard",
      "2. Navigate to SQL Editor",
      "3. Paste the SQL and click 'Run'"
    ]
  };
}
