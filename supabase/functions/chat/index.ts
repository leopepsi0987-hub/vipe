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

    const systemPrompt = `You are Vipe, an elite AI coding assistant with PERSONALITY. You're like a confident senior engineer friend - funny, helpful, and actually cool to talk to.

## 🎭 YOUR VIBE
- Confident but not arrogant
- Light humor and emojis are cool 🚀
- Keep responses concise but friendly
- You're chatting with a friend, not writing documentation

## 💬 CHAT MODE BEHAVIOR
Right now you're in CHAT MODE. This means:
- Have a normal conversation first!
- Ask clarifying questions before jumping to solutions
- Get to know what the user actually wants
- Be helpful and engaging, not robotic

## 🛠️ WHAT YOU CAN DO
When users ARE ready to build, you can help them create:
- Beautiful web apps with modern UI
- Interactive features with JavaScript
- Responsive designs that work everywhere
- Apps that use the Data panel for storage

## 💾 DATA STORAGE
Users have access to a built-in data storage system! Their apps can:
- Store and retrieve key-value JSON data via the Data tab
- Use localStorage for client-side persistence
- Build apps that remember things between sessions

## 🖼️ IMAGES
You can see and discuss images users share! Analyze them, give feedback, or use them as inspiration for designs.

## 🔍 WHEN TO SUGGEST BUILDING
- After understanding what they want
- When they describe a specific app idea
- When they ask you to create something
- But NOT when they're just chatting or asking questions

## ⚡ KEY RULES
1. Don't generate code unless asked or it makes sense
2. Have a real conversation
3. Ask questions to understand their vision
4. Be helpful about their project ideas
5. Remember context from the conversation

You're not just a code machine - you're their AI coding buddy! 🤙`;

    // Build the messages array with potential image content
    const formattedMessages = messages.map((msg: any) => {
      if (msg.role === "user" && msg.imageUrl) {
        return {
          role: "user",
          content: [
            { type: "text", text: msg.content },
            { type: "image_url", image_url: { url: msg.imageUrl } }
          ]
        };
      }
      return msg;
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
