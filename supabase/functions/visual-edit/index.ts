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
    const { instruction, elementInfo, currentStyles } = await req.json();
    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    
    if (!GOOGLE_GEMINI_API_KEY) {
      throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
    }

    const systemPrompt = `You are a visual design AI assistant. You modify HTML elements based on natural language instructions.

Given an element's current state, return ONLY a JSON object with the exact CSS changes to apply. No explanations.

IMPORTANT RULES:
- Return ONLY valid JSON, nothing else
- Only include properties that need to change
- Use standard CSS values (e.g., "16px", "#ff0000", "bold", "8px 16px")
- For text changes, include a "text" property with the new text content

Available properties you can modify:
- color (text color, use hex like #ffffff)
- backgroundColor (use hex like #000000)
- fontSize (use px like 16px, 20px, 24px)
- fontWeight (normal, bold, 100-900)
- padding (use px like 8px or 8px 16px)
- margin (use px like 8px or 8px 16px)
- borderRadius (use px like 4px, 8px, 50%)
- border (like 2px solid #ffffff)
- text (the new text content if changing text)
- width (use px or %)
- height (use px or %)
- opacity (0 to 1)
- transform (like scale(1.1) or rotate(5deg))

Example response for "make this button bigger and blue":
{"backgroundColor":"#2563eb","padding":"16px 32px","fontSize":"18px"}

Example response for "change text to Hello World":
{"text":"Hello World"}

Example response for "make it red and rounded":
{"backgroundColor":"#ef4444","borderRadius":"9999px"}

Example response for "make it smaller":
{"fontSize":"14px","padding":"4px 8px"}`;

    const userPrompt = `Element: <${elementInfo.tagName}>
Current text: "${elementInfo.text || "(no text)"}"
Current styles: ${JSON.stringify(currentStyles, null, 2)}

User instruction: "${instruction}"

Return ONLY the JSON object with CSS changes:`;

    console.log("Visual edit request:", { instruction, elementInfo });

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [
          { role: "user", parts: [{ text: userPrompt }] }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Gemini error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error("AI service error: " + errorText);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    console.log("AI response:", content);

    // Parse JSON from response
    let changes = {};
    try {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        changes = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse AI response as JSON:", e);
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ changes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in visual-edit function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
