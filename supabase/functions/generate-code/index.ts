import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  foodDeliveryTemplate, 
  socialMediaTemplate, 
  ecommerceTemplate, 
  todoTemplate, 
  chatTemplate,
  fitnessTemplate,
  blogTemplate,
  bookingTemplate,
  dashboardTemplate,
  portfolioTemplate,
  type AppTemplate 
} from "./templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// All available templates
const APP_TEMPLATES: AppTemplate[] = [
  foodDeliveryTemplate,
  socialMediaTemplate,
  ecommerceTemplate,
  todoTemplate,
  chatTemplate,
  fitnessTemplate,
  blogTemplate,
  bookingTemplate,
  dashboardTemplate,
  portfolioTemplate,
];

// Find matching template based on user prompt
function findMatchingTemplate(prompt: string): AppTemplate | null {
  const lowerPrompt = prompt.toLowerCase();
  
  for (const template of APP_TEMPLATES) {
    const matchScore = template.keywords.filter(kw => lowerPrompt.includes(kw)).length;
    if (matchScore >= 1) {
      console.log(`[generate-code] Matched template: ${template.name} (score: ${matchScore})`);
      return template;
    }
  }
  
  return null;
}

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

    // Check for matching template FIRST
    const matchedTemplate = findMatchingTemplate(prompt);
    
    // If we have a perfect template match, return it immediately without AI
    if (matchedTemplate) {
      console.log(`[generate-code] Using pre-built template: ${matchedTemplate.name}`);
      
      const result = {
        files: matchedTemplate.files,
        message: `Created ${matchedTemplate.name} with ${matchedTemplate.files.length} files - ${matchedTemplate.features.slice(0, 3).join(", ")} and more!`,
        template: matchedTemplate.name,
        dbSchema: matchedTemplate.dbSchema || null,
      };
      
      // Return in SSE format for consistency
      const openAIFormat = {
        choices: [{ delta: { content: JSON.stringify(result) } }],
      };
      
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(openAIFormat)}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });
      
      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
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

      const beta = await listOnce("v1beta");
      const v1 = beta.length ? [] : await listOnce("v1");
      const available = beta.length ? beta : v1;
      const apiVersion: "v1beta" | "v1" = beta.length ? "v1beta" : "v1";

      const preferred = [
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-1.5-pro",
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b",
      ];

      const ordered = [...preferred.filter((m) => available.includes(m)), ...available.filter((m) => !preferred.includes(m))];
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
    // ENHANCED SYSTEM PROMPT FOR CLEANER OUTPUT
    // ==========================================
    const systemPrompt = `You are an expert React/TypeScript developer who creates CLEAN, WELL-ORGANIZED, PRODUCTION-READY code.

## 🎯 ARCHITECTURE REQUIREMENTS (MUST FOLLOW):

### File Organization - NEVER put everything in one file:
1. **src/types/*.ts** - TypeScript interfaces and types (one file per domain)
2. **src/lib/utils.ts** - Utility functions (cn helper, formatters, validators)
3. **src/hooks/use*.ts** - Custom React hooks (one hook per file)
4. **src/components/*.tsx** - UI components (ONE component per file, 30-100 lines each)
5. **src/pages/*.tsx** - Page components that compose other components
6. **src/App.tsx** - ONLY routing/layout, no business logic

### Component Guidelines:
- Each component should do ONE thing well
- Components should be 30-100 lines (extract if longer)
- Use props interfaces defined in types files
- Separate presentation from logic (use hooks)

### Code Quality:
- Use meaningful variable/function names
- Add JSDoc comments for complex functions
- Extract magic numbers to constants
- Use early returns for cleaner control flow

## 📁 MINIMUM FILE STRUCTURE FOR ANY APP:

\`\`\`
src/
├── types/
│   └── index.ts           // All TypeScript interfaces
├── lib/
│   └── utils.ts           // cn() and utility functions
├── hooks/
│   └── use[Feature].ts    // Custom hooks for state/data
├── components/
│   ├── layout/
│   │   ├── Header.tsx     // App header/navbar
│   │   └── Footer.tsx     // App footer (if needed)
│   └── [feature]/
│       ├── [Component1].tsx
│       ├── [Component2].tsx
│       └── [Component3].tsx
├── pages/
│   └── Index.tsx          // Main page
└── App.tsx                // Just routing
\`\`\`

## 🎨 STYLING RULES:

### Use Tailwind Semantic Tokens (NEVER hardcoded colors):
- bg-background, bg-card, bg-muted, bg-primary, bg-secondary, bg-accent
- text-foreground, text-muted-foreground, text-primary-foreground
- border-border, border-input
- ring-ring

### Layout Best Practices:
- Use consistent spacing (p-4, gap-4, etc.)
- Responsive design: sm:, md:, lg: breakpoints
- Use grid for layouts, flex for alignment
- Add hover/focus states for interactive elements

## 📦 IMPORTS:

### ALWAYS use @/ alias:
\`\`\`typescript
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { User } from "@/types";
import { useAuth } from "@/hooks/useAuth";
\`\`\`

### NEVER use relative imports for deep nesting:
\`\`\`typescript
// ❌ BAD
import { Button } from "../../../components/ui/button";

// ✅ GOOD  
import { Button } from "@/components/ui/button";
\`\`\`

### ALWAYS import React hooks explicitly:
\`\`\`typescript
import { useState, useEffect, useMemo, useCallback } from "react";
\`\`\`

## 🧩 AVAILABLE UI COMPONENTS (from @/components/ui/):

button, card (Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter),
input, textarea, checkbox, label, badge, dialog, tabs, select, 
switch, progress, skeleton, scroll-area, separator, avatar,
dropdown-menu, tooltip, table, accordion, alert, sheet, popover

## 📊 DEMO DATA GUIDELINES:

When creating demo/sample data:
- Use realistic, diverse data (3-6 items minimum)
- Use placeholder images: "/placeholder.svg"
- Include proper TypeScript typing
- Place data constants near the top of the file
- Comment that it's demo data to be replaced

## 🔧 UTILITY FUNCTION (always include in src/lib/utils.ts):

\`\`\`typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Add other utilities as needed:
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}
\`\`\`

${userSupabaseConnection ? `
## 🗄️ DATABASE CONNECTION:
User has Supabase connected at ${userSupabaseConnection.url}
Use @supabase/supabase-js for data operations.
` : `
## 💾 DATA PERSISTENCE:
No database connected. Use localStorage or React state for data persistence.
Create mock data that looks realistic.
`}

${fileContext}

## 📝 OUTPUT FORMAT:

Return ONLY valid JSON with this structure:
\`\`\`json
{
  "files": [
    {
      "path": "src/types/index.ts",
      "action": "create",
      "content": "// TypeScript content here"
    }
  ],
  "message": "Brief description of what was created"
}
\`\`\`

CRITICAL:
- Output ONLY JSON, no markdown, no explanations before or after
- Start with { and end with }
- Escape newlines in content as \\n
- Create AT LEAST 6 files with proper separation of concerns
- Each component file should have 30-100+ lines of real code`;

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
                  text: `BUILD REQUEST: ${prompt}

Create a complete, production-ready implementation following the architecture guidelines.
Respond with ONLY JSON. No markdown. No explanations. Start with { end with }.`,
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

      if (r.status === 404 || r.status === 400) continue;

      if (r.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI service error: " + lastErrorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!response) {
      return new Response(
        JSON.stringify({
          error: "AI service error: No available Gemini model. Last error: " + lastErrorText,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Post-process: auto-inject missing React hook imports
    const REACT_HOOKS = [
      "useState", "useEffect", "useMemo", "useCallback", "useRef",
      "useReducer", "useContext", "useLayoutEffect", "useId",
      "useImperativeHandle", "useDebugValue", "useDeferredValue",
      "useTransition", "useSyncExternalStore", "useInsertionEffect",
    ];

    function ensureReactHookImports(code: string): string {
      const usedHooks = REACT_HOOKS.filter((hook) => {
        const usageRegex = new RegExp(`\\b${hook}\\s*\\(`, "g");
        return usageRegex.test(code);
      });

      if (usedHooks.length === 0) return code;

      const existingReactImportMatch = code.match(
        /^import\s+(?:React\s*,?\s*)?(\{[^}]*\})?\s*from\s+['"]react['"];?\s*$/m
      );

      if (existingReactImportMatch) {
        const namedImportsMatch = existingReactImportMatch[1];
        const existingNamed = namedImportsMatch
          ? namedImportsMatch
              .replace(/[{}]/g, "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

        const missingHooks = usedHooks.filter((h) => !existingNamed.includes(h));
        if (missingHooks.length === 0) return code;

        const allNamed = [...existingNamed, ...missingHooks];
        const hasDefaultReact = /^import\s+React/.test(existingReactImportMatch[0]);
        const newImport = hasDefaultReact
          ? `import React, { ${allNamed.join(", ")} } from "react";`
          : `import { ${allNamed.join(", ")} } from "react";`;

        return code.replace(existingReactImportMatch[0], newImport);
      }

      const importLine = `import { ${usedHooks.join(", ")} } from "react";\n`;
      return importLine + code;
    }

    // Transform Gemini SSE format and post-process the final JSON
    let accumulatedJson = "";

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                const content = data.candidates[0].content.parts[0].text;
                accumulatedJson += content;
              }
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      },
      flush(controller) {
        try {
          let cleanJson = accumulatedJson.trim();
          if (cleanJson.startsWith("```json")) {
            cleanJson = cleanJson.slice(7);
          } else if (cleanJson.startsWith("```")) {
            cleanJson = cleanJson.slice(3);
          }
          if (cleanJson.endsWith("```")) {
            cleanJson = cleanJson.slice(0, -3);
          }
          cleanJson = cleanJson.trim();

          const parsed = JSON.parse(cleanJson);

          if (parsed.files && Array.isArray(parsed.files)) {
            for (const file of parsed.files) {
              if (
                file.content &&
                typeof file.content === "string" &&
                (file.path?.endsWith(".tsx") || file.path?.endsWith(".jsx") || file.path?.endsWith(".ts") || file.path?.endsWith(".js"))
              ) {
                file.content = ensureReactHookImports(file.content);
              }
            }
          }

          const fixedJson = JSON.stringify(parsed);
          const openAIFormat = {
            choices: [{ delta: { content: fixedJson } }],
          };
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(openAIFormat)}\n\n`));
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        } catch (e) {
          console.error("[generate-code] Failed to parse/fix JSON:", e);
          const openAIFormat = {
            choices: [{ delta: { content: accumulatedJson } }],
          };
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(openAIFormat)}\n\n`));
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        }
      },
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
