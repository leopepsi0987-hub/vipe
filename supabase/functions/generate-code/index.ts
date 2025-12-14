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
    const { prompt, currentCode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are Vipe, an expert AI coding assistant that generates beautiful, modern web applications. You create complete, working HTML/CSS/JavaScript code.

RULES:
1. Always generate complete, self-contained HTML files with embedded CSS and JavaScript
2. Use modern CSS features like flexbox, grid, gradients, and animations
3. Make designs beautiful, responsive, and professional
4. Include interactive elements when appropriate
5. Use a modern color palette with good contrast
6. Return ONLY the HTML code, no markdown, no explanations, no code blocks
7. The code should be ready to render directly in an iframe

When given existing code to modify, update it according to the user's request while maintaining the overall structure.`;

    const messages = [
      { role: "system", content: systemPrompt },
    ];

    if (currentCode && currentCode.trim()) {
      messages.push({ 
        role: "user", 
        content: `Here is my current code:\n\n${currentCode}\n\nPlease modify it based on this request: ${prompt}` 
      });
    } else {
      messages.push({ 
        role: "user", 
        content: `Create a beautiful web page for: ${prompt}` 
      });
    }

    console.log("Calling Lovable AI with prompt:", prompt);

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
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
