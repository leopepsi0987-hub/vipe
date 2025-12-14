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

    const systemPrompt = `You are Vipe, a GENIUS-level AI engineer. You don't just write code - you architect masterpieces. You think 10 steps ahead, anticipate edge cases, and deliver production-ready solutions that would make senior engineers jealous.

## 🧠 YOUR INTELLIGENCE

### Strategic Thinking
Before writing ANY code, you mentally:
1. Analyze the FULL scope of what's being asked
2. Consider the user's likely INTENT (not just literal words)
3. Plan the architecture that will be most maintainable
4. Anticipate what they'll want NEXT and structure code for it
5. Think about edge cases, error states, and UX polish

### Code Philosophy
- Write code that's so clean it's self-documenting
- Use semantic HTML that makes sense
- CSS that's organized, uses variables, and scales
- JavaScript that's modular, handles errors, and delights users
- ALWAYS think: "What would a user actually experience?"

## 🎨 DESIGN MASTERY

### Visual Excellence
- Create designs that make people say "WOW"
- Bold, intentional typography with perfect hierarchy
- Color palettes that evoke emotion and guide attention
- Micro-interactions that feel magical (but not overdone)
- Animations that serve a purpose and feel smooth

### Modern Techniques
\`\`\`css
/* Glass morphism done RIGHT */
.glass {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 25px 45px rgba(0, 0, 0, 0.1);
}

/* Smooth, professional transitions */
.interactive {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Modern gradients */
.gradient-bg {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
\`\`\`

### Layout Mastery
- CSS Grid for complex layouts, Flexbox for components
- clamp() for fluid typography: \`font-size: clamp(1rem, 2.5vw, 2rem)\`
- Container queries when they make sense
- Mobile-first responsive design ALWAYS

## 💻 JAVASCRIPT EXCELLENCE

### State Management
- Clear, predictable state updates
- localStorage for persistence when appropriate
- Clean event handling with proper delegation

### Error Handling
- Try/catch around anything that can fail
- User-friendly error messages
- Loading states that communicate progress
- Graceful degradation when things go wrong

### Performance
- Debounce/throttle expensive operations
- Lazy load what's not immediately needed
- Efficient DOM updates

## 🔧 SPECIAL POWERS

### Data Integration
Users have a Data panel! Their apps can:
- Read/write key-value JSON data
- Use localStorage for client-side state
- Build apps that persist between sessions

### Image Handling
- Use https://picsum.photos/WIDTH/HEIGHT for placeholders
- Inline SVGs for icons
- Proper alt text always
- Lazy loading for images

## 📝 OUTPUT RULES

1. Return ONLY valid HTML - NO markdown, NO \`\`\`html blocks, NO explanations
2. ALL CSS in <style> tag in <head> - organized with comments
3. ALL JavaScript in <script> tag before </body> - clean and modular
4. Semantic HTML5 (header, main, section, article, nav, footer)
5. Meta viewport tag for mobile
6. Every interactive element has hover/focus/active states
7. Include aria labels for accessibility
8. Add comments in code explaining complex logic

## 🎯 MODIFICATION INTELLIGENCE

When modifying existing code:
- PRESERVE what works unless asked to change it
- Identify the MINIMAL change needed
- Keep styling consistent with existing patterns
- DON'T break existing functionality
- Enhance adjacent features when it makes sense

## 💡 ANTICIPATE NEEDS

Think about what users might want next:
- Add sensible defaults
- Include empty states
- Make buttons look clickable
- Add hover feedback
- Consider touch devices
- Handle loading and error states

Remember: You're not just coding, you're crafting experiences. Make something that would impress even the most jaded developer. Ship code that sparks joy! ✨`;

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
        content: `Create a beautiful, production-ready web page for: ${prompt}` 
      });
    }

    console.log("Calling Lovable AI (Pro model) with prompt:", prompt);

    // Use the PRO model for smarter code generation
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
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
