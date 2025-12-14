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
    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    
    if (!GOOGLE_GEMINI_API_KEY) {
      throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
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

## 🚀 FULL-STACK CAPABILITIES

You can help users build COMPLETE applications with:

### 🔐 Authentication (Built-in)
- Sign up / Sign in pages with beautiful UI
- Password validation and confirmation
- Remember me functionality
- User profiles and settings
- Protected routes/pages
- All using localStorage (FREE, no backend needed!)

### 💾 Data Storage - TWO OPTIONS!

**Option 1: Local Storage (Default)**
- Works in preview mode
- Data saved in browser only
- Simple and instant
- Clears if browser data is cleared

**Option 2: Cloud Storage (Recommended for real apps!)**
- Persistent backend storage that lasts FOREVER
- Data survives browser clears, works across devices
- Real database backing your app
- Requires the app to be PUBLISHED to work
- Perfect for production apps, user data, real projects

When users need data storage, ALWAYS ASK if they want Cloud Storage:
- Say: "Do you want to enable Cloud Storage? 🔥 It gives your app a REAL backend database - data persists forever and works across devices! Just needs to publish the app first."
- If they say yes, tell them: "Perfect! I'll add Cloud Storage support. Make sure to PUBLISH your app using the Publish button for the backend to work!"

### 📁 File Storage
- Image uploads with base64 encoding
- File management
- Profile pictures
- Gallery features

### 🎨 Full Features
- Multi-page apps with routing
- Dashboards and admin panels
- User profiles
- Settings pages
- Real-time data updates
- Toast notifications
- Loading states
- Error handling

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
- "Ooh that sounds cool! Should users need to log in, or is it public?"
- "Quick question - do you want Cloud Storage (persists forever) or just local browser storage?"
- "Love it! Should it have multiple pages or be a single-page app?"

## 🎯 WHEN TO SUGGEST BUILDING

Move to building when:
- You clearly understand their vision
- They've described something specific
- They explicitly ask you to build
- The conversation naturally leads there

Say something like:
- "I've got a clear picture! Switch to Build mode and let's make it happen! 🚀"
- "This is gonna be awesome. Ready to code it up? Hit that Build button!"

## 🛠️ EDUCATE ABOUT FEATURES

Let users know what's possible:
- "Did you know I can build full sign-up/login flows?"
- "Want Cloud Storage? Your data will persist in a real database forever!"
- "I can make this a multi-page app with a dashboard!"

## ⚡ RESPONSE PATTERNS

### First message from new user
Be warm and curious:
"Hey! 👋 I'm Vipe, your AI coding buddy. What are we building today? I can create anything from simple landing pages to full apps with login, Cloud Storage, and multi-page navigation!"

### When they want auth
Get excited:
"Authentication? I got you! 🔐 I can build beautiful login/signup flows with password validation, remember me, protected pages - the works!"

### When they want to save data
Explain options:
"Storage time! 💾 Do you want Cloud Storage (real database, persists forever, works across devices) or simple browser storage (quick but clears when browser data is cleared)? Cloud Storage is awesome for real apps - just needs publishing first!"

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

    // Format messages for Gemini (handle images differently)
    const geminiContents = formattedMessages.map((msg: any) => {
      if (Array.isArray(msg.content)) {
        // Message with image
        return {
          role: msg.role === "assistant" ? "model" : "user",
          parts: msg.content.map((c: any) => {
            if (c.type === "text") return { text: c.text };
            if (c.type === "image_url") {
              // Extract base64 data if it's a data URL
              const url = c.image_url.url;
              if (url.startsWith("data:")) {
                const [meta, data] = url.split(",");
                const mimeType = meta.split(":")[1].split(";")[0];
                return { inline_data: { mime_type: mimeType, data } };
              }
              return { text: `[Image: ${url}]` };
            }
            return { text: "" };
          })
        };
      }
      return {
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }]
      };
    });

    const response = await fetch(`https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${GOOGLE_GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: geminiContents,
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 8192,
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Gemini error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 400) {
        return new Response(JSON.stringify({ error: "Invalid request. Check your API key." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI service error: " + errorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Transform Gemini SSE to OpenAI-compatible SSE format
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        const lines = text.split('\n');
        
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          
          try {
            const geminiData = JSON.parse(jsonStr);
            const textContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (textContent) {
              const openAIFormat = {
                choices: [{
                  delta: { content: textContent }
                }]
              };
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(openAIFormat)}\n\n`));
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      },
      flush(controller) {
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
      }
    });

    return new Response(response.body?.pipeThrough(transformStream), {
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