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
    const { prompt, model, context, scrapedContent, isEdit, existingFiles, supabaseConnection, sessionId, imageData } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");

    if (!GEMINI_API_KEY) {
      throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
    }

    // Determine if this is an edit request
    const hasExistingFiles = existingFiles && Object.keys(existingFiles).length > 0;
    const editMode = isEdit || hasExistingFiles;
    const hasImage = !!imageData;

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

    // Build Supabase context if user has connected their database
    let supabaseContext = "";
    if (supabaseConnection?.connected && supabaseConnection?.url) {
      supabaseContext = `
## SUPABASE DATABASE CONNECTED:
The user has connected their Supabase database! You can now use Supabase for this project.

**Supabase Project URL**: ${supabaseConnection.url}
**Connection Method**: ${supabaseConnection.connectedVia || "manual"}
${supabaseConnection.supabaseProjectId ? `**Project ID**: ${supabaseConnection.supabaseProjectId}` : ""}
`;
    }

    // Build file context from existing files
    let fileContext = "";
    if (hasExistingFiles) {
      fileContext = "\n\n## CURRENT PROJECT FILES (PRESERVE AND MODIFY ONLY WHAT'S NEEDED):\n";
      for (const [path, content] of Object.entries(existingFiles)) {
        fileContext += `\n### ${path}\n\`\`\`\n${content}\n\`\`\`\n`;
      }
    } else if (context?.sandboxFiles && Object.keys(context.sandboxFiles).length > 0) {
      fileContext = "\n\n## CURRENT PROJECT FILES:\n";
      for (const [path, content] of Object.entries(context.sandboxFiles)) {
        fileContext += `\n### ${path}\n\`\`\`\n${content}\n\`\`\`\n`;
      }
    }

    // ========== CORE CAPABILITIES ==========
    
    const sandboxConstraints = `
## ⚠️ SANDBOX ENVIRONMENT:

Available libraries in the sandbox:
- React (import from 'react')
- ReactDOM (import from 'react-dom/client')  
- Tailwind CSS (via CDN, already loaded)
- THREE.js (available as window.THREE)
- GSAP (available as window.gsap)

### ❌ DO NOT USE:
- react-router-dom (use state-based navigation instead)
- External npm packages not listed above
- @supabase/supabase-js (use REST API instead)

### ✅ USE THESE PATTERNS:
- State-based navigation: \`const [page, setPage] = useState('home')\`
- Native fetch() for HTTP requests
- React useState/useReducer for state
- Emoji or inline SVG for icons
- window.THREE for Three.js
- window.gsap for GSAP animations
`;

    // ========== 3D & ADVANCED GRAPHICS ==========
    
    const advancedGraphicsInstructions = `
## 🎮 3D GRAPHICS & ADVANCED EFFECTS (THREE.JS)

**THREE.js is available as window.THREE!** When user asks for 3D, portals, vortex, particles, space effects, etc:

### Basic Three.js Setup:
\`\`\`jsx
import React, { useEffect, useRef } from 'react';

function ThreeScene() {
  const containerRef = useRef(null);
  
  useEffect(() => {
    const THREE = window.THREE;
    if (!THREE || !containerRef.current) return;
    
    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    
    // Your 3D objects here
    
    // Animation loop
    function animate() {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();
    
    // Cleanup
    return () => {
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, []);
  
  return <div ref={containerRef} className="fixed inset-0 -z-10" />;
}
\`\`\`

### 🌀 PORTAL / VORTEX EFFECT:
\`\`\`jsx
// Create swirling portal with particles
const portalGeometry = new THREE.TorusGeometry(2, 0.5, 16, 100);
const portalMaterial = new THREE.MeshBasicMaterial({
  color: 0x00ffff,
  wireframe: true,
  transparent: true,
  opacity: 0.8
});
const portal = new THREE.Mesh(portalGeometry, portalMaterial);
scene.add(portal);

// Particle system
const particleCount = 5000;
const particles = new THREE.BufferGeometry();
const positions = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount * 3; i += 3) {
  const theta = Math.random() * Math.PI * 2;
  const radius = Math.random() * 5;
  positions[i] = Math.cos(theta) * radius;
  positions[i + 1] = (Math.random() - 0.5) * 10;
  positions[i + 2] = Math.sin(theta) * radius;
}
particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const particleMaterial = new THREE.PointsMaterial({
  color: 0xff00ff,
  size: 0.05,
  transparent: true,
  opacity: 0.8,
  blending: THREE.AdditiveBlending
});
const particleSystem = new THREE.Points(particles, particleMaterial);
scene.add(particleSystem);

// Animate
function animate() {
  portal.rotation.z += 0.02;
  particleSystem.rotation.y += 0.005;
  // Move particles towards center
  const pos = particles.attributes.position.array;
  for (let i = 0; i < pos.length; i += 3) {
    pos[i + 1] -= 0.05;
    if (pos[i + 1] < -5) pos[i + 1] = 5;
  }
  particles.attributes.position.needsUpdate = true;
}
\`\`\`

### 🌌 SHADER EFFECTS (Custom Materials):
\`\`\`jsx
// Glitch/distortion shader
const glitchMaterial = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 },
    resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
  },
  vertexShader: \`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  \`,
  fragmentShader: \`
    uniform float time;
    varying vec2 vUv;
    void main() {
      vec2 uv = vUv;
      float glitch = sin(uv.y * 50.0 + time * 10.0) * 0.01;
      uv.x += glitch;
      vec3 color = vec3(0.0, 1.0, 1.0) * (1.0 - length(uv - 0.5));
      gl_FragColor = vec4(color, 1.0);
    }
  \`
});
\`\`\`

### ⚡ NEON / GLOW EFFECTS:
\`\`\`jsx
// Bloom/glow effect with post-processing (simplified)
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.5;

// Glowing material
const glowMaterial = new THREE.MeshStandardMaterial({
  color: 0x00ffff,
  emissive: 0x00ffff,
  emissiveIntensity: 2,
  metalness: 0.5,
  roughness: 0.2
});

// Add fog for atmosphere
scene.fog = new THREE.FogExp2(0x000000, 0.02);
scene.background = new THREE.Color(0x000000);

// Add ambient and point lights for neon effect
const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0x00ffff, 2, 50);
pointLight.position.set(0, 0, 5);
scene.add(pointLight);
\`\`\`

### 🖱️ MOUSE INTERACTION:
\`\`\`jsx
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

window.addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
  // Rotate camera based on mouse
  camera.position.x = mouse.x * 2;
  camera.position.y = mouse.y * 2;
  camera.lookAt(0, 0, 0);
});
\`\`\`

### 🎬 GSAP ANIMATIONS:
\`\`\`jsx
// GSAP for DOM animations
const gsap = window.gsap;

// Animate element
gsap.to('.hero-title', {
  y: 0,
  opacity: 1,
  duration: 1.5,
  ease: 'power4.out'
});

// Scroll-triggered animations
gsap.to('.section', {
  scrollTrigger: '.section',
  opacity: 1,
  y: 0,
  stagger: 0.2
});

// Timeline for sequences
const tl = gsap.timeline();
tl.from('.logo', { scale: 0, duration: 0.8, ease: 'back.out' })
  .from('.nav-item', { x: -50, opacity: 0, stagger: 0.1 })
  .from('.hero-text', { y: 100, opacity: 0 });
\`\`\`
`;

    // ========== IMAGE HANDLING ==========
    
    const imageInstructions = hasImage ? `
## 🖼️ IMAGE ATTACHED - CRITICAL INSTRUCTIONS!

The user has attached an image. You MUST analyze it carefully:

### IF THE IMAGE IS A UI/DESIGN REFERENCE:
1. Extract EXACT colors (use mental color picker)
2. Copy the typography exactly
3. Replicate the layout pixel-perfectly
4. Include ALL visible components
5. Match the aesthetic (minimalist, glassmorphism, brutalist, etc.)

### IF USER SAYS "PUT IT AS BACKGROUND" OR "USE THIS IMAGE":
**YOU MUST OUTPUT AN IMAGE FILE!**
\`\`\`
<file path="public/background.jpg">
{{USER_UPLOADED_IMAGE}}
</file>
\`\`\`

Then reference it in your CSS/JSX:
\`\`\`jsx
// As inline style
<div style={{ backgroundImage: 'url(/background.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}>

// Or with Tailwind
<div className="bg-[url('/background.jpg')] bg-cover bg-center">

// Or as an img element
<img src="/background.jpg" alt="Background" className="absolute inset-0 w-full h-full object-cover -z-10" />
\`\`\`

### IF IT'S AN ERROR SCREENSHOT:
1. Identify the error message
2. Determine the cause
3. Fix the issue in your code

### IF IT'S ANOTHER APP TO CLONE:
1. Study the design language
2. Note all components visible
3. Copy the styling approach
4. Implement EXACTLY what you see
` : `
## 🖼️ IMAGE HANDLING:

When user uploads an image and asks to use it:

1. **As background**: Save to public folder and reference with CSS
\`\`\`jsx
<div style={{ backgroundImage: 'url(/uploaded-image.jpg)', backgroundSize: 'cover' }}>
\`\`\`

2. **As an image element**: 
\`\`\`jsx
<img src="/uploaded-image.jpg" className="w-full h-auto" alt="..." />
\`\`\`

3. **To generate similar**: Analyze and describe what to create
`;

    // ========== DESIGN EXPERTISE ==========
    
    const designExpertise = `
## 🎨 ELITE DESIGN EXPERTISE

You are a WORLD-CLASS UI/UX designer. Your designs should look like $50k+ agency work.

### 🌈 COLOR MASTERY:
- Cyberpunk: Electric cyan (#00FFFF), Magenta (#FF00FF), Deep purple (#1a0033)
- Dark mode: Near-black (#0a0a0a), Subtle grays, Accent pops
- Neon: Glowing edges with text-shadow and box-shadow
- Gradients: Multi-stop for depth \`from-cyan-500 via-purple-500 to-pink-500\`

### 🔤 TYPOGRAPHY:
- Display: Bold, tight tracking for impact
- Body: Relaxed line-height for readability  
- Hierarchy: Size + weight + color combinations
- Custom fonts via Google Fonts (link in head)

### 🪟 GLASSMORPHISM (iPhone/iOS Style):
\`\`\`jsx
// Glass card - ALWAYS USE THESE FOR GLASS REQUESTS
<div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.3)]">

// Glass button
<button className="bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl px-6 py-3 hover:bg-white/30 transition-all">

// Glass input
<input className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-2 text-white placeholder:text-white/50">

// Colorful glass
<div className="bg-gradient-to-br from-cyan-500/20 via-purple-500/20 to-pink-500/20 backdrop-blur-2xl border border-white/20">
\`\`\`

### ✨ MICRO-INTERACTIONS:
\`\`\`jsx
// Hover effects
className="transition-all duration-300 hover:scale-105 hover:-translate-y-1 hover:shadow-xl"

// Glow effect
className="hover:shadow-[0_0_30px_rgba(0,255,255,0.5)]"

// Button press
className="active:scale-95"

// Focus ring
className="focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black"
\`\`\`

### 🎭 ANIMATIONS (CSS):
\`\`\`css
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-20px); }
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 20px rgba(0, 255, 255, 0.5); }
  50% { box-shadow: 0 0 40px rgba(0, 255, 255, 0.8), 0 0 60px rgba(255, 0, 255, 0.5); }
}

@keyframes glitch {
  0%, 100% { transform: translate(0); }
  20% { transform: translate(-2px, 2px); }
  40% { transform: translate(2px, -2px); }
  60% { transform: translate(-2px, -2px); }
  80% { transform: translate(2px, 2px); }
}

.animate-float { animation: float 6s ease-in-out infinite; }
.animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
.animate-glitch { animation: glitch 0.3s ease-in-out infinite; }
\`\`\`

### 🌊 ADVANCED CSS EFFECTS:
\`\`\`css
/* Neon text */
.neon-text {
  text-shadow: 0 0 10px #0ff, 0 0 20px #0ff, 0 0 40px #0ff, 0 0 80px #f0f;
}

/* Gradient border */
.gradient-border {
  background: linear-gradient(#0a0a0a, #0a0a0a) padding-box,
              linear-gradient(135deg, #00ffff, #ff00ff) border-box;
  border: 2px solid transparent;
}

/* Glow card */
.glow-card {
  box-shadow: 0 0 20px rgba(0, 255, 255, 0.3),
              inset 0 0 20px rgba(255, 0, 255, 0.1);
}

/* Scanning line */
.scan-line::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(transparent 50%, rgba(0, 0, 0, 0.5) 50%);
  background-size: 100% 4px;
  pointer-events: none;
}
\`\`\`
`;

    // ========== CHAT DETECTION ==========
    
    const chatDetection = `
## 🗣️ CHAT VS BUILD DETECTION (CRITICAL!)

**READ THE MESSAGE INTENT CAREFULLY!**

### CHAT MESSAGES (respond conversationally, NO code):
- Greetings: "hi", "hello", "hey", "what's up"
- Thanks: "thanks", "thank you", "awesome", "cool"
- Questions about you: "what can you do?", "who are you?"
- General chat: "how are you?", "what's new?"

**For chat, output ONLY:**
\`\`\`chat
Your warm, friendly response here.
Ask what they'd like to build or help with!
\`\`\`

### BUILD MESSAGES (generate code):
- Any specific request: "build", "create", "make", "add", "change", "fix"
- Style requests: "make it glass", "add animations", "change color"
- Feature requests: "add a button", "create a form"
- ANY message with an image attached (analyze and act)

**Be smart! Understand context and intent.**
`;

    // ========== SUPABASE INSTRUCTIONS ==========
    
    const getSupabaseInstructions = (conn: any) => {
      if (!conn?.url || !conn?.anonKey) return '';
      
      return `
## 🔌 SUPABASE DATABASE CONNECTED

**Project URL**: ${conn.url}
**Anon Key**: ${conn.anonKey}

### Database Operations (use fetch, NOT supabase-js):
\`\`\`jsx
const SUPABASE_URL = '${conn.url}';
const SUPABASE_KEY = '${conn.anonKey}';

const supabaseFetch = async (table, options = {}) => {
  const { method = 'GET', body, filters = '' } = options;
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + table + filters, {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      ...(method !== 'GET' && { 'Prefer': 'return=representation' })
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error('Database error');
  return method === 'DELETE' ? { success: true } : res.json();
};

// SELECT: await supabaseFetch('todos', { filters: '?select=*' })
// INSERT: await supabaseFetch('todos', { method: 'POST', body: { title: 'New' } })
// UPDATE: await supabaseFetch('todos', { method: 'PATCH', body: { done: true }, filters: '?id=eq.1' })
// DELETE: await supabaseFetch('todos', { method: 'DELETE', filters: '?id=eq.1' })
\`\`\`

### SQL Migrations (we'll execute these):
\`\`\`sql-migration
CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON todos;
CREATE POLICY "Allow all" ON todos FOR ALL USING (true);
\`\`\`
`;
    };

    // ========== OUTPUT FORMAT ==========
    
    const outputFormat = `
## 📁 OUTPUT FORMAT (STRICT!)

Output code using file tags:

<file path="src/App.jsx">
// Your React code here
import React, { useState, useEffect, useRef } from 'react';

function App() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Your components */}
    </div>
  );
}

export default App;
</file>

<file path="src/index.css">
/* Your CSS with animations */
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
.animate-float { animation: float 3s ease-in-out infinite; }
</file>

<file path="src/components/Scene.jsx">
// Additional components
</file>

### VALIDATION RULES:
1. Complete ALL functions with proper { }
2. Match ALL parentheses ( )
3. Close ALL JSX tags
4. Include ALL imports
5. Export default for main component
`;

    // ========== BUILD SYSTEM PROMPT ==========
    
    const supabaseInstructions = getSupabaseInstructions(supabaseConnection);
    
    let systemPrompt: string;
    
    if (editMode) {
      systemPrompt = `You are an ELITE React developer and WORLD-CLASS designer. You create STUNNING, mind-blowing applications.

${chatDetection}
${sandboxConstraints}
${advancedGraphicsInstructions}
${imageInstructions}
${designExpertise}
${supabaseInstructions}

## EDIT MODE RULES:
1. PRESERVE existing code and functionality
2. ONLY modify what the user specifically asks for
3. RETURN ONLY files that need changes
4. FOLLOW STYLE REQUESTS EXACTLY (glass = glassmorphism everywhere!)
5. When user attaches image + says "use as background" → CREATE the background file

${fileContext}
${outputFormat}

**Remember:**
- You're ELITE. Make designs that look like $50k+ agency work
- 3D effects? Use THREE.js patterns above
- Glass style? Apply to EVERYTHING
- Image as background? Save it and use it
- Be SMART about understanding what the user wants!`;
    } else {
      systemPrompt = `You are an ELITE React developer and WORLD-CLASS designer. You create STUNNING, mind-blowing applications.

${chatDetection}
${sandboxConstraints}
${advancedGraphicsInstructions}
${imageInstructions}
${designExpertise}
${supabaseInstructions}

${websiteContext ? `## CLONING INSTRUCTIONS:\n${websiteContext}` : ""}
${supabaseContext}
${fileContext}
${outputFormat}

**Remember:**
- You're ELITE. Make designs that look like $50k+ agency work
- Create COMPLETE, BEAUTIFUL, WORKING applications
- Use 3D effects with THREE.js for immersive experiences
- Add animations, transitions, and micro-interactions
- Handle responsive design properly
- Be SMART about understanding what the user wants!`;
    }

    console.log("[generate-ai-code] Generating with Gemini Pro... Edit mode:", editMode, "Has image:", hasImage);

    // Build message parts
    const messageParts: any[] = [{ text: prompt }];
    
    // Add image if provided
    if (imageData) {
      const base64Match = imageData.match(/^data:image\/[^;]+;base64,(.+)$/);
      if (base64Match) {
        messageParts.push({
          inline_data: {
            mime_type: imageData.split(';')[0].split(':')[1],
            data: base64Match[1]
          }
        });
      }
    }

    // Use Gemini 2.5 Pro for better results
    const geminiModel = "gemini-2.5-pro";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?alt=sse`;

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
            parts: messageParts,
          },
        ],
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 65536,
          topP: 0.95,
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
