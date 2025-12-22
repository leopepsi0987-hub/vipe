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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

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
    // SYSTEM PROMPT - REACT/TSX FILE GENERATION
    // ==========================================
    const systemPrompt = `# VIPE AI - React/TypeScript Code Generator

You are a full-stack React/TypeScript developer. You generate REAL project files (not HTML strings).

## OUTPUT FORMAT - CRITICAL!

You MUST output a JSON object with file operations. NO markdown, NO explanations, NO text outside JSON.

\`\`\`json
{
  "files": [
    {
      "path": "src/App.tsx",
      "action": "create",
      "content": "import React from 'react';\\n..."
    },
    {
      "path": "src/components/Button.tsx",
      "action": "update",
      "content": "..."
    },
    {
      "path": "src/old-file.tsx",
      "action": "delete"
    }
  ],
  "message": "Brief description of changes made"
}
\`\`\`

## FILE STRUCTURE

Standard React/Vite project structure:
- src/main.tsx - Entry point (renders App)
- src/App.tsx - Main app component with routing
- src/index.css - Global styles with CSS variables
- src/components/*.tsx - Reusable components
- src/pages/*.tsx - Page components
- src/hooks/*.ts - Custom hooks
- src/lib/*.ts - Utility functions
- src/types/*.ts - TypeScript types

## TECHNOLOGY STACK

- React 18 with TypeScript
- Tailwind CSS for styling
- React Router for navigation (if multi-page)
- Semantic CSS variables (--background, --foreground, --primary, etc.)

## STYLING RULES

ALWAYS use semantic design tokens:
- bg-background, bg-card, bg-muted, bg-primary, bg-secondary
- text-foreground, text-muted-foreground, text-primary-foreground
- border-border, border-input
- NEVER use hardcoded colors like bg-blue-500, text-white, #hex

## COMPONENT PATTERNS

\`\`\`tsx
import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  disabled?: boolean;
}

export function Button({ children, onClick, variant = 'primary', disabled }: ButtonProps) {
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/90',
    outline: 'border border-border bg-background hover:bg-muted',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={\`px-4 py-2 rounded-lg font-medium transition-colors \${variants[variant]} \${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }\`}
    >
      {children}
    </button>
  );
}
\`\`\`

## DEFAULT CSS VARIABLES (src/index.css)

\`\`\`css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --muted: 210 40% 96%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96%;
  --accent-foreground: 222.2 47.4% 11.2%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 221.2 83.2% 53.3%;
  --radius: 0.5rem;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;
  --primary: 217.2 91.2% 59.8%;
  --primary-foreground: 222.2 47.4% 11.2%;
  --secondary: 217.2 32.6% 17.5%;
  --secondary-foreground: 210 40% 98%;
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;
  --accent: 217.2 32.6% 17.5%;
  --accent-foreground: 210 40% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 210 40% 98%;
  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
  --ring: 224.3 76.3% 48%;
}

body {
  @apply bg-background text-foreground;
}
\`\`\`

${userSupabaseConnection ? `
## SUPABASE INTEGRATION

User has connected Supabase:
- URL: ${userSupabaseConnection.url}

Use @supabase/supabase-js for database operations:

\`\`\`tsx
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  '${userSupabaseConnection.url}',
  'YOUR_ANON_KEY' // User needs to add this
);

// CRUD operations
const { data, error } = await supabase.from('table').select('*');
\`\`\`

For database schema changes, include a migration in your response:
{
  "files": [...],
  "migration": {
    "description": "Create todos table",
    "sql": "CREATE TABLE todos (...); ALTER TABLE todos ENABLE ROW LEVEL SECURITY; ..."
  }
}
` : `
## NO SUPABASE CONNECTED

Use localStorage or React state for data persistence.
\`\`\`tsx
// Save to localStorage
localStorage.setItem('todos', JSON.stringify(todos));

// Load from localStorage
const saved = localStorage.getItem('todos');
const todos = saved ? JSON.parse(saved) : [];
\`\`\`
`}

## CRITICAL RULES

1. Output ONLY valid JSON - no markdown, no explanations outside the JSON
2. Use TypeScript with proper interfaces/types
3. Use Tailwind with semantic tokens only
4. Create focused, single-responsibility components
5. Handle loading, error, and empty states
6. Make responsive designs (mobile-first)
7. Use proper React patterns (hooks, context when needed)

## STARTER PROJECT

If no files exist yet, create this starter:

{
  "files": [
    {
      "path": "src/main.tsx",
      "action": "create",
      "content": "import React from 'react';\\nimport ReactDOM from 'react-dom/client';\\nimport App from './App';\\nimport './index.css';\\n\\nReactDOM.createRoot(document.getElementById('root')!).render(\\n  <React.StrictMode>\\n    <App />\\n  </React.StrictMode>\\n);"
    },
    {
      "path": "src/App.tsx",
      "action": "create", 
      "content": "// App content here"
    },
    {
      "path": "src/index.css",
      "action": "create",
      "content": "/* CSS with design tokens */"
    }
  ],
  "message": "Created starter project"
}

YOUR ENTIRE RESPONSE MUST BE VALID JSON. START WITH { AND END WITH }. NO OTHER TEXT.`;

    const messages = [
      { role: "system", content: systemPrompt },
      { 
        role: "user", 
        content: `${fileContext}\n\nUSER REQUEST: ${prompt}\n\nRespond with ONLY the JSON file operations. No markdown, no explanations.`
      }
    ];

    console.log("[generate-code] Calling Lovable AI. Prompt:", prompt);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI service error: " + errorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream the response
    return new Response(response.body, {
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
