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
    const { prompt, model, context, scrapedContent, isEdit, existingFiles } = await req.json();
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

    if (editMode) {
      // EDIT MODE - preserve existing code, only modify what's needed
      systemPrompt = `You are an expert React developer who makes TARGETED EDITS to existing applications.

## CRITICAL EDIT RULES:

1. **PRESERVE EXISTING CODE**: You MUST keep all existing functionality, styling, and structure intact.
2. **ONLY MODIFY WHAT'S REQUESTED**: Only change the specific parts the user asks for.
3. **RETURN ONLY CHANGED FILES**: Only output files that actually need modifications.
4. **MAINTAIN CONSISTENCY**: Keep the same coding style, naming conventions, and patterns as the existing code.

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
- Only output the files that need to be modified`;
    } else {
      // NEW PROJECT MODE - generate from scratch
      systemPrompt = `You are an expert React developer who creates beautiful, production-ready applications.

## OUTPUT FORMAT (CRITICAL):

You MUST output code in this exact format with file tags:

<file path="src/App.jsx">
// Your React code here
import React from 'react'
// ... rest of the component
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

${websiteContext ? `## CLONING INSTRUCTIONS:
You are cloning a website. Match the visual style, layout, and content structure.
${websiteContext}` : ""}

${fileContext}

## STYLE GUIDELINES:

- Use gradients, shadows, and modern effects
- Implement smooth transitions (transition-all duration-300)
- Add hover effects on interactive elements
- Use proper spacing (p-4, m-6, gap-4, etc.)
- Create visually appealing color schemes
- Include icons using emoji or simple SVG shapes

Remember: Output ONLY the file tags with code. No explanations before or after.`;
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
