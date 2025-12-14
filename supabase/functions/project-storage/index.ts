import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-project-id",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const projectId = req.headers.get("x-project-id");
    if (!projectId) {
      return new Response(
        JSON.stringify({ error: "Missing project ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const key = url.searchParams.get("key");

    if (req.method === "GET") {
      // Get data
      if (key) {
        const { data, error } = await supabase
          .from("project_data")
          .select("value")
          .eq("project_id", projectId)
          .eq("key", key)
          .maybeSingle();

        if (error) throw error;
        
        return new Response(
          JSON.stringify({ data: data?.value || null }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Get all data for project
        const { data, error } = await supabase
          .from("project_data")
          .select("key, value")
          .eq("project_id", projectId);

        if (error) throw error;
        
        const result: Record<string, unknown> = {};
        for (const item of data || []) {
          result[item.key] = item.value;
        }
        
        return new Response(
          JSON.stringify({ data: result }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (req.method === "POST" || req.method === "PUT") {
      // Set data
      const body = await req.json();
      const { key: bodyKey, value } = body;
      
      if (!bodyKey) {
        return new Response(
          JSON.stringify({ error: "Missing key" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from("project_data")
        .upsert(
          { project_id: projectId, key: bodyKey, value: value || {} },
          { onConflict: "project_id,key" }
        );

      if (error) throw error;
      
      console.log(`Stored data for project ${projectId}, key: ${bodyKey}`);
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "DELETE") {
      if (!key) {
        return new Response(
          JSON.stringify({ error: "Missing key" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from("project_data")
        .delete()
        .eq("project_id", projectId)
        .eq("key", key);

      if (error) throw error;
      
      console.log(`Deleted data for project ${projectId}, key: ${key}`);
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in project-storage function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
