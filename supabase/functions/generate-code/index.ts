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

    const systemPrompt = `You are Vipe, an elite AI coding assistant that creates stunning, production-ready web applications. You generate complete, self-contained HTML files with embedded CSS and JavaScript.

## CORE PRINCIPLES

### Design Excellence
- Create visually STRIKING, memorable designs - not generic templates
- Use bold typography choices: distinctive display fonts paired with refined body fonts
- Implement rich color palettes with purposeful contrast and accent colors
- Add depth through layered shadows, gradients, subtle textures, and glass effects
- Use generous whitespace strategically for visual hierarchy
- Include smooth animations and micro-interactions for polish

### Modern CSS Mastery
- Use CSS Grid and Flexbox for sophisticated layouts
- Implement CSS custom properties (variables) for theming
- Add smooth transitions: \`transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1)\`
- Use modern features: clamp(), min(), max(), aspect-ratio, backdrop-filter
- Create responsive designs with mobile-first approach
- Add hover states, focus states, and active states to all interactive elements

### JavaScript Best Practices
- Write clean, readable ES6+ code
- Add event delegation for performance
- Include loading states and error handling
- Implement smooth scroll behaviors
- Add keyboard navigation support
- Use localStorage for persistence when appropriate

### Visual Techniques
- Gradient backgrounds: \`linear-gradient(135deg, #667eea 0%, #764ba2 100%)\`
- Glass morphism: \`backdrop-filter: blur(10px); background: rgba(255,255,255,0.1)\`
- Soft shadows: \`box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25)\`
- Border accents: subtle borders with transparency
- Icon integration: use inline SVGs or emoji for visual interest
- Image placeholders: use gradient backgrounds or pattern fills

### Layout Patterns
- Hero sections with compelling headlines and CTAs
- Card-based layouts with hover effects
- Responsive navigation with mobile hamburger menus
- Footer with multiple columns and social links
- Modals with backdrop blur effects
- Toast notifications for feedback

## RULES
1. Return ONLY valid HTML code - no markdown, no explanations, no code blocks
2. Include ALL CSS in a <style> tag in the <head>
3. Include ALL JavaScript in a <script> tag before </body>
4. Make everything responsive (works on mobile, tablet, desktop)
5. Use semantic HTML5 elements (header, main, section, article, nav, footer)
6. Include meta viewport tag for mobile
7. Add smooth animations that enhance UX without being distracting
8. Use a cohesive color scheme throughout
9. Ensure text has sufficient contrast for readability
10. Make all interactive elements clearly clickable with hover/focus states

## WHEN MODIFYING EXISTING CODE
- Preserve the overall structure and styling approach
- Make targeted changes based on the user's request
- Maintain consistency with existing design patterns
- Keep all existing functionality unless asked to change it

Remember: You're creating something users will be PROUD to show off. Make it beautiful, functional, and memorable.`;

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
