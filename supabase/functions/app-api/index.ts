import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, projectSlug, key, value, collection, item, itemId } = await req.json();

    if (!projectSlug) {
      return new Response(
        JSON.stringify({ error: "Project slug is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get project by slug
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, is_published")
      .eq("slug", projectSlug)
      .eq("is_published", true)
      .maybeSingle();

    if (projectError || !project) {
      console.error("Project not found:", projectSlug, projectError);
      return new Response(
        JSON.stringify({ error: "Project not found or not published" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const projectId = project.id;

    // Handle different actions
    switch (action) {
      // ============ KEY-VALUE STORAGE ============
      case "get": {
        if (!key) {
          return new Response(
            JSON.stringify({ error: "Key is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data, error } = await supabase
          .from("project_data")
          .select("value")
          .eq("project_id", projectId)
          .eq("key", `app_${key}`)
          .maybeSingle();

        if (error) {
          console.error("Error getting data:", error);
          return new Response(
            JSON.stringify({ error: "Failed to get data" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ data: data?.value ?? null }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "set": {
        if (!key) {
          return new Response(
            JSON.stringify({ error: "Key is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Upsert the data
        const { data: existing } = await supabase
          .from("project_data")
          .select("id")
          .eq("project_id", projectId)
          .eq("key", `app_${key}`)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("project_data")
            .update({ value: value ?? null })
            .eq("id", existing.id);

          if (error) {
            console.error("Error updating data:", error);
            return new Response(
              JSON.stringify({ error: "Failed to update data" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
          const { error } = await supabase
            .from("project_data")
            .insert({
              project_id: projectId,
              key: `app_${key}`,
              value: value ?? null,
            });

          if (error) {
            console.error("Error inserting data:", error);
            return new Response(
              JSON.stringify({ error: "Failed to save data" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete": {
        if (!key) {
          return new Response(
            JSON.stringify({ error: "Key is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error } = await supabase
          .from("project_data")
          .delete()
          .eq("project_id", projectId)
          .eq("key", `app_${key}`);

        if (error) {
          console.error("Error deleting data:", error);
          return new Response(
            JSON.stringify({ error: "Failed to delete data" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============ COLLECTION STORAGE (CRUD) ============
      case "getCollection": {
        if (!collection) {
          return new Response(
            JSON.stringify({ error: "Collection name is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data, error } = await supabase
          .from("project_data")
          .select("value")
          .eq("project_id", projectId)
          .eq("key", `collection_${collection}`)
          .maybeSingle();

        if (error) {
          console.error("Error getting collection:", error);
          return new Response(
            JSON.stringify({ error: "Failed to get collection" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ data: data?.value ?? [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "addToCollection": {
        if (!collection || !item) {
          return new Response(
            JSON.stringify({ error: "Collection name and item are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get existing collection
        const { data: existing } = await supabase
          .from("project_data")
          .select("id, value")
          .eq("project_id", projectId)
          .eq("key", `collection_${collection}`)
          .maybeSingle();

        const items = (existing?.value as any[]) || [];
        const newItem = {
          ...item,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        items.push(newItem);

        if (existing) {
          await supabase
            .from("project_data")
            .update({ value: items })
            .eq("id", existing.id);
        } else {
          await supabase
            .from("project_data")
            .insert({
              project_id: projectId,
              key: `collection_${collection}`,
              value: items,
            });
        }

        return new Response(
          JSON.stringify({ data: newItem }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "updateInCollection": {
        if (!collection || !itemId || !item) {
          return new Response(
            JSON.stringify({ error: "Collection name, itemId, and item are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: existing } = await supabase
          .from("project_data")
          .select("id, value")
          .eq("project_id", projectId)
          .eq("key", `collection_${collection}`)
          .maybeSingle();

        if (!existing) {
          return new Response(
            JSON.stringify({ error: "Collection not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const items = (existing.value as any[]) || [];
        const index = items.findIndex((i: any) => i.id === itemId);
        
        if (index === -1) {
          return new Response(
            JSON.stringify({ error: "Item not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        items[index] = {
          ...items[index],
          ...item,
          updatedAt: new Date().toISOString(),
        };

        await supabase
          .from("project_data")
          .update({ value: items })
          .eq("id", existing.id);

        return new Response(
          JSON.stringify({ data: items[index] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "deleteFromCollection": {
        if (!collection || !itemId) {
          return new Response(
            JSON.stringify({ error: "Collection name and itemId are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: existing } = await supabase
          .from("project_data")
          .select("id, value")
          .eq("project_id", projectId)
          .eq("key", `collection_${collection}`)
          .maybeSingle();

        if (!existing) {
          return new Response(
            JSON.stringify({ error: "Collection not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const items = (existing.value as any[]) || [];
        const filtered = items.filter((i: any) => i.id !== itemId);

        await supabase
          .from("project_data")
          .update({ value: filtered })
          .eq("id", existing.id);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Error in app-api function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
