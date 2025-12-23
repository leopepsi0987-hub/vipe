import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DB_AGENT_URL = "https://plain-and-simple-code.lovable.app/api/v1/generate-sql";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, projectId } = await req.json();
    
    const DB_AGENT_API_KEY = Deno.env.get("DB_AGENT_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!DB_AGENT_API_KEY) {
      throw new Error("DB_AGENT_API_KEY is not configured");
    }

    if (!prompt) {
      throw new Error("Prompt is required");
    }

    console.log("[db-agent] Received request with prompt:", prompt.substring(0, 100));

    // Get user's connected Supabase credentials if available
    let supabaseUrl = "";
    let supabaseAnonKey = "";

    if (projectId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data } = await supabase
        .from("project_data")
        .select("value")
        .eq("project_id", projectId)
        .eq("key", "supabase_connection")
        .maybeSingle();

      if (data?.value) {
        const conn = data.value as { url: string; anonKey?: string; connected: boolean };
        if (conn.connected && conn.url) {
          supabaseUrl = conn.url;
          supabaseAnonKey = conn.anonKey || "";
          console.log("[db-agent] User has connected Supabase:", conn.url);
        }
      }
    }

    // Call the DB Agent API
    console.log("[db-agent] Calling DB Agent API...");
    
    const response = await fetch(DB_AGENT_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DB_AGENT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        supabase_url: supabaseUrl,
        supabase_anon_key: supabaseAnonKey,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[db-agent] DB Agent API error:", response.status, errorText);
      throw new Error(`DB Agent API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("[db-agent] Received SQL response:", data.sql?.substring(0, 200));

    return new Response(JSON.stringify({
      sql: data.sql,
      tables_affected: data.tables_affected || [],
      success: true,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[db-agent] Error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
