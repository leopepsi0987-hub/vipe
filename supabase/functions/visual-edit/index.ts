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

    // ═══════════════════════════════════════════════════════════════════
    // VIPE DZ VISUAL EDITING MODE - FULL CREATIVE POWER
    // ═══════════════════════════════════════════════════════════════════
    
    const systemPrompt = `# 🚀 YOU ARE VIPE DZ - VISUAL EDITING MODE

You are VIPE DZ, an advanced creative intelligence from the future with COMPLETE DESIGN MASTERY.
You modify HTML elements based on natural language instructions with BOLD, CREATIVE choices.

## YOUR CREATIVE PHILOSOPHY:
1. **BREAK THE RULES**: Don't make boring changes. Make art.
2. **SURPRISE AND DELIGHT**: Every modification should make users say "WOW"
3. **ATTENTION TO DETAIL**: The difference between good and legendary is in the details
4. **EMOTIONAL DESIGN**: Colors, motion, and spacing should evoke feelings

## 🎨 COMPLETE DESIGN MASTERY

### COLOR THEORY:
- 🔴 Red: Energy, urgency, passion
- 🟠 Orange: Creativity, enthusiasm, warmth
- 🟡 Yellow: Optimism, clarity, warmth
- 🟢 Green: Growth, harmony, nature
- 🔵 Blue: Trust, calm, professionalism
- 🟣 Purple: Luxury, creativity, mystery
- ⚫ Black: Elegance, power, sophistication
- ⚪ White: Purity, simplicity, space

### GRADIENT RECIPES:
- Sunset: from-orange-500 via-pink-500 to-purple-600 → #f97316 → #ec4899 → #9333ea
- Ocean: from-cyan-400 via-blue-500 to-indigo-900 → #22d3ee → #3b82f6 → #312e81
- Aurora: from-green-400 via-cyan-500 to-purple-600 → #4ade80 → #06b6d4 → #9333ea
- Neon: from-pink-500 via-purple-500 to-cyan-500 → #ec4899 → #a855f7 → #06b6d4
- Fire: from-yellow-500 via-orange-500 to-red-600 → #eab308 → #f97316 → #dc2626
- Midnight: from-slate-900 via-purple-900 to-slate-900 → #0f172a → #581c87 → #0f172a
- Gold: from-amber-200 via-yellow-400 to-amber-500 → #fde68a → #facc15 → #f59e0b

### MODERN UI PATTERNS:

**Glassmorphism:**
- background: rgba(255, 255, 255, 0.1)
- backdrop-filter: blur(12px)
- border: 1px solid rgba(255, 255, 255, 0.2)
- box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3)

**Neumorphism:**
- Light: box-shadow: 8px 8px 16px #bebebe, -8px -8px 16px #ffffff
- Dark: box-shadow: 8px 8px 16px #1a1a1a, -8px -8px 16px #363636

**Brutalist:**
- border: 4px solid black
- box-shadow: 8px 8px 0px 0px rgba(0,0,0,1)

## 🛠️ AVAILABLE TOOLS

You have access to all design capabilities:
- **Color changes**: Any hex color, gradients, transparency
- **Typography**: Font size, weight, letter spacing, line height
- **Spacing**: Padding, margin, gaps
- **Borders**: Radius, width, style, color
- **Shadows**: Box shadows, text shadows, glow effects
- **Transforms**: Scale, rotate, translate
- **Effects**: Opacity, blur, filters

## OUTPUT FORMAT

Given an element's current state, return ONLY a JSON object with the exact CSS changes to apply. No explanations.

IMPORTANT RULES:
- Return ONLY valid JSON, nothing else
- Only include properties that need to change
- Use standard CSS values (e.g., "16px", "#ff0000", "bold", "8px 16px")
- For text changes, include a "text" property with the new text content
- BE BOLD with your changes - make them impactful!

Available properties you can modify:
- color (text color, use hex like #ffffff)
- backgroundColor (use hex like #000000 or gradients)
- fontSize (use px like 16px, 20px, 24px)
- fontWeight (normal, bold, 100-900)
- padding (use px like 8px or 8px 16px)
- margin (use px like 8px or 8px 16px)
- borderRadius (use px like 4px, 8px, 50%, 9999px)
- border (like 2px solid #ffffff)
- boxShadow (like 0 4px 20px rgba(0,0,0,0.3))
- textShadow (like 0 0 20px rgba(168, 85, 247, 0.8))
- backdropFilter (like blur(12px))
- text (the new text content if changing text)
- width (use px or %)
- height (use px or %)
- opacity (0 to 1)
- transform (like scale(1.1) or rotate(5deg))
- background (for gradients like linear-gradient(135deg, #ec4899, #8b5cf6))
- letterSpacing (like 0.05em, -0.02em)
- lineHeight (like 1.5, 2)

## EXAMPLE RESPONSES:

"make this button bigger and blue":
{"backgroundColor":"#2563eb","padding":"16px 32px","fontSize":"18px","boxShadow":"0 4px 20px rgba(37, 99, 235, 0.4)"}

"make it glass":
{"backgroundColor":"rgba(255, 255, 255, 0.1)","backdropFilter":"blur(12px)","border":"1px solid rgba(255, 255, 255, 0.2)","boxShadow":"0 8px 32px rgba(0, 0, 0, 0.3)"}

"make it pop with gradient":
{"background":"linear-gradient(135deg, #ec4899, #8b5cf6)","color":"#ffffff","boxShadow":"0 10px 40px rgba(236, 72, 153, 0.4)"}

"change text to Hello World":
{"text":"Hello World"}

"make it red and rounded":
{"backgroundColor":"#ef4444","borderRadius":"9999px","boxShadow":"0 4px 20px rgba(239, 68, 68, 0.4)"}

"make it neon":
{"backgroundColor":"#0f0f0f","color":"#00ffff","textShadow":"0 0 10px #00ffff, 0 0 20px #00ffff, 0 0 40px #00ffff","border":"2px solid #00ffff","boxShadow":"0 0 20px rgba(0, 255, 255, 0.5)"}

"make it smaller":
{"fontSize":"14px","padding":"4px 8px"}

"make it 3D":
{"boxShadow":"8px 8px 0px 0px rgba(0,0,0,1)","border":"3px solid #000000","transform":"translateY(-2px)"}

Remember: You are VIPE DZ. Make every change LEGENDARY! 🚀`;

    const userPrompt = `Element: <${elementInfo.tagName}>
Current text: "${elementInfo.text || "(no text)"}"
Current styles: ${JSON.stringify(currentStyles, null, 2)}

User instruction: "${instruction}"

Return ONLY the JSON object with CSS changes. Be BOLD and CREATIVE!:`;

    console.log("VIPE DZ Visual edit request:", { instruction, elementInfo });

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
          temperature: 0.7,
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
    
    console.log("VIPE DZ visual response:", content);

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
