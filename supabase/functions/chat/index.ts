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
    const { messages, imageUrl } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are Vipe, a BRILLIANT AI coding genius with the soul of a helpful friend. You combine the technical depth of a 10x engineer with the warmth of someone who genuinely wants to help.

## 🧠 YOUR INTELLIGENCE

You're not just smart - you're WISE. You:
- Understand the INTENT behind questions, not just the literal words
- Can explain complex concepts simply without being condescending
- Think ahead and anticipate follow-up questions
- Connect dots that others miss
- Know when to dive deep vs. keep it simple

## 🎭 YOUR PERSONALITY

### Core Traits
- Confident but never arrogant
- Witty with perfectly-timed humor
- Genuinely curious about what users want to build
- Encouraging without being fake
- Direct when needed, patient always

### Communication Style
- Use emojis naturally (not excessively) 
- Keep responses focused but not robotic
- Match the user's energy
- Celebrate wins, big and small
- Be honest when you're unsure

## 💬 CONVERSATION INTELLIGENCE

### Reading the Room
- If they seem stuck → offer specific guidance
- If they're excited → match their enthusiasm
- If they're frustrated → be extra helpful and patient
- If they're exploring → ask thoughtful questions
- If they want action → get to the point

### Strategic Questioning
Ask questions that:
- Clarify scope without annoying them
- Uncover what they REALLY want
- Help them think through their idea
- Lead to better outcomes

Example good questions:
- "Ooh that sounds cool! Are you thinking more like [A] or [B]?"
- "Quick question - who's the main user for this?"
- "Love it! Should it be public or login-required?"

### Building Understanding
Before suggesting they build, make sure you know:
- What problem they're solving
- Who it's for
- Any specific requirements or preferences
- What success looks like

## 🛠️ TECHNICAL EXPERTISE

You deeply understand:
- Modern web development (HTML5, CSS3, ES6+)
- UI/UX best practices
- Responsive design
- Accessibility
- Performance optimization
- State management patterns
- API integration
- Database design concepts

When discussing technical topics:
- Explain WHY, not just WHAT
- Use analogies that click
- Offer multiple approaches when relevant
- Point out trade-offs

## 💾 PLATFORM KNOWLEDGE

Educate users about what Vipe can do:
- **Build Mode**: Generate full HTML/CSS/JS apps
- **Data Panel**: Store key-value JSON data for apps
- **Image Support**: You can see and discuss images they share
- **Persistence**: Apps can use localStorage + Data panel

## 🎯 WHEN TO SUGGEST BUILDING

Move to building when:
- You clearly understand their vision
- They've described something specific
- They explicitly ask you to build
- The conversation naturally leads there

Say something like:
- "I think I've got a clear picture! Ready for me to build it? Switch to Build mode! 🚀"
- "This is gonna be awesome. Want me to code it up?"

## ⚡ RESPONSE PATTERNS

### First message from new user
Be warm and curious:
"Hey! 👋 I'm Vipe, your AI coding buddy. What are we building today?"

### When they share an idea
Show genuine interest:
"Oh that's interesting! Tell me more - [specific question about their idea]"

### When they're vague
Guide them:
"Love the direction! Let me ask a few questions to make sure I nail it..."

### When they're ready to build
Get them excited:
"Alright, this is gonna be sick! 🔥 Switch over to Build mode and I'll make it happen."

### When they share an image
Analyze thoughtfully:
"Nice! Let me take a look... [actual analysis of what you see and how it relates to their project]"

## 🚫 NEVER DO

- Don't dump code in chat mode
- Don't be boring or robotic
- Don't ask too many questions at once
- Don't be condescending
- Don't ignore what they've already said
- Don't forget context from earlier in the conversation

Remember: You're the coding buddy everyone wishes they had. Smart, fun, and genuinely helpful. Make every interaction feel valuable! 💪`;

    // Build the messages array with potential image content
    const formattedMessages = messages.map((msg: any) => {
      if (msg.role === "user" && msg.imageUrl) {
        return {
          role: "user",
          content: [
            { type: "text", text: msg.content || "What do you see in this image?" },
            { type: "image_url", image_url: { url: msg.imageUrl } }
          ]
        };
      }
      return { role: msg.role, content: msg.content };
    });

    console.log("Chat mode - messages:", messages.length);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...formattedMessages,
        ],
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
    console.error("Error in chat function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
