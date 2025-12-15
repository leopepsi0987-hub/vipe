import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AgentResult {
  agent: string;
  role: string;
  emoji: string;
  status: "pending" | "working" | "done" | "error";
  output: string;
  startTime?: number;
  endTime?: number;
}

interface WorkflowPlan {
  summary: string;
  tasks: {
    agent: string;
    task: string;
  }[];
}

const AGENTS = {
  chief: {
    name: "Chief",
    emoji: "👑",
    role: "Orchestrator - Analyzes requests and creates execution plans",
    systemPrompt: `You are the CHIEF ORCHESTRATOR of a 5-agent team building web apps.
Your job is to:
1. Analyze the user's request carefully
2. Break it down into specific tasks for each specialist agent
3. Create a clear execution plan

The other agents are:
- DESIGNER: UI/UX, styling, layout, animations, colors
- CODER: JavaScript logic, functionality, event handlers, data handling
- BUG_HUNTER: Security, bugs, edge cases, error handling
- OPTIMIZER: Performance, accessibility, SEO, best practices

OUTPUT FORMAT (JSON only, no markdown):
{
  "summary": "Brief summary of what we're building",
  "tasks": [
    {"agent": "designer", "task": "Specific design task"},
    {"agent": "coder", "task": "Specific coding task"},
    {"agent": "bug_hunter", "task": "Specific review task"},
    {"agent": "optimizer", "task": "Specific optimization task"}
  ]
}

Be specific and actionable. Each task should be clear enough for the agent to execute.`
  },
  designer: {
    name: "Designer",
    emoji: "🎨",
    role: "UI/UX Specialist - Creates stunning visual designs",
    systemPrompt: `You are the DESIGNER agent on a web development team.
Your specialty: UI/UX, styling, layout, animations, colors, typography, visual hierarchy.

RULES:
- Output ONLY the CSS/styling portion of the code
- Use CSS custom properties (variables) for theming
- Make designs STUNNING - gradients, shadows, animations, micro-interactions
- Mobile-first responsive design
- Use modern CSS features: grid, flexbox, backdrop-filter, etc.

OUTPUT FORMAT:
Return ONLY a <style> block with your CSS. Include:
/* === STYLES START === */
/* Your CSS here */
/* === STYLES END === */

Focus on making the app look AMAZING.`
  },
  coder: {
    name: "Coder",
    emoji: "💻",
    role: "Logic Specialist - Writes clean, functional code",
    systemPrompt: `You are the CODER agent on a web development team.
Your specialty: JavaScript logic, event handlers, state management, API calls, data handling.

RULES:
- Write clean, modular JavaScript
- Handle all user interactions
- Implement business logic
- Use modern ES6+ syntax
- For complex apps, use React 18 with hooks

OUTPUT FORMAT:
Return ONLY a <script> block with your JavaScript. Include:
// === SCRIPT START ===
// Your JavaScript here
// === SCRIPT END ===

Focus on making the app FUNCTIONAL and RELIABLE.`
  },
  bugHunter: {
    name: "Bug Hunter",
    emoji: "🔍",
    role: "Security Specialist - Finds and fixes issues",
    systemPrompt: `You are the BUG HUNTER agent on a web development team.
Your specialty: Security, bugs, edge cases, error handling, input validation.

RULES:
- Review the combined code for bugs and security issues
- Add error boundaries and try-catch blocks
- Sanitize user inputs (prevent XSS)
- Handle loading/error/empty states
- Add proper form validation

OUTPUT FORMAT:
Return specific code fixes in this format:
[FIX] Description of the fix
\`\`\`javascript
// The fixed code
\`\`\`

If no issues found, return: [ALL_CLEAR] No bugs or security issues detected.`
  },
  optimizer: {
    name: "Optimizer",
    emoji: "⚡",
    role: "Performance Specialist - Optimizes and polishes",
    systemPrompt: `You are the OPTIMIZER agent on a web development team.
Your specialty: Performance, accessibility, SEO, best practices.

RULES:
- Add accessibility attributes (ARIA labels, semantic HTML, focus management)
- Optimize for performance (debouncing, lazy loading, event delegation)
- Ensure keyboard navigation works
- Add proper meta tags and document structure
- Check color contrast and responsive behavior

OUTPUT FORMAT:
Return specific improvements in this format:
[IMPROVE] Description of the improvement
\`\`\`html
// The improved code
\`\`\`

If no improvements needed, return: [OPTIMIZED] Code is already well optimized.`
  }
};

async function callAgent(agentKey: string, prompt: string, context: string, apiKey: string): Promise<string> {
  const agent = AGENTS[agentKey as keyof typeof AGENTS];
  if (!agent) throw new Error(`Unknown agent: ${agentKey}`);

  console.log(`[${agent.name}] Starting agent call...`);

  // Use Vertex AI (Google AI Platform) endpoint (API key auth)
  const response = await fetch(
    `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: agent.systemPrompt }] },
        contents: [
          {
            role: "user",
            parts: [{ text: `CONTEXT:\n${context}\n\n---\n\nTASK:\n${prompt}` }],
          },
        ],
        generationConfig: {
          temperature: 1.0,
          maxOutputTokens: 8192,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error(`Agent ${agentKey} error:`, error);
    throw new Error(`Agent ${agentKey} failed: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  console.log(`[${agent.name}] Completed, output length: ${content.length}`);
  return content;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, currentCode, dbChoice } = await req.json();
    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");

    if (!GOOGLE_GEMINI_API_KEY) {
      throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
    }

    console.log("[Multi-Agent] Starting workflow for prompt:", prompt.slice(0, 100));

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // Phase 1: Chief creates the plan
          sendEvent({ 
            type: "agent_start", 
            agent: "chief",
            message: "Analyzing your request and creating a plan..." 
          });

          const planResponse = await callAgent(
            "chief",
            prompt,
            currentCode ? `Current code exists (${currentCode.length} chars). User wants to modify/add to it.` : "Starting fresh, no existing code.",
            GOOGLE_GEMINI_API_KEY
          );

          let plan: WorkflowPlan;
          try {
            // Extract JSON from response
            const jsonMatch = planResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("No JSON found");
            plan = JSON.parse(jsonMatch[0]);
          } catch (e) {
            console.error("Failed to parse plan:", planResponse);
            plan = {
              summary: "Building your app",
              tasks: [
                { agent: "designer", task: "Create beautiful, modern UI with animations" },
                { agent: "coder", task: "Implement all functionality and logic" },
                { agent: "bug_hunter", task: "Review for bugs and security issues" },
                { agent: "optimizer", task: "Optimize performance and accessibility" }
              ]
            };
          }

          sendEvent({ 
            type: "plan_created", 
            plan,
            message: `Plan ready! ${plan.summary}`
          });

          // Phase 2: Run Designer and Coder in parallel
          const designerTask = plan.tasks.find(t => t.agent === "designer")?.task || "Create stunning UI";
          const coderTask = plan.tasks.find(t => t.agent === "coder")?.task || "Implement functionality";

          sendEvent({ type: "agent_start", agent: "designer", message: "Creating beautiful design..." });
          sendEvent({ type: "agent_start", agent: "coder", message: "Writing the code logic..." });

          const fullContext = `
USER REQUEST: ${prompt}

DATABASE CHOICE: ${dbChoice || "BUILT_IN_DB"}

EXISTING CODE:
${currentCode || "No existing code - building from scratch"}
`;

          const [designerOutput, coderOutput] = await Promise.all([
            callAgent("designer", designerTask, fullContext, GOOGLE_GEMINI_API_KEY),
            callAgent("coder", coderTask, fullContext, GOOGLE_GEMINI_API_KEY)
          ]);

          sendEvent({ 
            type: "agent_done", 
            agent: "designer", 
            output: designerOutput.slice(0, 500) + "...",
            message: "Design complete! 🎨" 
          });

          sendEvent({ 
            type: "agent_done", 
            agent: "coder", 
            output: coderOutput.slice(0, 500) + "...",
            message: "Code complete! 💻" 
          });

          // Phase 3: Bug Hunter reviews combined output
          sendEvent({ type: "agent_start", agent: "bugHunter", message: "Scanning for bugs and security issues..." });

          const bugHunterTask = plan.tasks.find(t => t.agent === "bug_hunter")?.task || "Review for issues";
          const combinedForReview = `
DESIGNER OUTPUT:
${designerOutput}

CODER OUTPUT:
${coderOutput}
`;

          const bugHunterOutput = await callAgent("bugHunter", bugHunterTask, combinedForReview, GOOGLE_GEMINI_API_KEY);

          sendEvent({ 
            type: "agent_done", 
            agent: "bugHunter", 
            output: bugHunterOutput.slice(0, 300) + "...",
            message: bugHunterOutput.includes("[ALL_CLEAR]") ? "No bugs found! ✅" : "Found some issues, applying fixes... 🔧" 
          });

          // Phase 4: Optimizer polishes
          sendEvent({ type: "agent_start", agent: "optimizer", message: "Optimizing performance and accessibility..." });

          const optimizerTask = plan.tasks.find(t => t.agent === "optimizer")?.task || "Optimize everything";
          const optimizerOutput = await callAgent("optimizer", optimizerTask, combinedForReview, GOOGLE_GEMINI_API_KEY);

          sendEvent({ 
            type: "agent_done", 
            agent: "optimizer", 
            output: optimizerOutput.slice(0, 300) + "...",
            message: "Optimizations applied! ⚡" 
          });

          // Phase 5: Final assembly - Chief combines everything
          sendEvent({ type: "agent_start", agent: "chief", message: "Assembling the final code..." });

          const assemblyPrompt = `
You are assembling the final HTML file from the team's outputs. Combine everything into a SINGLE, COMPLETE, WORKING HTML file.

USER REQUEST: ${prompt}
DATABASE CHOICE: ${dbChoice || "BUILT_IN_DB"}

DESIGNER'S STYLES:
${designerOutput}

CODER'S SCRIPTS:
${coderOutput}

BUG HUNTER'S FIXES:
${bugHunterOutput}

OPTIMIZER'S IMPROVEMENTS:
${optimizerOutput}

${currentCode ? `ORIGINAL CODE TO MODIFY:\n${currentCode}` : ""}

RULES:
1. Output ONLY the complete HTML file starting with <!DOCTYPE html>
2. Integrate ALL improvements and fixes from the team
3. Include proper structure markers (/* === STYLES START === */ etc.)
4. Make sure the app is fully functional
5. NO explanations, NO markdown - ONLY the HTML code

${dbChoice === "BUILT_IN_DB" ? `
Include the Cloud Storage API helper at the start of your script:
const API_URL = 'https://svadrczzdvdbeajeiabs.supabase.co/functions/v1/app-api';
const PROJECT_SLUG = window.location.pathname.split('/app/')[1] || null;
const hasBackend = () => PROJECT_SLUG !== null;
// ... (include the full storage helper)
` : ""}
`;

          const finalCode = await callAgent("chief", assemblyPrompt, "", GOOGLE_GEMINI_API_KEY);

          sendEvent({ 
            type: "agent_done", 
            agent: "chief", 
            message: "Assembly complete! 👑" 
          });

          // Send final code
          sendEvent({ 
            type: "complete", 
            code: finalCode,
            message: "Your app is ready! 🚀"
          });

          sendEvent({ type: "[DONE]" });
          controller.close();

        } catch (error) {
          console.error("Workflow error:", error);
          sendEvent({ 
            type: "error", 
            message: error instanceof Error ? error.message : "Unknown error occurred" 
          });
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error) {
    console.error("Multi-agent build error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
