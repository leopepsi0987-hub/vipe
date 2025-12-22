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
    const { prompt, projectId, currentFiles } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!GEMINI_API_KEY) {
      throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
    }

    const getGeminiModelCandidates = async (): Promise<Array<{ apiVersion: "v1beta" | "v1"; model: string }>> => {
      const parseModels = (json: any): string[] => {
        const models: Array<{ name?: string; supportedGenerationMethods?: string[] }> = json?.models ?? [];
        const supportsStream = (m: { name?: string; supportedGenerationMethods?: string[] }) =>
          (m.supportedGenerationMethods ?? []).includes("streamGenerateContent") ||
          (m.supportedGenerationMethods ?? []).includes("generateContent");

        return models
          .filter((m) => m?.name?.startsWith("models/") && supportsStream(m))
          .map((m) => (m.name as string).replace(/^models\//, ""));
      };

      const listOnce = async (apiVersion: "v1beta" | "v1") => {
        const url = `https://generativelanguage.googleapis.com/${apiVersion}/models`;
        const resp = await fetch(url, {
          method: "GET",
          headers: {
            "x-goog-api-key": GEMINI_API_KEY,
          },
        });
        if (!resp.ok) {
          const t = await resp.text();
          console.warn(`[generate-code] models.list failed (${apiVersion}):`, resp.status, t);
          return [] as string[];
        }
        const json = await resp.json();
        return parseModels(json);
      };

      // Try v1beta first, then v1.
      const beta = await listOnce("v1beta");
      const v1 = beta.length ? [] : await listOnce("v1");

      const available = beta.length ? beta : v1;
      const apiVersion: "v1beta" | "v1" = beta.length ? "v1beta" : "v1";

      const preferred = [
        // Prefer current Gemini 2.5 line first (most keys support these in v1beta).
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-2.5-flash-lite",
        // Older fallbacks (some keys/regions still expose these)
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-1.5-pro",
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b",
      ];

      const ordered = [...preferred.filter((m) => available.includes(m)), ...available.filter((m) => !preferred.includes(m))];

      // If listing fails entirely, fall back to common names (we'll still retry on 404).
      const fallback = preferred;
      const modelsToTry = ordered.length ? ordered : fallback;

      return modelsToTry.map((model) => ({ apiVersion, model }));
    };

    // Fetch user's connected Supabase if projectId provided
    let userSupabaseConnection: { url: string; anonKey: string } | null = null;
    
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
          userSupabaseConnection = { url: conn.url, anonKey: conn.anonKey || "" };
          console.log("[generate-code] User has connected Supabase:", conn.url);
        }
      }
    }

    // Build file context string
    let fileContext = "";
    if (currentFiles && Object.keys(currentFiles).length > 0) {
      fileContext = "\n\n## CURRENT PROJECT FILES:\n";
      for (const [path, content] of Object.entries(currentFiles)) {
        fileContext += `\n### ${path}\n\`\`\`\n${content}\n\`\`\`\n`;
      }
    }

    // ==========================================
    // SYSTEM PROMPT - STRICT JSON OUTPUT ONLY
    // ==========================================
    const systemPrompt = `You are a React/TypeScript code generator for a Vite + React + Tailwind project. You output ONLY valid JSON, nothing else.

OUTPUT FORMAT (strict JSON, no markdown, no explanations):
{
  "files": [
    {"path": "src/App.tsx", "action": "create", "content": "...full file content..."},
    {"path": "src/components/TodoList.tsx", "action": "create", "content": "..."},
    {"path": "src/hooks/useTodos.ts", "action": "create", "content": "..."},
    {"path": "src/lib/utils.ts", "action": "create", "content": "..."},
    {"path": "src/types/index.ts", "action": "create", "content": "..."}
  ],
  "message": "Brief description"
}

## PROJECT STRUCTURE RULES:
You MUST organize code into proper folders like a real React project:

1. **src/App.tsx** - Main app component (entry point)
2. **src/main.tsx** - React DOM render (create if missing)
3. **src/index.css** - Global styles with Tailwind directives
4. **src/App.css** - App-specific styles (optional)

5. **src/components/** - Reusable UI components
   - src/components/ui/ - Base UI primitives (Button, Card, Input, etc.)
   - src/components/[FeatureName].tsx - Feature-specific components

6. **src/hooks/** - Custom React hooks
   - src/hooks/use[Name].ts - e.g., useTodos.ts, useAuth.ts, useLocalStorage.ts

7. **src/lib/** - Utility functions and helpers
   - src/lib/utils.ts - General utilities
   - src/lib/constants.ts - App constants

8. **src/types/** - TypeScript type definitions
   - src/types/index.ts - Shared types/interfaces

9. **src/pages/** - Page components (if multi-page)
   - src/pages/Home.tsx, src/pages/About.tsx, etc.

10. **src/context/** - React context providers (if needed)

## IMPORT RULES (CRITICAL):
- Use "@/" alias for imports: import { Button } from "@/components/ui/button"
- NEVER use relative imports like "./components/Button"
- For UI components, use existing shadcn components from @/components/ui/:
  - @/components/ui/button (Button)
  - @/components/ui/card (Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter)
  - @/components/ui/input (Input)
  - @/components/ui/checkbox (Checkbox)
  - @/components/ui/label (Label)
  - @/components/ui/badge (Badge)
  - @/components/ui/dialog (Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger)
  - @/components/ui/tabs (Tabs, TabsContent, TabsList, TabsTrigger)
  - @/components/ui/select (Select, SelectContent, SelectItem, SelectTrigger, SelectValue)
  - @/components/ui/textarea (Textarea)
  - @/components/ui/switch (Switch)
  - @/components/ui/progress (Progress)
  - @/components/ui/skeleton (Skeleton)
  - @/components/ui/scroll-area (ScrollArea)
  - @/components/ui/separator (Separator)
  - @/components/ui/avatar (Avatar, AvatarFallback, AvatarImage)
  - @/components/ui/dropdown-menu (DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger)
  - @/components/ui/tooltip (Tooltip, TooltipContent, TooltipProvider, TooltipTrigger)
  - @/components/ui/table (Table, TableBody, TableCell, TableHead, TableHeader, TableRow)
  - @/components/ui/accordion (Accordion, AccordionContent, AccordionItem, AccordionTrigger)

## STYLING RULES:
- Use React 18 + TypeScript + Tailwind CSS
- Use semantic Tailwind classes ONLY: bg-background, text-foreground, bg-primary, text-primary-foreground, bg-secondary, text-secondary-foreground, bg-muted, text-muted-foreground, bg-card, text-card-foreground, bg-accent, text-accent-foreground, bg-destructive, text-destructive-foreground, border-border, ring-ring
- NEVER use hardcoded colors like bg-blue-500, text-white, bg-gray-100
- Create complete, working components with proper TypeScript types

## EXAMPLE OUTPUT FOR A TODO APP:
{
  "files": [
    {"path": "src/types/index.ts", "action": "create", "content": "export interface Todo {\\n  id: string;\\n  text: string;\\n  completed: boolean;\\n  createdAt: number;\\n}"},
    {"path": "src/hooks/useTodos.ts", "action": "create", "content": "import { useState, useEffect } from 'react';\\nimport type { Todo } from '@/types';\\n\\nexport function useTodos() {\\n  const [todos, setTodos] = useState<Todo[]>([]);\\n  // ... rest of hook\\n}"},
    {"path": "src/components/TodoItem.tsx", "action": "create", "content": "import { Checkbox } from '@/components/ui/checkbox';\\nimport { Button } from '@/components/ui/button';\\nimport type { Todo } from '@/types';\\n// ..."},
    {"path": "src/components/TodoList.tsx", "action": "create", "content": "import { TodoItem } from '@/components/TodoItem';\\nimport type { Todo } from '@/types';\\n// ..."},
    {"path": "src/components/TodoInput.tsx", "action": "create", "content": "import { Input } from '@/components/ui/input';\\nimport { Button } from '@/components/ui/button';\\n// ..."},
    {"path": "src/App.tsx", "action": "create", "content": "import { useTodos } from '@/hooks/useTodos';\\nimport { TodoList } from '@/components/TodoList';\\nimport { TodoInput } from '@/components/TodoInput';\\nimport { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';\\n// ..."}
  ],
  "message": "Created a todo app with hooks, components, and types"
}

${userSupabaseConnection ? `User has Supabase connected at ${userSupabaseConnection.url}. Use @supabase/supabase-js for data. Import client from @/integrations/supabase/client.` : "No database connected. Use localStorage for persistence."}

${fileContext}

START YOUR RESPONSE WITH { AND END WITH }. OUTPUT ONLY JSON.`;

    const candidates = await getGeminiModelCandidates();

    let response: Response | null = null;
    let lastErrorText = "";

    for (const c of candidates) {
      const url = `https://generativelanguage.googleapis.com/${c.apiVersion}/models/${c.model}:streamGenerateContent?alt=sse`;
      console.log(`[generate-code] Trying Gemini model: ${c.model} (${c.apiVersion})`);

      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    "BUILD REQUEST: " +
                    prompt +
                    "\n\nRespond with ONLY JSON. No markdown. No explanations. Start with { end with }." ,
                },
              ],
            },
          ],
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 65536,
            responseMimeType: "application/json",
          },
        }),
      });

      if (r.ok) {
        response = r;
        break;
      }

      lastErrorText = await r.text().catch(() => "");
      console.warn(`[generate-code] Model ${c.model} failed:`, r.status, lastErrorText);

      // Try next model on 404/400 model-not-supported.
      if (r.status === 404 || r.status === 400) continue;

      // Surface rate limits immediately.
      if (r.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Other errors: stop early.
      return new Response(JSON.stringify({ error: "AI service error: " + lastErrorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!response) {
      return new Response(
        JSON.stringify({
          error:
            "AI service error: No available Gemini model supports streamGenerateContent for this API key. Last error: " +
            lastErrorText,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI service error: " + errorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Transform Gemini SSE format to OpenAI-compatible format for the frontend
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        const lines = text.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                const content = data.candidates[0].content.parts[0].text;
                const openAIFormat = {
                  choices: [{ delta: { content } }]
                };
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(openAIFormat)}\n\n`));
              }
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      }
    });

    return new Response(response.body?.pipeThrough(transformStream), {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Error in generate-code function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
