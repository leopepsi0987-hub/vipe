import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, model, context, scrapedContent, isEdit, existingFiles, supabaseConnection, sessionId } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");

    if (!GEMINI_API_KEY) {
      throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
    }

    // Determine if this is an edit request (has existing files or explicit isEdit flag)
    const hasExistingFiles = existingFiles && Object.keys(existingFiles).length > 0;
    const editMode = isEdit || hasExistingFiles;

    // Build context from scraped website if available
    let websiteContext = "";
    if (scrapedContent) {
      websiteContext = `
## WEBSITE TO CLONE:
URL: ${scrapedContent.url || "Unknown"}
Title: ${scrapedContent.title || "Unknown"}

### Content:
${scrapedContent.markdown || scrapedContent.content || "No content available"}

### Branding (if available):
${scrapedContent.branding ? JSON.stringify(scrapedContent.branding, null, 2) : "Not available"}
`;
    }

    // Build Supabase context if user has connected their database
    let supabaseContext = "";
    if (supabaseConnection?.connected && supabaseConnection?.url) {
      supabaseContext = `
## SUPABASE DATABASE CONNECTED:
The user has connected their Supabase database! You can now use Supabase for this project.

**Supabase Project URL**: ${supabaseConnection.url}
**Connection Method**: ${supabaseConnection.connectedVia || "manual"}
${supabaseConnection.supabaseProjectId ? `**Project ID**: ${supabaseConnection.supabaseProjectId}` : ""}

### IMPORTANT SUPABASE GUIDELINES:
1. Import the Supabase client using: \`import { supabase } from './lib/supabase'\`
2. Create a supabase.js file in src/lib/ that initializes the client
3. Use Supabase for authentication, database operations, and storage
4. Implement RLS-friendly queries that respect user permissions
5. Use supabase.auth for login/signup functionality when needed
6. The anon key should be used client-side (it's safe to expose)
`;
    }

    // Build file context from existing files
    let fileContext = "";
    if (hasExistingFiles) {
      fileContext = "\n\n## CURRENT PROJECT FILES (YOU MUST PRESERVE THESE AND ONLY MODIFY WHAT'S NEEDED):\n";
      for (const [path, content] of Object.entries(existingFiles)) {
        fileContext += `\n### ${path}\n\`\`\`\n${content}\n\`\`\`\n`;
      }
    } else if (context?.sandboxFiles && Object.keys(context.sandboxFiles).length > 0) {
      fileContext = "\n\n## CURRENT PROJECT FILES:\n";
      for (const [path, content] of Object.entries(context.sandboxFiles)) {
        fileContext += `\n### ${path}\n\`\`\`\n${content}\n\`\`\`\n`;
      }
    }

    let systemPrompt: string;

    // IMPORTANT: Sandbox environment constraints
    const sandboxConstraints = `
## ⚠️ CRITICAL SANDBOX CONSTRAINTS:

This app runs in a browser sandbox with ONLY these libraries available:
- React (import from 'react')
- ReactDOM (import from 'react-dom/client')
- Tailwind CSS (via CDN, already loaded)

### ❌ DO NOT USE THESE (they will cause errors):
- react-router-dom (NO ROUTING LIBRARY)
- axios, lodash, or any npm packages
- @supabase/supabase-js (DON'T import it!)
- Context providers from external packages
- Any imports from packages not listed above

### ✅ INSTEAD, USE THESE PATTERNS:

**For navigation/routing:** Use simple state-based navigation:
\`\`\`jsx
const [page, setPage] = useState('home');
// Then conditionally render: {page === 'home' && <Home />}
\`\`\`

**For HTTP requests:** Use native fetch()

**For state management:** Use React useState/useReducer only

**For icons:** Use emoji or inline SVG, NOT icon libraries
`;

    // Supabase instructions when connected
    const getSupabaseInstructions = (conn: any, sessId: string) => {
      if (!conn?.url) return '';
      
      const hasAnonKey = !!conn?.anonKey;
      const hasServiceRole = !!conn?.serviceRoleKey;
      const projectId = conn?.supabaseProjectId || '';
      
      return `
## 🔌 SUPABASE DATABASE CONNECTED - THE USER HAS CONNECTED THEIR DATABASE!

**IMPORTANT: The user has connected their Supabase project. USE IT for any data persistence!**

**Project URL**: ${conn.url}
${hasAnonKey ? `**Anon Key**: ${conn.anonKey}` : ''}
**Connected via**: ${conn.connectedVia || 'manual'}
${projectId ? `**Project ID**: ${projectId}` : ''}

**CRITICAL: Do NOT import @supabase/supabase-js! Use the REST API with fetch() instead.**

\${hasAnonKey ? \`
### Database Operations with fetch() - WITH ERROR HANDLING:

\\\`\\\`\\\`jsx
// Supabase configuration
const SUPABASE_URL = '\${conn.url}';
const SUPABASE_KEY = '\${conn.anonKey}';

// Helper function for Supabase API calls with proper error handling
const supabaseFetch = async (table, options = {}) => {
  const { method = 'GET', body, filters = '' } = options;
  const url = SUPABASE_URL + '/rest/v1/' + table + filters;
  
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
  };
  if (method === 'POST' || method === 'PATCH') headers['Prefer'] = 'return=representation';
  if (method === 'DELETE') headers['Prefer'] = 'return=minimal';
  
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  
  // Check for HTTP errors
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.message || errorData.hint || errorData.error || res.statusText;
    throw new Error(errorMessage);
  }
  
  // DELETE returns no content
  if (method === 'DELETE') return { success: true };
  
  return await res.json();
};

// Example usage:
// SELECT: const todos = await supabaseFetch('todos', { filters: '?select=*' });
// INSERT: await supabaseFetch('todos', { method: 'POST', body: { title: 'New', done: false } });
// UPDATE: await supabaseFetch('todos', { method: 'PATCH', body: { done: true }, filters: '?id=eq.1' });
// DELETE: await supabaseFetch('todos', { method: 'DELETE', filters: '?id=eq.1' });
\\\`\\\`\\\`

### React Pattern with PROPER ERROR HANDLING:
\\\`\\\`\\\`jsx
const [items, setItems] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  const fetchData = async () => {
    try {
      const res = await fetch('\${conn.url}/rest/v1/your_table?select=*', {
        headers: {
          'apikey': '\${conn.anonKey}',
          'Authorization': 'Bearer \${conn.anonKey}'
        }
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || errData.hint || 'Failed to load data');
      }
      
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };
  fetchData();
}, []);

// In your render:
// if (loading) return <div>Loading...</div>;
// if (error) return <div style={{color: 'red'}}>Error: {error}</div>;
\\\`\\\`\\\`

### ⚠️ IMPORTANT ERROR HANDLING RULES:
1. **Always check res.ok** before parsing JSON
2. **Always wrap fetch in try/catch**
3. **Display user-friendly error messages** - show what went wrong
4. **Handle edge cases**: empty arrays, null data, network failures
5. **Show loading states** while fetching
\` : \`
### The database is connected but the anon key is not available.
You can still reference that the user has Supabase connected. 
Ask the user to provide table names and structure, then use the REST API pattern.
\`}

## 🗄️ DATABASE MIGRATIONS - YOU CAN CREATE TABLES!

When the user needs database tables, you can create them! Output SQL in this special format:

\`\`\`sql-migration
-- ALWAYS use IF NOT EXISTS to avoid errors if table already exists!
CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS (use IF NOT EXISTS pattern)
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Drop existing policy first to avoid conflicts, then create
DROP POLICY IF EXISTS "Allow all" ON todos;
CREATE POLICY "Allow all" ON todos FOR ALL USING (true);
\`\`\`

When you output SQL in \`\`\`sql-migration blocks, our system will automatically execute it on the user's database.

**⚠️ CRITICAL SQL GUIDELINES:**
1. **ALWAYS use CREATE TABLE IF NOT EXISTS** - never plain CREATE TABLE
2. **ALWAYS use DROP POLICY IF EXISTS before CREATE POLICY** - to avoid conflicts
3. Always use UUID for primary keys with gen_random_uuid()
4. Include created_at TIMESTAMPTZ DEFAULT now() for tracking
5. Enable RLS on all tables
6. Use proper data types (TEXT, BOOLEAN, INTEGER, TIMESTAMPTZ, etc.)

**When the user asks for features needing a database:**
1. First, create the required tables using sql-migration blocks (with IF NOT EXISTS!)
2. Then write the React code to use those tables via REST API
3. Handle errors gracefully (table might not exist yet on first render)
4. Always show loading states
`;
    };
    // Validate Supabase connection before using
    let validatedSupabaseConnection = supabaseConnection;
    if (supabaseConnection?.url && supabaseConnection?.anonKey) {
      // Extract project ID from URL and verify it matches the key
      const urlMatch = supabaseConnection.url.match(/https:\/\/([^.]+)\.supabase\.co/);
      const urlProjectId = urlMatch ? urlMatch[1] : null;
      
      // Decode the JWT to check the 'ref' field
      try {
        const keyParts = supabaseConnection.anonKey.split('.');
        if (keyParts.length >= 2) {
          const payload = JSON.parse(atob(keyParts[1]));
          const keyProjectId = payload.ref;
          
          if (urlProjectId && keyProjectId && urlProjectId !== keyProjectId) {
            console.warn(`[generate-ai-code] Supabase URL/Key mismatch! URL project: ${urlProjectId}, Key project: ${keyProjectId}`);
            // Clear the connection if mismatched - this will cause the app to use localStorage instead
            validatedSupabaseConnection = null;
          }
        }
      } catch (e) {
        console.warn("[generate-ai-code] Failed to validate Supabase key:", e);
      }
    }

    // Get Supabase instructions if connected and validated
    const supabaseInstructions = getSupabaseInstructions(validatedSupabaseConnection, sessionId || '');

    if (editMode) {
      // Check if Supabase was just connected but app doesn't use it yet
      const supabaseJustConnected = supabaseConnection?.connected && supabaseConnection?.url && supabaseConnection?.anonKey;
      const appMightNotUseSupabase = hasExistingFiles && !Object.values(existingFiles || {}).some((content: any) => 
        typeof content === 'string' && (content.includes('supabaseFetch') || content.includes('/rest/v1/'))
      );
      
      const supabaseIntegrationHint = (supabaseJustConnected && appMightNotUseSupabase) ? `
## 🆕 SUPABASE WAS JUST CONNECTED!

The user has connected their Supabase database, but the current app might not be using it yet.

**If the user asks to "link Supabase", "connect to database", or "use database":**
1. Look at the current app structure
2. Identify data that should be persisted (users, todos, posts, etc.)
3. Create the necessary tables using \`\`\`sql-migration blocks
4. Update the React code to use the Supabase REST API for CRUD operations
5. Add the supabaseFetch helper function to the main App.jsx or a lib file
6. Replace any mock/local data with real database calls

**Important:** Use the Supabase connection details provided above!
` : '';

      // EDIT MODE - preserve existing code, only modify what's needed
      systemPrompt = `You are an expert React developer who makes TARGETED EDITS to existing applications.

${sandboxConstraints}
${supabaseInstructions}
${supabaseIntegrationHint}

## 🗣️ CHAT VS BUILD DETECTION (VERY IMPORTANT!):

**Not every message is a build/edit request!**

If the user's message is just a casual greeting or chat (like "hi", "hello", "hey", "how are you", "what's up", "thanks", "cool", "nice", "bye", etc.), respond with a friendly conversational message instead of generating code.

**For chat/greeting messages, output ONLY this special format:**
\`\`\`chat
Your friendly response here. Be warm and conversational!
Ask what changes they'd like to make to their app.
\`\`\`

**Examples of CHAT (don't generate code):**
- "hi" → Chat response
- "hello" → Chat response  
- "hey there" → Chat response
- "thanks!" → Chat response
- "what can you do?" → Chat response explaining your capabilities

**Examples of BUILD/EDIT (generate code):**
- "make it glass style" → Edit code
- "change the button to blue" → Edit code
- "add a dark mode" → Edit code

## CRITICAL EDIT RULES:

1. **PRESERVE EXISTING CODE**: You MUST keep all existing functionality, styling, and structure intact.
2. **ONLY MODIFY WHAT'S REQUESTED**: Only change the specific parts the user asks for.
3. **RETURN ONLY CHANGED FILES**: Only output files that actually need modifications.
4. **MAINTAIN CONSISTENCY**: Keep the same coding style, naming conventions, and patterns as the existing code.
5. **FOLLOW STYLE REQUESTS PRECISELY**: If user asks for "glass", "glassmorphism", "blur", "frosted", use the glass effect patterns below!

## 🪟 GLASSMORPHISM / GLASS EFFECTS:

When the user asks for "glass", "glassmorphism", "frosted glass", "blur effects", "iPhone style", "iOS style", "Apple style", "modern glass", or similar:

**YOU MUST use these Tailwind classes:**

\`\`\`jsx
// Glass card
<div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl">

// Glass button  
<button className="bg-white/20 backdrop-blur-md border border-white/30 rounded-xl hover:bg-white/30 transition-all">

// Glass header/navbar
<header className="fixed top-0 inset-x-0 bg-black/20 backdrop-blur-2xl border-b border-white/10 z-50">

// Glass input
<input className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg focus:border-white/40 focus:bg-white/20">

// Glass modal
<div className="bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-2xl border border-white/25 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
\`\`\`

**Glass effect MUST HAVES:**
1. \`backdrop-blur-xl\` or \`backdrop-blur-2xl\` - THE frosted effect
2. \`bg-white/10\` to \`bg-white/30\` OR \`bg-black/20\` to \`bg-black/40\` - transparent background
3. \`border border-white/20\` - subtle light border
4. \`rounded-2xl\` or \`rounded-3xl\` - smooth corners
5. \`shadow-2xl\` or custom shadow - depth

**APPLY GLASS TO ALL ELEMENTS** when user asks for glass style: cards, buttons, headers, inputs, modals, everything!

## ⚠️ SYNTAX VALIDATION - CRITICAL!

**YOUR CODE MUST BE VALID JAVASCRIPT/JSX! Follow these rules STRICTLY:**

1. **COMPLETE ALL FUNCTIONS**: Every function must have proper opening AND closing braces {}
2. **COMPLETE ALL OBJECTS**: Every object literal must have matching { and }
3. **COMPLETE ALL ARRAYS**: Every array must have matching [ and ]
4. **SEMICOLONS**: Add semicolons after statements (const, let, return outside JSX, etc.)
5. **PARENTHESES**: Ensure all ( have matching )
6. **JSX TAGS**: Every opening tag <div> needs a closing </div> or self-close <img />
7. **ARROW FUNCTIONS**: const fn = () => { ... }; - don't forget the closing brace and semicolon

**COMMON ERRORS TO AVOID:**
- Cutting off code mid-function (always complete the entire function!)
- Missing closing braces } at end of functions
- Starting a new statement without finishing the previous one
- Missing semicolons after object/function definitions
- Incomplete return statements

**Before outputting any file, mentally verify:**
- Count opening { and closing } - they must match
- Count opening ( and closing ) - they must match
- Every const/let/function statement is complete

## OUTPUT FORMAT (CRITICAL):

You MUST output code in this exact format with file tags:

<file path="src/components/Header.jsx">
// Modified component - only if changes are needed
</file>

DO NOT output files that don't need changes!

${fileContext}

## USER'S EDIT REQUEST:
The user wants to make specific changes to their existing app. Read their request carefully and ONLY modify what they ask for.

Remember:
- DO NOT regenerate the entire app
- DO NOT change the overall design or structure unless asked
- DO NOT add new features unless asked
- PRESERVE all existing functionality
- Only output the files that need to be modified
- **IF USER ASKS FOR GLASS STYLE, USE GLASSMORPHISM EVERYWHERE**
- **ENSURE ALL CODE IS SYNTACTICALLY VALID**`;
    } else {
      // NEW PROJECT MODE - generate from scratch
      systemPrompt = `You are an expert React developer who creates beautiful, production-ready applications.

${sandboxConstraints}
${supabaseInstructions}

## OUTPUT FORMAT (CRITICAL):

You MUST output code in this exact format with file tags:

<file path="src/App.jsx">
// Your React code here
import React, { useState } from 'react'

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  
  return (
    <div>
      {currentPage === 'home' && <Home onNavigate={setCurrentPage} />}
      {currentPage === 'about' && <About onNavigate={setCurrentPage} />}
    </div>
  );
}

export default App;
</file>

<file path="src/components/Header.jsx">
// Another component
</file>

<file path="src/index.css">
/* CSS styles */
</file>

## REQUIREMENTS:

1. Create COMPLETE, WORKING React components
2. Use Tailwind CSS for all styling (via CDN, already available)
3. Make the design BEAUTIFUL and MODERN
4. Include proper responsive design
5. Use semantic HTML elements
6. Add hover states, transitions, and micro-interactions
7. Create multiple components (Header, Footer, sections, etc.)
8. Use STATE-BASED NAVIGATION (no react-router-dom!)

## ⚠️ SYNTAX VALIDATION - CRITICAL!

**YOUR CODE MUST BE VALID JAVASCRIPT/JSX! Follow these rules STRICTLY:**

1. **COMPLETE ALL FUNCTIONS**: Every function must have proper opening AND closing braces {}
2. **COMPLETE ALL OBJECTS**: Every object literal must have matching { and }
3. **COMPLETE ALL ARRAYS**: Every array must have matching [ and ]
4. **SEMICOLONS**: Add semicolons after statements (const, let, return outside JSX, etc.)
5. **PARENTHESES**: Ensure all ( have matching )
6. **JSX TAGS**: Every opening tag <div> needs a closing </div> or self-close <img />
7. **ARROW FUNCTIONS**: const fn = () => { ... }; - don't forget the closing brace and semicolon

**COMMON ERRORS TO AVOID:**
- Cutting off code mid-function (always complete the entire function!)
- Missing closing braces } at end of functions
- Starting a new statement without finishing the previous one
- Missing semicolons after object/function definitions
- Incomplete return statements

**Before outputting any file, mentally verify:**
- Count opening { and closing } - they must match
- Count opening ( and closing ) - they must match
- Every const/let/function statement is complete

${websiteContext ? `## CLONING INSTRUCTIONS:
You are cloning a website. Match the visual style, layout, and content structure.
${websiteContext}` : ""}

${supabaseContext}

${fileContext}

## STYLE GUIDELINES:

- Use gradients, shadows, and modern effects
- Implement smooth transitions (transition-all duration-300)
- Add hover effects on interactive elements
- Use proper spacing (p-4, m-6, gap-4, etc.)
- Create visually appealing color schemes
- Include icons using emoji or inline SVG shapes

## 🪟 GLASSMORPHISM / GLASS EFFECTS (WHEN REQUESTED):

When the user asks for "glass", "glassmorphism", "frosted glass", "blur effects", "iPhone style", "iOS style", "Apple style", or similar:

**ALWAYS use these Tailwind classes for glass effects:**

\`\`\`jsx
// Glass card effect
<div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl">

// Glass button
<button className="bg-white/20 backdrop-blur-md border border-white/30 rounded-xl hover:bg-white/30 transition-all duration-300">

// Glass navbar/header
<header className="fixed top-0 left-0 right-0 bg-black/20 backdrop-blur-2xl border-b border-white/10 z-50">

// Glass modal/dialog
<div className="bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-2xl border border-white/25 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
\`\`\`

**Key glass effect ingredients:**
1. \`backdrop-blur-xl\` or \`backdrop-blur-2xl\` - the frosted effect
2. \`bg-white/10\` to \`bg-white/30\` - semi-transparent white background
3. \`border border-white/20\` - subtle light border
4. \`rounded-2xl\` or \`rounded-3xl\` - smooth rounded corners
5. \`shadow-2xl\` - depth effect

**For dark glass (like iPhone dark mode):**
\`\`\`jsx
<div className="bg-black/30 backdrop-blur-2xl border border-white/10 rounded-3xl">
\`\`\`

**For colorful glass:**
\`\`\`jsx
<div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-xl border border-purple-300/20">
\`\`\`

**IMPORTANT:** When user mentions glass effects, you MUST apply these to ALL major UI elements: cards, buttons, headers, modals, inputs, etc. Make it pervasive, not just one element!

## 🗣️ CHAT VS BUILD DETECTION:

**IMPORTANT: Not every message is a build request!**

If the user's message is a casual greeting or chat (like "hi", "hello", "hey", "how are you", "what's up", "thanks", "bye", etc.), respond with a friendly conversational message instead of generating code.

**For chat messages, output this special format:**
\`\`\`chat
Your friendly response here. Keep it warm and conversational.
Ask what they'd like to build or how you can help!
\`\`\`

**Examples:**
- "hi" → Respond with chat, don't generate code
- "hello how are you" → Respond with chat
- "thanks!" → Respond with chat
- "build me a todo app" → Generate code
- "make the button blue" → Generate code (edit)
- "what can you do?" → Respond with chat explaining capabilities

Remember: Output ONLY the file tags with code. No explanations before or after. **ENSURE ALL CODE IS SYNTACTICALLY VALID!**`;
    }

    console.log("[generate-ai-code] Generating code with Gemini... Edit mode:", editMode);

    // Use Gemini API
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 32768,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[generate-ai-code] Gemini error:", error);
      throw new Error(`Gemini API error: ${error}`);
    }

    // Transform Gemini SSE to our format
    const reader = response.body?.getReader();
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6));
                  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
                  if (text) {
                    fullContent += text;
                    // Send raw stream for real-time display
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: "stream", text, raw: true })}\n\n`)
                    );
                  }
                } catch {
                  // Skip malformed JSON
                }
              }
            }
          }

          // Send completion
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ 
              type: "complete", 
              generatedCode: fullContent,
              explanation: "Code generated successfully!"
            })}\n\n`)
          );
        } catch (error) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: String(error) })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("[generate-ai-code] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
