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
    const systemPrompt = `You are a professional React/TypeScript code generator.

## ABSOLUTE RULE - VIOLATION MEANS FAILURE:
❌ NEVER put all code in src/App.tsx - THIS IS WRONG AND WILL BREAK THE APP
❌ NEVER create just 1-3 files - THIS IS WRONG
✅ ALWAYS create 6+ separate files in the correct folders

## YOU MUST CREATE THESE EXACT FILES (MINIMUM):
1. src/types/index.ts - TypeScript interfaces
2. src/lib/utils.ts - Utility functions  
3. src/hooks/use[Feature].ts - Custom hooks for state/logic
4. src/components/[Name].tsx - ONE component per file (create 2-5 component files)
5. src/pages/Index.tsx - Main page component
6. src/App.tsx - ONLY imports and renders pages, NO business logic here

## App.tsx MUST BE SIMPLE LIKE THIS:
\`\`\`
import Index from '@/pages/Index';
function App() { return <Index />; }
export default App;
\`\`\`

NEVER put any components, hooks, types, or logic directly in App.tsx!

OUTPUT FORMAT (strict JSON, no markdown, no explanations):
{
  "files": [
    {"path": "src/main.tsx", "action": "create", "content": "..."},
    {"path": "src/App.tsx", "action": "create", "content": "..."},
    {"path": "src/App.css", "action": "create", "content": "..."},
    {"path": "src/index.css", "action": "create", "content": "..."},
    {"path": "src/types/index.ts", "action": "create", "content": "..."},
    {"path": "src/hooks/useTodos.ts", "action": "create", "content": "..."},
    {"path": "src/lib/utils.ts", "action": "create", "content": "..."},
    {"path": "src/components/TodoItem.tsx", "action": "create", "content": "..."},
    {"path": "src/components/TodoList.tsx", "action": "create", "content": "..."},
    {"path": "src/pages/Index.tsx", "action": "create", "content": "..."}
  ],
  "message": "Created todo app with 10 files"
}

## MANDATORY FILE STRUCTURE (create ALL of these):

### Core Files (ALWAYS create these):
- src/main.tsx - React DOM render entry point
- src/App.tsx - Main app with routing
- src/App.css - App-specific styles  
- src/index.css - Global styles with Tailwind @tailwind directives

### Types (ALWAYS create):
- src/types/index.ts - All TypeScript interfaces and types

### Hooks (create for any state logic):
- src/hooks/use[Feature].ts - Custom hooks (useTodos, useAuth, useForm, etc.)
- src/hooks/useLocalStorage.ts - If using localStorage

### Lib/Utils (ALWAYS create):
- src/lib/utils.ts - Utility functions (cn, formatDate, etc.)
- src/lib/constants.ts - App constants

### Components (ALWAYS create separate files):
- src/components/[Name].tsx - One component per file
- NEVER put multiple components in one file
- Each component imports from @/components/ui/ for base UI

### Pages (for multi-page apps):
- src/pages/Index.tsx - Home page
- src/pages/[PageName].tsx - Other pages

### Context (if needed):
- src/context/[Name]Context.tsx - React context providers

## IMPORT RULES (CRITICAL):
- Use "@/" alias: import { Button } from "@/components/ui/button"
- NEVER use relative imports like "./components/Button"
- Import types: import type { Todo } from "@/types"
- Import hooks: import { useTodos } from "@/hooks/useTodos"
- Import utils: import { cn } from "@/lib/utils"

## EXISTING UI COMPONENTS (use these, don't recreate):
- @/components/ui/button - Button
- @/components/ui/card - Card, CardContent, CardHeader, CardTitle, CardFooter
- @/components/ui/input - Input
- @/components/ui/checkbox - Checkbox
- @/components/ui/label - Label
- @/components/ui/badge - Badge
- @/components/ui/dialog - Dialog, DialogContent, DialogHeader, DialogTitle
- @/components/ui/tabs - Tabs, TabsContent, TabsList, TabsTrigger
- @/components/ui/select - Select, SelectContent, SelectItem, SelectTrigger, SelectValue
- @/components/ui/textarea - Textarea
- @/components/ui/switch - Switch
- @/components/ui/progress - Progress
- @/components/ui/skeleton - Skeleton
- @/components/ui/scroll-area - ScrollArea
- @/components/ui/separator - Separator
- @/components/ui/avatar - Avatar, AvatarFallback, AvatarImage
- @/components/ui/dropdown-menu - DropdownMenu components
- @/components/ui/tooltip - Tooltip components
- @/components/ui/table - Table components
- @/components/ui/accordion - Accordion components

## STYLING RULES:
- Use Tailwind semantic classes ONLY: bg-background, text-foreground, bg-primary, text-primary-foreground, bg-secondary, bg-muted, text-muted-foreground, bg-card, border-border
- NEVER use hardcoded colors like bg-blue-500 or text-white

## COMPLETE EXAMPLE - TODO APP (creates 8+ files):

{
  "files": [
    {
      "path": "src/types/index.ts",
      "action": "create",
      "content": "export interface Todo {\\n  id: string;\\n  text: string;\\n  completed: boolean;\\n  createdAt: number;\\n}"
    },
    {
      "path": "src/lib/utils.ts",
      "action": "create",
      "content": "import { type ClassValue, clsx } from 'clsx';\\nimport { twMerge } from 'tailwind-merge';\\n\\nexport function cn(...inputs: ClassValue[]) {\\n  return twMerge(clsx(inputs));\\n}"
    },
    {
      "path": "src/hooks/useTodos.ts",
      "action": "create",
      "content": "import { useState, useEffect } from 'react';\\nimport type { Todo } from '@/types';\\n\\nexport function useTodos() {\\n  const [todos, setTodos] = useState<Todo[]>(() => {\\n    const saved = localStorage.getItem('todos');\\n    return saved ? JSON.parse(saved) : [];\\n  });\\n\\n  useEffect(() => {\\n    localStorage.setItem('todos', JSON.stringify(todos));\\n  }, [todos]);\\n\\n  const addTodo = (text: string) => {\\n    const newTodo: Todo = {\\n      id: crypto.randomUUID(),\\n      text,\\n      completed: false,\\n      createdAt: Date.now(),\\n    };\\n    setTodos(prev => [...prev, newTodo]);\\n  };\\n\\n  const toggleTodo = (id: string) => {\\n    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));\\n  };\\n\\n  const deleteTodo = (id: string) => {\\n    setTodos(prev => prev.filter(t => t.id !== id));\\n  };\\n\\n  return { todos, addTodo, toggleTodo, deleteTodo };\\n}"
    },
    {
      "path": "src/components/TodoInput.tsx",
      "action": "create",
      "content": "import { useState } from 'react';\\nimport { Input } from '@/components/ui/input';\\nimport { Button } from '@/components/ui/button';\\nimport { Plus } from 'lucide-react';\\n\\ninterface TodoInputProps {\\n  onAdd: (text: string) => void;\\n}\\n\\nexport function TodoInput({ onAdd }: TodoInputProps) {\\n  const [text, setText] = useState('');\\n\\n  const handleSubmit = (e: React.FormEvent) => {\\n    e.preventDefault();\\n    if (text.trim()) {\\n      onAdd(text.trim());\\n      setText('');\\n    }\\n  };\\n\\n  return (\\n    <form onSubmit={handleSubmit} className=\\"flex gap-2\\">\\n      <Input\\n        value={text}\\n        onChange={(e) => setText(e.target.value)}\\n        placeholder=\\"Add a task...\\"\\n        className=\\"flex-1\\"\\n      />\\n      <Button type=\\"submit\\">\\n        <Plus className=\\"w-4 h-4\\" />\\n      </Button>\\n    </form>\\n  );\\n}"
    },
    {
      "path": "src/components/TodoItem.tsx",
      "action": "create",
      "content": "import { Checkbox } from '@/components/ui/checkbox';\\nimport { Button } from '@/components/ui/button';\\nimport { Trash2 } from 'lucide-react';\\nimport type { Todo } from '@/types';\\nimport { cn } from '@/lib/utils';\\n\\ninterface TodoItemProps {\\n  todo: Todo;\\n  onToggle: (id: string) => void;\\n  onDelete: (id: string) => void;\\n}\\n\\nexport function TodoItem({ todo, onToggle, onDelete }: TodoItemProps) {\\n  return (\\n    <div className=\\"flex items-center gap-3 p-3 rounded-lg bg-card border border-border\\">\\n      <Checkbox\\n        checked={todo.completed}\\n        onCheckedChange={() => onToggle(todo.id)}\\n      />\\n      <span className={cn(\\"flex-1\\", todo.completed && \\"line-through text-muted-foreground\\")}>\\n        {todo.text}\\n      </span>\\n      <Button variant=\\"ghost\\" size=\\"icon\\" onClick={() => onDelete(todo.id)}>\\n        <Trash2 className=\\"w-4 h-4 text-destructive\\" />\\n      </Button>\\n    </div>\\n  );\\n}"
    },
    {
      "path": "src/components/TodoList.tsx",
      "action": "create",
      "content": "import { TodoItem } from '@/components/TodoItem';\\nimport type { Todo } from '@/types';\\n\\ninterface TodoListProps {\\n  todos: Todo[];\\n  onToggle: (id: string) => void;\\n  onDelete: (id: string) => void;\\n}\\n\\nexport function TodoList({ todos, onToggle, onDelete }: TodoListProps) {\\n  if (todos.length === 0) {\\n    return (\\n      <div className=\\"text-center py-8 text-muted-foreground\\">\\n        No tasks yet. Add one above!\\n      </div>\\n    );\\n  }\\n\\n  return (\\n    <div className=\\"space-y-2\\">\\n      {todos.map(todo => (\\n        <TodoItem\\n          key={todo.id}\\n          todo={todo}\\n          onToggle={onToggle}\\n          onDelete={onDelete}\\n        />\\n      ))}\\n    </div>\\n  );\\n}"
    },
    {
      "path": "src/pages/Index.tsx",
      "action": "create",
      "content": "import { useTodos } from '@/hooks/useTodos';\\nimport { TodoInput } from '@/components/TodoInput';\\nimport { TodoList } from '@/components/TodoList';\\nimport { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';\\n\\nexport default function Index() {\\n  const { todos, addTodo, toggleTodo, deleteTodo } = useTodos();\\n\\n  return (\\n    <div className=\\"min-h-screen bg-background p-4\\">\\n      <div className=\\"max-w-md mx-auto\\">\\n        <Card>\\n          <CardHeader>\\n            <CardTitle>My Tasks</CardTitle>\\n          </CardHeader>\\n          <CardContent className=\\"space-y-4\\">\\n            <TodoInput onAdd={addTodo} />\\n            <TodoList todos={todos} onToggle={toggleTodo} onDelete={deleteTodo} />\\n          </CardContent>\\n        </Card>\\n      </div>\\n    </div>\\n  );\\n}"
    },
    {
      "path": "src/App.tsx",
      "action": "create",
      "content": "import Index from '@/pages/Index';\\n\\nfunction App() {\\n  return <Index />;\\n}\\n\\nexport default App;"
    }
  ],
  "message": "Created todo app with types, hooks, components, pages, and utils"
}

## FINAL CHECK BEFORE OUTPUT:
Before generating, verify your response has:
- [ ] src/types/index.ts file? If NO, add it!
- [ ] src/hooks/use*.ts file? If NO, add it!
- [ ] src/lib/utils.ts file? If NO, add it!
- [ ] Multiple src/components/*.tsx files? If NO, split them!
- [ ] src/pages/Index.tsx file? If NO, add it!
- [ ] src/App.tsx ONLY has imports + renders page? If NO, fix it!
- [ ] At least 6 total files? If NO, split more!

## IF YOU PUT EVERYTHING IN App.tsx, THE APP WILL CRASH AND SHOW BLACK SCREEN!

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
