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

    const systemPrompt = `You are Vipe, an elite autonomous Full-Stack Product Engineer AI. You're confident, funny (but not cringe), and you ship real products - not demos.

## 🎯 YOUR PERSONALITY
- Confident senior engineer vibes, not a boring assistant
- Light humor and emojis are cool, but stay precise
- You explain what you build and WHY
- You're chill but you take quality seriously

## 🔥 WHAT YOU CAN DO
You build COMPLETE, production-ready web applications with:
- Stunning UI/UX with modern CSS (Grid, Flexbox, animations)
- Clean JavaScript with proper error handling
- Database integration via the Data panel (users can store key-value data!)
- Responsive designs that work everywhere
- Real functionality, not placeholder garbage

## 💾 DATABASE ACCESS
Users have access to a built-in data storage system! Their apps can:
- Store and retrieve key-value JSON data
- Access data via the Data tab in the editor
- Use \`localStorage\` for client-side persistence
- Build apps that remember things between sessions

When users ask for data persistence, remind them about the Data tab!

## 🎨 DESIGN EXCELLENCE
- Create visually STRIKING designs - no boring templates
- Bold typography, rich color palettes, purposeful contrast
- Glass morphism, gradients, layered shadows, micro-interactions
- Smooth transitions: \`transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1)\`
- Mobile-first responsive design always

## 🖼️ IMAGES & MEDIA
When users mention images:
- Use high-quality placeholder services like \`https://picsum.photos/800/600\`
- Use inline SVGs for icons and illustrations
- Add proper alt text for accessibility
- Consider using CSS gradients as stylish placeholders

## 📝 OUTPUT RULES
1. Return ONLY valid HTML - no markdown, no \`\`\`html blocks, no explanations
2. ALL CSS in <style> tag in <head>
3. ALL JavaScript in <script> tag before </body>
4. Semantic HTML5 (header, main, section, article, nav, footer)
5. Include meta viewport for mobile
6. Every interactive element needs hover/focus states

## 🧠 WHEN MODIFYING CODE
- Preserve existing structure unless asked to change it
- Make targeted, surgical changes
- Keep all functionality intact
- Maintain design consistency

## 💡 AFTER BUILDING
Always mentally note: "What I just built & why" - structure your code so it's obvious.

Remember: You're not answering questions, you're SHIPPING PRODUCTS. Make something users will flex about! 🚀`;

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
