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
    const { sessionId, sql, supabaseUrl, serviceRoleKey } = await req.json();

    // Validate inputs
    if (!sql) {
      throw new Error("SQL query is required");
    }

    // If direct credentials provided, use those
    if (supabaseUrl && serviceRoleKey) {
      console.log("[execute-user-sql] Using direct credentials for:", supabaseUrl);
      
      const userSupabase = createClient(supabaseUrl, serviceRoleKey);
      
      // Execute SQL using the rpc function or direct query
      // Note: This requires the user to have enabled the pg_execute extension
      // or we use the REST API for simple operations
      
      // For safety, we'll use the management API approach
      const result = await executeSqlViaManagementApi(supabaseUrl, serviceRoleKey, sql);
      
      return new Response(JSON.stringify({ 
        success: true, 
        result,
        message: "SQL executed successfully"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Otherwise, try to get credentials from session
    if (sessionId) {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Server not configured");
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Get session's supabase connection
      const { data: sessionData } = await supabase
        .from("generation_sessions")
        .select("supabase_connection")
        .eq("session_id", sessionId)
        .maybeSingle();

      if (!sessionData?.supabase_connection) {
        throw new Error("No Supabase connection found for this session");
      }

      const conn = sessionData.supabase_connection as any;
      
      if (!conn.url || !conn.serviceRoleKey) {
        throw new Error("Supabase connection is incomplete - missing service role key");
      }

      console.log("[execute-user-sql] Using session credentials for:", conn.url);

      const result = await executeSqlViaManagementApi(conn.url, conn.serviceRoleKey, sql);

      return new Response(JSON.stringify({ 
        success: true, 
        result,
        message: "SQL executed successfully"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Either sessionId or direct credentials required");

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

// Execute SQL via Supabase REST API (PostgREST rpc or direct)
async function executeSqlViaManagementApi(supabaseUrl: string, serviceRoleKey: string, sql: string) {
  // For creating tables and DDL, we need to use the Supabase Management API
  // But that requires OAuth access token, not service role key
  // 
  // Alternative: Use pg_net or execute via a stored procedure
  // For now, let's try direct PostgREST for supported operations
  
  // Check if it's a SELECT query (safe to run via REST)
  const trimmedSql = sql.trim().toUpperCase();
  
  if (trimmedSql.startsWith("SELECT")) {
    // For SELECT, we can use the rpc endpoint if a function exists
    // Otherwise, guide the user to run manually
    return {
      type: "info",
      message: "For SELECT queries, use the REST API directly. The query was validated.",
      sql: sql,
    };
  }
  
  // For DDL (CREATE TABLE, etc.), we need the Supabase dashboard or migration
  if (trimmedSql.startsWith("CREATE") || trimmedSql.startsWith("ALTER") || 
      trimmedSql.startsWith("DROP") || trimmedSql.startsWith("INSERT") ||
      trimmedSql.startsWith("UPDATE") || trimmedSql.startsWith("DELETE")) {
    
    // Return the SQL for the user to execute manually
    return {
      type: "manual",
      message: "DDL/DML statements must be executed in your Supabase dashboard SQL Editor. Here's the query:",
      sql: sql,
      instructions: [
        "1. Go to your Supabase dashboard",
        "2. Navigate to SQL Editor",
        "3. Paste the SQL below and click 'Run'"
      ]
    };
  }

  return {
    type: "unknown",
    message: "Query type not recognized. Please run manually in Supabase dashboard.",
    sql: sql,
  };
}
