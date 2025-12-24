import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, projectId, currentFiles } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!GEMINI_API_KEY) {
      throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
    }

    const getGeminiModelCandidates = async (): Promise<Array<{ apiVersion: "v1beta" | "v1"; model: string }>> => {
      const parseModels = (json: any): string[] => {
        const models: Array<{ name?: string; supportedGenerationMethods?: string[] }> = json?.models ?? [];
        const supportsStream = (m: { name?: string; supportedGenerationMethods?: string[] }) =>
          (m.supportedGenerationMethods ?? []).includes("streamGenerateContent") ||
          (m.supportedGenerationMethods ?? []).includes("generateContent");

        return models
          .filter((m) => m?.name?.startsWith("models/") && supportsStream(m))
          .map((m) => (m.name as string).replace(/^models\//, ""));
      };

      const listOnce = async (apiVersion: "v1beta" | "v1") => {
        const url = `https://generativelanguage.googleapis.com/${apiVersion}/models`;
        const resp = await fetch(url, {
          method: "GET",
          headers: {
            "x-goog-api-key": GEMINI_API_KEY,
          },
        });
        if (!resp.ok) {
          const t = await resp.text();
          console.warn(`[generate-code] models.list failed (${apiVersion}):`, resp.status, t);
          return [] as string[];
        }
        const json = await resp.json();
        return parseModels(json);
      };

      // Try v1beta first, then v1.
      const beta = await listOnce("v1beta");
      const v1 = beta.length ? [] : await listOnce("v1");

      const available = beta.length ? beta : v1;
      const apiVersion: "v1beta" | "v1" = beta.length ? "v1beta" : "v1";

      const preferred = [
        // Prefer current Gemini 2.5 line first (most keys support these in v1beta).
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-2.5-flash-lite",
        // Older fallbacks (some keys/regions still expose these)
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-1.5-pro",
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b",
      ];

      const ordered = [...preferred.filter((m) => available.includes(m)), ...available.filter((m) => !preferred.includes(m))];

      // If listing fails entirely, fall back to common names (we'll still retry on 404).
      const fallback = preferred;
      const modelsToTry = ordered.length ? ordered : fallback;

      return modelsToTry.map((model) => ({ apiVersion, model }));
    };

    // Fetch user's connected Supabase if projectId provided
    let userSupabaseConnection: { url: string; anonKey: string } | null = null;
    
    if (projectId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data } = await supabase
        .from("project_data")
        .select("value")
        .eq("project_id", projectId)
        .eq("key", "supabase_connection")
        .maybeSingle();
      
      if (data?.value) {
        const conn = data.value as { url: string; anonKey?: string; connected: boolean };
        if (conn.connected && conn.url) {
          userSupabaseConnection = { url: conn.url, anonKey: conn.anonKey || "" };
          console.log("[generate-code] User has connected Supabase:", conn.url);
        }
      }
    }

    // Build file context string
    let fileContext = "";
    if (currentFiles && Object.keys(currentFiles).length > 0) {
      fileContext = "\n\n## CURRENT PROJECT FILES:\n";
      for (const [path, content] of Object.entries(currentFiles)) {
        fileContext += `\n### ${path}\n\`\`\`\n${content}\n\`\`\`\n`;
      }
    }

    // Check for matching template
    const matchingTemplate = findMatchingTemplate(prompt);
    const templateContext = generateTemplateContext();
    
    // ==========================================
    // SYSTEM PROMPT - STRICT JSON OUTPUT ONLY
    // ==========================================
    const systemPrompt = `You are an expert React/TypeScript developer. You generate COMPLETE, PRODUCTION-READY code.

${matchingTemplate ? `
## 🎯 TEMPLATE DETECTED: ${matchingTemplate.name}
Pattern: ${matchingTemplate.pattern}
Use the pre-built template files below as your starting point. Customize based on user requirements.

### Template Files to Use:
${JSON.stringify(matchingTemplate.files, null, 2)}

### Database Schema (if needed):
${matchingTemplate.dbSchema || 'No database required'}

IMPORTANT: Use this template as a base but customize names, colors, and content based on user's specific request.
` : templateContext}

## ⚠️ CRITICAL RULES - VIOLATION = FAILURE:

1. MINIMUM 200+ LINES OF CODE TOTAL across all files
2. MINIMUM 6 FILES - Always create separate files for types, hooks, utils, components, pages
3. NEVER put everything in App.tsx - App.tsx should ONLY import and render pages
4. Each component file should have 30-100+ lines of real code
5. Create BEAUTIFUL, DETAILED UI with proper styling

## MANDATORY FILE STRUCTURE:

src/types/index.ts        - All TypeScript interfaces
src/lib/utils.ts          - Utility functions (cn helper, formatters)
src/hooks/use*.ts         - Custom hooks for state/data
src/components/*.tsx      - ONE component per file (create 3-8 files)
src/pages/Index.tsx       - Main page (this has the main layout)
src/App.tsx               - ONLY imports pages, no logic here

## LANDING PAGE EXAMPLE (what you MUST generate for "build a landing page"):

{
  "files": [
    {
      "path": "src/types/index.ts",
      "action": "create",
      "content": "export interface NavItem {\\n  label: string;\\n  href: string;\\n}\\n\\nexport interface Feature {\\n  icon: string;\\n  title: string;\\n  description: string;\\n}\\n\\nexport interface Testimonial {\\n  name: string;\\n  role: string;\\n  content: string;\\n  avatar: string;\\n}\\n\\nexport interface PricingPlan {\\n  name: string;\\n  price: string;\\n  features: string[];\\n  popular?: boolean;\\n}"
    },
    {
      "path": "src/lib/utils.ts",
      "action": "create",
      "content": "import { type ClassValue, clsx } from 'clsx';\\nimport { twMerge } from 'tailwind-merge';\\n\\nexport function cn(...inputs: ClassValue[]) {\\n  return twMerge(clsx(inputs));\\n}"
    },
    {
      "path": "src/components/Navbar.tsx",
      "action": "create",
      "content": "import { Button } from '@/components/ui/button';\\nimport type { NavItem } from '@/types';\\n\\nconst navItems: NavItem[] = [\\n  { label: 'Features', href: '#features' },\\n  { label: 'Pricing', href: '#pricing' },\\n  { label: 'Testimonials', href: '#testimonials' },\\n  { label: 'Contact', href: '#contact' },\\n];\\n\\nexport function Navbar() {\\n  return (\\n    <nav className=\\"fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border\\">\\n      <div className=\\"max-w-7xl mx-auto px-4 sm:px-6 lg:px-8\\">\\n        <div className=\\"flex items-center justify-between h-16\\">\\n          <div className=\\"flex items-center gap-2\\">\\n            <div className=\\"w-8 h-8 bg-primary rounded-lg\\" />\\n            <span className=\\"text-xl font-bold text-foreground\\">Brand</span>\\n          </div>\\n          <div className=\\"hidden md:flex items-center gap-8\\">\\n            {navItems.map((item) => (\\n              <a\\n                key={item.label}\\n                href={item.href}\\n                className=\\"text-muted-foreground hover:text-foreground transition-colors\\"\\n              >\\n                {item.label}\\n              </a>\\n            ))}\\n          </div>\\n          <div className=\\"flex items-center gap-4\\">\\n            <Button variant=\\"ghost\\">Sign In</Button>\\n            <Button>Get Started</Button>\\n          </div>\\n        </div>\\n      </div>\\n    </nav>\\n  );\\n}"
    },
    {
      "path": "src/components/Hero.tsx",
      "action": "create",
      "content": "import { Button } from '@/components/ui/button';\\nimport { ArrowRight, Play } from 'lucide-react';\\n\\nexport function Hero() {\\n  return (\\n    <section className=\\"pt-32 pb-20 px-4\\">\\n      <div className=\\"max-w-7xl mx-auto text-center\\">\\n        <div className=\\"inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-8\\">\\n          <span className=\\"text-sm font-medium\\">🚀 New Feature Released</span>\\n        </div>\\n        <h1 className=\\"text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-tight\\">\\n          Build Something\\n          <span className=\\"text-primary\\"> Amazing</span>\\n          <br />Together\\n        </h1>\\n        <p className=\\"text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10\\">\\n          The all-in-one platform that helps teams collaborate, build, and ship products faster than ever before.\\n        </p>\\n        <div className=\\"flex flex-col sm:flex-row items-center justify-center gap-4\\">\\n          <Button size=\\"lg\\" className=\\"gap-2\\">\\n            Start Free Trial <ArrowRight className=\\"w-4 h-4\\" />\\n          </Button>\\n          <Button size=\\"lg\\" variant=\\"outline\\" className=\\"gap-2\\">\\n            <Play className=\\"w-4 h-4\\" /> Watch Demo\\n          </Button>\\n        </div>\\n        <div className=\\"mt-16 relative\\">\\n          <div className=\\"absolute inset-0 bg-gradient-to-t from-background to-transparent z-10\\" />\\n          <div className=\\"bg-card border border-border rounded-xl shadow-2xl p-4 max-w-4xl mx-auto\\">\\n            <div className=\\"aspect-video bg-muted rounded-lg flex items-center justify-center\\">\\n              <span className=\\"text-muted-foreground\\">Product Screenshot</span>\\n            </div>\\n          </div>\\n        </div>\\n      </div>\\n    </section>\\n  );\\n}"
    },
    {
      "path": "src/components/Features.tsx",
      "action": "create",
      "content": "import { Card, CardContent } from '@/components/ui/card';\\nimport { Zap, Shield, Globe, Layers, Users, BarChart } from 'lucide-react';\\nimport type { Feature } from '@/types';\\n\\nconst features: Feature[] = [\\n  { icon: 'Zap', title: 'Lightning Fast', description: 'Built for speed with optimized performance at every level.' },\\n  { icon: 'Shield', title: 'Secure by Default', description: 'Enterprise-grade security with end-to-end encryption.' },\\n  { icon: 'Globe', title: 'Global Scale', description: 'Deploy worldwide with our distributed infrastructure.' },\\n  { icon: 'Layers', title: 'Modular Design', description: 'Flexible architecture that grows with your needs.' },\\n  { icon: 'Users', title: 'Team Collaboration', description: 'Real-time collaboration tools for modern teams.' },\\n  { icon: 'BarChart', title: 'Analytics', description: 'Deep insights with comprehensive analytics dashboard.' },\\n];\\n\\nconst iconMap: Record<string, any> = { Zap, Shield, Globe, Layers, Users, BarChart };\\n\\nexport function Features() {\\n  return (\\n    <section id=\\"features\\" className=\\"py-20 px-4 bg-muted/30\\">\\n      <div className=\\"max-w-7xl mx-auto\\">\\n        <div className=\\"text-center mb-16\\">\\n          <h2 className=\\"text-3xl md:text-4xl font-bold text-foreground mb-4\\">\\n            Everything You Need\\n          </h2>\\n          <p className=\\"text-lg text-muted-foreground max-w-2xl mx-auto\\">\\n            Powerful features to help you build, deploy, and scale your applications.\\n          </p>\\n        </div>\\n        <div className=\\"grid md:grid-cols-2 lg:grid-cols-3 gap-6\\">\\n          {features.map((feature) => {\\n            const Icon = iconMap[feature.icon];\\n            return (\\n              <Card key={feature.title} className=\\"bg-card hover:shadow-lg transition-shadow\\">\\n                <CardContent className=\\"p-6\\">\\n                  <div className=\\"w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4\\">\\n                    <Icon className=\\"w-6 h-6 text-primary\\" />\\n                  </div>\\n                  <h3 className=\\"text-xl font-semibold text-foreground mb-2\\">{feature.title}</h3>\\n                  <p className=\\"text-muted-foreground\\">{feature.description}</p>\\n                </CardContent>\\n              </Card>\\n            );\\n          })}\\n        </div>\\n      </div>\\n    </section>\\n  );\\n}"
    },
    {
      "path": "src/components/Pricing.tsx",
      "action": "create",
      "content": "import { Button } from '@/components/ui/button';\\nimport { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';\\nimport { Check } from 'lucide-react';\\nimport { cn } from '@/lib/utils';\\nimport type { PricingPlan } from '@/types';\\n\\nconst plans: PricingPlan[] = [\\n  { name: 'Starter', price: '$9', features: ['5 Projects', '10GB Storage', 'Basic Analytics', 'Email Support'] },\\n  { name: 'Pro', price: '$29', features: ['Unlimited Projects', '100GB Storage', 'Advanced Analytics', 'Priority Support', 'API Access'], popular: true },\\n  { name: 'Enterprise', price: '$99', features: ['Everything in Pro', 'Unlimited Storage', 'Custom Integrations', 'Dedicated Support', 'SLA Guarantee'] },\\n];\\n\\nexport function Pricing() {\\n  return (\\n    <section id=\\"pricing\\" className=\\"py-20 px-4\\">\\n      <div className=\\"max-w-7xl mx-auto\\">\\n        <div className=\\"text-center mb-16\\">\\n          <h2 className=\\"text-3xl md:text-4xl font-bold text-foreground mb-4\\">Simple, Transparent Pricing</h2>\\n          <p className=\\"text-lg text-muted-foreground\\">Choose the plan that works best for you</p>\\n        </div>\\n        <div className=\\"grid md:grid-cols-3 gap-8 max-w-5xl mx-auto\\">\\n          {plans.map((plan) => (\\n            <Card key={plan.name} className={cn('relative', plan.popular && 'border-primary shadow-lg scale-105')}>\\n              {plan.popular && (\\n                <div className=\\"absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-sm rounded-full\\">\\n                  Most Popular\\n                </div>\\n              )}\\n              <CardHeader className=\\"text-center pb-4\\">\\n                <CardTitle className=\\"text-xl\\">{plan.name}</CardTitle>\\n                <div className=\\"mt-4\\">\\n                  <span className=\\"text-4xl font-bold text-foreground\\">{plan.price}</span>\\n                  <span className=\\"text-muted-foreground\\">/month</span>\\n                </div>\\n              </CardHeader>\\n              <CardContent>\\n                <ul className=\\"space-y-3 mb-6\\">\\n                  {plan.features.map((feature) => (\\n                    <li key={feature} className=\\"flex items-center gap-2\\">\\n                      <Check className=\\"w-5 h-5 text-primary\\" />\\n                      <span className=\\"text-muted-foreground\\">{feature}</span>\\n                    </li>\\n                  ))}\\n                </ul>\\n                <Button className=\\"w-full\\" variant={plan.popular ? 'default' : 'outline'}>\\n                  Get Started\\n                </Button>\\n              </CardContent>\\n            </Card>\\n          ))}\\n        </div>\\n      </div>\\n    </section>\\n  );\\n}"
    },
    {
      "path": "src/components/Footer.tsx",
      "action": "create",
      "content": "export function Footer() {\\n  return (\\n    <footer className=\\"py-12 px-4 border-t border-border\\">\\n      <div className=\\"max-w-7xl mx-auto\\">\\n        <div className=\\"grid md:grid-cols-4 gap-8\\">\\n          <div>\\n            <div className=\\"flex items-center gap-2 mb-4\\">\\n              <div className=\\"w-8 h-8 bg-primary rounded-lg\\" />\\n              <span className=\\"text-xl font-bold text-foreground\\">Brand</span>\\n            </div>\\n            <p className=\\"text-muted-foreground\\">Building the future of web development.</p>\\n          </div>\\n          <div>\\n            <h4 className=\\"font-semibold text-foreground mb-4\\">Product</h4>\\n            <ul className=\\"space-y-2 text-muted-foreground\\">\\n              <li><a href=\\"#\\" className=\\"hover:text-foreground transition-colors\\">Features</a></li>\\n              <li><a href=\\"#\\" className=\\"hover:text-foreground transition-colors\\">Pricing</a></li>\\n              <li><a href=\\"#\\" className=\\"hover:text-foreground transition-colors\\">Docs</a></li>\\n            </ul>\\n          </div>\\n          <div>\\n            <h4 className=\\"font-semibold text-foreground mb-4\\">Company</h4>\\n            <ul className=\\"space-y-2 text-muted-foreground\\">\\n              <li><a href=\\"#\\" className=\\"hover:text-foreground transition-colors\\">About</a></li>\\n              <li><a href=\\"#\\" className=\\"hover:text-foreground transition-colors\\">Blog</a></li>\\n              <li><a href=\\"#\\" className=\\"hover:text-foreground transition-colors\\">Careers</a></li>\\n            </ul>\\n          </div>\\n          <div>\\n            <h4 className=\\"font-semibold text-foreground mb-4\\">Legal</h4>\\n            <ul className=\\"space-y-2 text-muted-foreground\\">\\n              <li><a href=\\"#\\" className=\\"hover:text-foreground transition-colors\\">Privacy</a></li>\\n              <li><a href=\\"#\\" className=\\"hover:text-foreground transition-colors\\">Terms</a></li>\\n            </ul>\\n          </div>\\n        </div>\\n        <div className=\\"mt-12 pt-8 border-t border-border text-center text-muted-foreground\\">\\n          <p>&copy; 2024 Brand. All rights reserved.</p>\\n        </div>\\n      </div>\\n    </footer>\\n  );\\n}"
    },
    {
      "path": "src/pages/Index.tsx",
      "action": "create",
      "content": "import { Navbar } from '@/components/Navbar';\\nimport { Hero } from '@/components/Hero';\\nimport { Features } from '@/components/Features';\\nimport { Pricing } from '@/components/Pricing';\\nimport { Footer } from '@/components/Footer';\\n\\nexport default function Index() {\\n  return (\\n    <div className=\\"min-h-screen bg-background\\">\\n      <Navbar />\\n      <main>\\n        <Hero />\\n        <Features />\\n        <Pricing />\\n      </main>\\n      <Footer />\\n    </div>\\n  );\\n}"
    },
    {
      "path": "src/App.tsx",
      "action": "create",
      "content": "import Index from '@/pages/Index';\\n\\nfunction App() {\\n  return <Index />;\\n}\\n\\nexport default App;"
    }
  ],
  "message": "Created landing page with Navbar, Hero, Features, Pricing, Footer - 9 files total"
}

## IMPORT RULES:
- ALWAYS use @/ alias: import { Button } from "@/components/ui/button"
- NEVER use relative imports like "./components"
- Use existing shadcn components: Button, Card, Input, Badge, etc.

## STYLING RULES:
- Use Tailwind semantic tokens: bg-background, text-foreground, bg-primary, text-muted-foreground, border-border
- NEVER use hardcoded colors like bg-blue-500 or text-white

## EXISTING UI COMPONENTS (import from @/components/ui/):
button, card, input, checkbox, label, badge, dialog, tabs, select, textarea, switch, progress, skeleton, scroll-area, separator, avatar, dropdown-menu, tooltip, table, accordion

${userSupabaseConnection ? `User has Supabase connected at ${userSupabaseConnection.url}. Use @supabase/supabase-js for data.` : "No database. Use localStorage for persistence."}

${fileContext}

OUTPUT ONLY VALID JSON. Start with { end with }. NO markdown, NO explanations.`;

    const candidates = await getGeminiModelCandidates();

    let response: Response | null = null;
    let lastErrorText = "";

    for (const c of candidates) {
      const url = `https://generativelanguage.googleapis.com/${c.apiVersion}/models/${c.model}:streamGenerateContent?alt=sse`;
      console.log(`[generate-code] Trying Gemini model: ${c.model} (${c.apiVersion})`);

      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    "BUILD REQUEST: " +
                    prompt +
                    "\n\nRespond with ONLY JSON. No markdown. No explanations. Start with { end with }." ,
                },
              ],
            },
          ],
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 65536,
            responseMimeType: "application/json",
          },
        }),
      });

      if (r.ok) {
        response = r;
        break;
      }

      lastErrorText = await r.text().catch(() => "");
      console.warn(`[generate-code] Model ${c.model} failed:`, r.status, lastErrorText);

      // Try next model on 404/400 model-not-supported.
      if (r.status === 404 || r.status === 400) continue;

      // Surface rate limits immediately.
      if (r.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Other errors: stop early.
      return new Response(JSON.stringify({ error: "AI service error: " + lastErrorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!response) {
      return new Response(
        JSON.stringify({
          error:
            "AI service error: No available Gemini model supports streamGenerateContent for this API key. Last error: " +
            lastErrorText,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI service error: " + errorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Transform Gemini SSE format to OpenAI-compatible format for the frontend
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        const lines = text.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                const content = data.candidates[0].content.parts[0].text;
                const openAIFormat = {
                  choices: [{ delta: { content } }]
                };
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(openAIFormat)}\n\n`));
              }
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      }
    });

    return new Response(response.body?.pipeThrough(transformStream), {
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
