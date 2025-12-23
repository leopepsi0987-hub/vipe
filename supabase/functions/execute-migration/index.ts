import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MigrationRequest {
  projectId: string;
  sql: string;
  description?: string;
}

interface SchemaRequest {
  projectId: string;
  tableName?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get user's connected Supabase credentials
    async function getUserSupabaseConnection(projectId: string) {
      const { data } = await supabase
        .from("project_data")
        .select("value")
        .eq("project_id", projectId)
        .eq("key", "supabase_connection")
        .maybeSingle();

      if (!data?.value) {
        return null;
      }

      const conn = data.value as { 
        url: string; 
        serviceRoleKey: string; 
        anonKey?: string;
        accessToken?: string;
        connected: boolean 
      };
      
      if (!conn.connected || !conn.url) {
        return null;
      }

      return conn;
    }

  // Execute SQL migration using the Supabase Management API
  async function executeMigration(
    connection: { url: string; serviceRoleKey: string; accessToken?: string },
    sql: string
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    try {
      // Extract project ref from URL
      const projectRef = connection.url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
      
      if (!projectRef) {
        return { success: false, error: "Invalid Supabase URL format" };
      }

      console.log(`[executeMigration] Project: ${projectRef}, SQL length: ${sql.length}`);
      console.log(`[executeMigration] SQL preview: ${sql.substring(0, 500)}...`);

      // Method 1: Use OAuth access token with Management API (preferred)
      if (connection.accessToken) {
        console.log("[executeMigration] Trying Management API with OAuth token...");
        
        const response = await fetch(
          `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${connection.accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: sql }),
          }
        );

        if (response.ok) {
          const result = await response.json();
          console.log("[executeMigration] ✅ Success via Management API");
          return { success: true, data: result };
        }
        
        const errorText = await response.text();
        console.error("[executeMigration] Management API error:", response.status, errorText);
        
        // If 401, token might be expired - but we'll try direct connection
        if (response.status !== 401) {
          // Parse error for better message
          try {
            const errorJson = JSON.parse(errorText);
            return { 
              success: false, 
              error: errorJson.message || errorJson.error || `Database error: ${errorText}` 
            };
          } catch {
            return { success: false, error: `Database error: ${errorText}` };
          }
        }
        
        console.log("[executeMigration] OAuth token failed, trying direct database connection...");
      }

      // Method 2: Try using pg-meta API endpoint (works with service role)
      console.log("[executeMigration] Trying pg-meta query endpoint...");
      
      const pgMetaResponse = await fetch(`${connection.url}/pg/query`, {
        method: "POST",
        headers: {
          "apikey": connection.serviceRoleKey,
          "Authorization": `Bearer ${connection.serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
      });

      if (pgMetaResponse.ok) {
        const result = await pgMetaResponse.json();
        console.log("[executeMigration] ✅ Success via pg-meta API");
        return { success: true, data: result };
      }

      // Method 3: Return SQL for dashboard execution with copy-ready format
      console.log("[executeMigration] Direct execution not available, returning SQL for dashboard");
      
      return {
        success: true,
        data: {
          requiresManualExecution: true,
          sql,
          message: "⚠️ Run this SQL in your Supabase SQL Editor:",
          dashboardUrl: `https://supabase.com/dashboard/project/${projectRef}/sql/new`,
          projectRef,
        },
      };
    } catch (error) {
      console.error("[executeMigration] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

    // Get table schema from user's Supabase
    async function getTableSchema(
      connection: { url: string; serviceRoleKey: string },
      tableName?: string
    ): Promise<{ success: boolean; error?: string; data?: any }> {
      try {
        const userSupabase = createClient(connection.url, connection.serviceRoleKey);

        // Query information_schema for table structure
        // This works because service_role has access to system tables
        const query = tableName
          ? `
              SELECT 
                c.table_name,
                c.column_name,
                c.data_type,
                c.is_nullable,
                c.column_default,
                c.character_maximum_length,
                tc.constraint_type
              FROM information_schema.columns c
              LEFT JOIN information_schema.key_column_usage kcu 
                ON c.table_name = kcu.table_name 
                AND c.column_name = kcu.column_name
                AND c.table_schema = kcu.table_schema
              LEFT JOIN information_schema.table_constraints tc 
                ON kcu.constraint_name = tc.constraint_name
                AND kcu.table_schema = tc.table_schema
              WHERE c.table_schema = 'public' 
                AND c.table_name = '${tableName}'
              ORDER BY c.ordinal_position
            `
          : `
              SELECT 
                table_name,
                column_name,
                data_type,
                is_nullable,
                column_default
              FROM information_schema.columns
              WHERE table_schema = 'public'
              ORDER BY table_name, ordinal_position
            `;

        // Use RPC to execute the query
        const { data, error } = await userSupabase.rpc('get_schema_info', {
          p_table_name: tableName || null
        });

        if (error) {
          // Fallback: just list tables
          console.log("[getTableSchema] RPC failed, trying direct table list");
          
          // Get list of tables by querying a known pattern
          return {
            success: true,
            data: {
              message: "Schema introspection requires setup. Tables can be queried directly.",
              hint: "Use supabase.from('table_name').select() to explore data",
            },
          };
        }

        return { success: true, data };
      } catch (error) {
        console.error("[getTableSchema] Error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    // Handle different actions
    switch (action) {
      case "run_sql_migration": {
        const { projectId, sql, description } = params as MigrationRequest;
        
        if (!projectId || !sql) {
          return new Response(
            JSON.stringify({ success: false, error: "Missing projectId or sql" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const connection = await getUserSupabaseConnection(projectId);
        
        if (!connection) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "No Supabase connection found. Please connect your Supabase project first." 
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log(`[execute-migration] Running migration for project ${projectId}`);
        console.log(`[execute-migration] Description: ${description}`);
        console.log(`[execute-migration] SQL preview: ${sql.substring(0, 200)}...`);

        const result = await executeMigration(connection, sql);

        // DO NOT store migrations as project_data - just log the result
        // Storing as project_data was confusing users (they see SQL in Data tab)
        if (result.success) {
          console.log(`[execute-migration] Migration successful for ${projectId}`);
        } else {
          console.error(`[execute-migration] Migration failed for ${projectId}:`, result.error);
        }

        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "read_table_schema": {
        const { projectId, tableName } = params as SchemaRequest;
        
        if (!projectId) {
          return new Response(
            JSON.stringify({ success: false, error: "Missing projectId" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const connection = await getUserSupabaseConnection(projectId);
        
        if (!connection) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "No Supabase connection found" 
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const result = await getTableSchema(connection, tableName);

        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "insert_row": {
        const { projectId, tableName, data: rowData } = params;
        
        if (!projectId || !tableName || !rowData) {
          return new Response(
            JSON.stringify({ success: false, error: "Missing required parameters" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const connection = await getUserSupabaseConnection(projectId);
        
        if (!connection) {
          return new Response(
            JSON.stringify({ success: false, error: "No Supabase connection found" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const userSupabase = createClient(connection.url, connection.serviceRoleKey);
        const { data, error } = await userSupabase.from(tableName).insert(rowData).select();

        if (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "query_data": {
        const { projectId, tableName, filters, limit } = params;
        
        if (!projectId || !tableName) {
          return new Response(
            JSON.stringify({ success: false, error: "Missing required parameters" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const connection = await getUserSupabaseConnection(projectId);
        
        if (!connection) {
          return new Response(
            JSON.stringify({ success: false, error: "No Supabase connection found" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const userSupabase = createClient(connection.url, connection.serviceRoleKey);
        let query = userSupabase.from(tableName).select("*");

        if (filters && typeof filters === "object") {
          Object.entries(filters).forEach(([key, value]) => {
            query = query.eq(key, value);
          });
        }

        if (limit) {
          query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "list_tables": {
        const { projectId } = params;
        
        if (!projectId) {
          return new Response(
            JSON.stringify({ success: false, error: "Missing projectId" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const connection = await getUserSupabaseConnection(projectId);
        
        if (!connection) {
          return new Response(
            JSON.stringify({ success: false, error: "No Supabase connection found" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Try to get tables using the anon key approach
        const userSupabase = createClient(connection.url, connection.serviceRoleKey);
        
        // This gets the OpenAPI spec which includes table names
        const response = await fetch(`${connection.url}/rest/v1/`, {
          headers: {
            "apikey": connection.serviceRoleKey,
          },
        });

        if (response.ok) {
          const spec = await response.json();
          const tables = Object.keys(spec.definitions || {}).filter(
            (t) => !t.startsWith("_") && t !== "rpc"
          );
          
          return new Response(
            JSON.stringify({ success: true, data: { tables } }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            data: { 
              tables: [], 
              message: "Could not retrieve table list. Tables exist but schema introspection is limited." 
            } 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
    }
  } catch (error) {
    console.error("[execute-migration] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
