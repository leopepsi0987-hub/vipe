/**
 * VIPE DZ AI - Library Knowledge Base
 * This file documents all available libraries and how to use them
 * Your AI should reference this when generating code
 */

export const LIBRARY_KNOWLEDGE = {
  // ============================================
  // UI & COMPONENT LIBRARIES
  // ============================================
  
  shadcnUI: {
    name: "shadcn/ui",
    installed: true,
    description: "Beautiful, accessible components built with Radix UI and Tailwind CSS",
    usage: `
// Components are in src/components/ui/
// Import like this:
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";

// Usage:
<Button variant="default" size="lg">Click me</Button>
<Button variant="outline">Outline</Button>
<Button variant="destructive">Delete</Button>
    `,
    components: [
      "accordion", "alert", "alert-dialog", "aspect-ratio", "avatar", "badge",
      "breadcrumb", "button", "calendar", "card", "carousel", "chart", "checkbox",
      "collapsible", "command", "context-menu", "dialog", "drawer", "dropdown-menu",
      "form", "hover-card", "input", "input-otp", "label", "menubar", "navigation-menu",
      "pagination", "popover", "progress", "radio-group", "resizable", "scroll-area",
      "select", "separator", "sheet", "sidebar", "skeleton", "slider", "sonner",
      "switch", "table", "tabs", "textarea", "toast", "toggle", "toggle-group", "tooltip"
    ]
  },

  radixUI: {
    name: "Radix UI",
    installed: true,
    description: "Low-level UI primitives with accessibility built-in",
    usage: `
// Already used by shadcn/ui components
// Direct usage:
import * as Dialog from "@radix-ui/react-dialog";
import * as Popover from "@radix-ui/react-popover";
import * as Select from "@radix-ui/react-select";
    `
  },

  // ============================================
  // ANIMATION LIBRARIES
  // ============================================
  
  framerMotion: {
    name: "Framer Motion",
    installed: true,
    description: "Production-ready motion library for React",
    usage: `
import { motion, AnimatePresence } from "framer-motion";

// Basic animation
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
  transition={{ duration: 0.3 }}
>
  Content
</motion.div>

// Hover/tap animations
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
>
  Click me
</motion.button>

// List animations
<AnimatePresence>
  {items.map(item => (
    <motion.li
      key={item.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      layout
    >
      {item.name}
    </motion.li>
  ))}
</AnimatePresence>

// Variants for complex animations
const variants = {
  hidden: { opacity: 0, x: -100 },
  visible: { opacity: 1, x: 0 }
};

<motion.div variants={variants} initial="hidden" animate="visible" />
    `
  },

  reactSpring: {
    name: "React Spring",
    installed: true,
    description: "Spring-physics based animation library",
    usage: `
import { useSpring, animated } from "react-spring";

// Basic spring animation
const springs = useSpring({
  from: { opacity: 0 },
  to: { opacity: 1 }
});

<animated.div style={springs}>Content</animated.div>

// With config
const props = useSpring({
  to: { number: 100 },
  from: { number: 0 },
  config: { tension: 200, friction: 20 }
});
    `
  },

  // ============================================
  // STATE MANAGEMENT
  // ============================================
  
  zustand: {
    name: "Zustand",
    installed: true,
    description: "Small, fast, scalable state management",
    usage: `
// Create a store (src/stores/useStore.ts)
import { create } from "zustand";

interface AppState {
  count: number;
  user: User | null;
  increment: () => void;
  setUser: (user: User) => void;
}

export const useAppStore = create<AppState>((set) => ({
  count: 0,
  user: null,
  increment: () => set((state) => ({ count: state.count + 1 })),
  setUser: (user) => set({ user })
}));

// With persistence
import { persist } from "zustand/middleware";

export const usePersistedStore = create(
  persist<AppState>(
    (set) => ({
      count: 0,
      user: null,
      increment: () => set((state) => ({ count: state.count + 1 })),
      setUser: (user) => set({ user })
    }),
    { name: "app-storage" }
  )
);

// Usage in component
function Counter() {
  const { count, increment } = useAppStore();
  return <button onClick={increment}>{count}</button>;
}
    `
  },

  jotai: {
    name: "Jotai",
    installed: true,
    description: "Primitive and flexible state management",
    usage: `
import { atom, useAtom } from "jotai";

// Create atoms
const countAtom = atom(0);
const doubleAtom = atom((get) => get(countAtom) * 2);

// Writable derived atom
const incrementAtom = atom(
  (get) => get(countAtom),
  (get, set) => set(countAtom, get(countAtom) + 1)
);

// Usage
function Counter() {
  const [count, setCount] = useAtom(countAtom);
  const [double] = useAtom(doubleAtom);
  
  return (
    <div>
      <span>{count} (double: {double})</span>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  );
}
    `
  },

  tanstackQuery: {
    name: "TanStack Query",
    installed: true,
    description: "Powerful data fetching and caching",
    usage: `
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Fetching data
const { data, isLoading, error } = useQuery({
  queryKey: ["users"],
  queryFn: () => fetch("/api/users").then(r => r.json())
});

// With parameters
const { data } = useQuery({
  queryKey: ["user", userId],
  queryFn: () => fetchUser(userId),
  enabled: !!userId
});

// Mutations
const queryClient = useQueryClient();
const mutation = useMutation({
  mutationFn: (newUser) => createUser(newUser),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
  }
});

// Usage
mutation.mutate({ name: "John" });
    `
  },

  // ============================================
  // FORMS & VALIDATION
  // ============================================
  
  reactHookForm: {
    name: "React Hook Form",
    installed: true,
    description: "Performant, flexible forms with easy validation",
    usage: `
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Define schema
const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Min 8 characters")
});

type FormData = z.infer<typeof schema>;

// Usage
function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema)
  });

  const onSubmit = (data: FormData) => {
    console.log(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("email")} />
      {errors.email && <span>{errors.email.message}</span>}
      
      <input type="password" {...register("password")} />
      {errors.password && <span>{errors.password.message}</span>}
      
      <button type="submit">Login</button>
    </form>
  );
}
    `
  },

  zod: {
    name: "Zod",
    installed: true,
    description: "TypeScript-first schema validation",
    usage: `
import { z } from "zod";

// Basic schemas
const stringSchema = z.string();
const numberSchema = z.number().min(0).max(100);
const emailSchema = z.string().email();

// Object schema
const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  age: z.number().optional(),
  role: z.enum(["admin", "user"])
});

// Infer TypeScript type
type User = z.infer<typeof userSchema>;

// Validation
const result = userSchema.safeParse(data);
if (result.success) {
  console.log(result.data);
} else {
  console.log(result.error.issues);
}

// Arrays and nested
const postSchema = z.object({
  title: z.string(),
  tags: z.array(z.string()),
  author: userSchema
});
    `
  },

  // ============================================
  // DATA FETCHING
  // ============================================
  
  axios: {
    name: "Axios",
    installed: true,
    description: "Promise-based HTTP client",
    usage: `
import axios from "axios";

// Basic requests
const response = await axios.get("/api/users");
const data = response.data;

// POST with data
await axios.post("/api/users", { name: "John" });

// With config
await axios({
  method: "post",
  url: "/api/upload",
  data: formData,
  headers: { "Content-Type": "multipart/form-data" }
});

// Create instance with defaults
const api = axios.create({
  baseURL: "https://api.example.com",
  timeout: 5000,
  headers: { Authorization: "Bearer token" }
});

// Interceptors
api.interceptors.request.use((config) => {
  config.headers.Authorization = \`Bearer \${getToken()}\`;
  return config;
});
    `
  },

  supabase: {
    name: "Supabase",
    installed: true,
    description: "Backend-as-a-Service with Postgres, Auth, Storage",
    usage: `
import { supabase } from "@/integrations/supabase/client";

// Fetch data
const { data, error } = await supabase
  .from("posts")
  .select("*")
  .eq("user_id", userId)
  .order("created_at", { ascending: false });

// Insert
const { data, error } = await supabase
  .from("posts")
  .insert({ title: "Hello", content: "World" })
  .select()
  .single();

// Update
await supabase
  .from("posts")
  .update({ title: "Updated" })
  .eq("id", postId);

// Delete
await supabase.from("posts").delete().eq("id", postId);

// Auth
const { data: { user } } = await supabase.auth.getUser();
await supabase.auth.signInWithPassword({ email, password });
await supabase.auth.signUp({ email, password });
await supabase.auth.signOut();

// Realtime
supabase
  .channel("posts")
  .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, (payload) => {
    console.log("Change:", payload);
  })
  .subscribe();

// Storage
const { data } = await supabase.storage
  .from("avatars")
  .upload(\`\${userId}/avatar.png\`, file);
    `
  },

  // ============================================
  // DRAG & DROP
  // ============================================
  
  dndKit: {
    name: "@dnd-kit",
    installed: true,
    description: "Modern drag and drop toolkit",
    usage: `
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Sortable item component
function SortableItem({ id, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

// Container component
function SortableList({ items, setItems }) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  function handleDragEnd(event) {
    const { active, over } = event;
    if (active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {items.map((id) => (
          <SortableItem key={id} id={id}>
            Item {id}
          </SortableItem>
        ))}
      </SortableContext>
    </DndContext>
  );
}
    `
  },

  // ============================================
  // INTERNATIONALIZATION
  // ============================================
  
  i18next: {
    name: "i18next + react-i18next",
    installed: true,
    description: "Internationalization framework",
    usage: `
// Setup (src/lib/i18n-setup.ts)
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

i18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        welcome: "Welcome",
        greeting: "Hello, {{name}}!"
      }
    },
    ar: {
      translation: {
        welcome: "مرحبا",
        greeting: "أهلا، {{name}}!"
      }
    }
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false }
});

// Usage in components
import { useTranslation } from "react-i18next";

function Welcome() {
  const { t, i18n } = useTranslation();
  
  return (
    <div>
      <h1>{t("welcome")}</h1>
      <p>{t("greeting", { name: "Ahmed" })}</p>
      
      <button onClick={() => i18n.changeLanguage("ar")}>
        العربية
      </button>
    </div>
  );
}
    `
  },

  // ============================================
  // PDF GENERATION
  // ============================================
  
  reactPdf: {
    name: "@react-pdf/renderer",
    installed: true,
    description: "Create PDF documents using React components",
    usage: `
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from "@react-pdf/renderer";

// Create styles
const styles = StyleSheet.create({
  page: { padding: 30 },
  title: { fontSize: 24, marginBottom: 20 },
  text: { fontSize: 12, marginBottom: 10 }
});

// PDF Document component
const MyDocument = ({ data }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>{data.title}</Text>
      <View>
        <Text style={styles.text}>{data.content}</Text>
      </View>
    </Page>
  </Document>
);

// Download link
function DownloadButton({ data }) {
  return (
    <PDFDownloadLink document={<MyDocument data={data} />} fileName="document.pdf">
      {({ loading }) => (loading ? "Loading..." : "Download PDF")}
    </PDFDownloadLink>
  );
}
    `
  },

  // ============================================
  // CHARTS & VISUALIZATION
  // ============================================
  
  recharts: {
    name: "Recharts",
    installed: true,
    description: "Composable charting library built with React and D3",
    usage: `
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from "recharts";

const data = [
  { name: "Jan", value: 400 },
  { name: "Feb", value: 300 },
  { name: "Mar", value: 600 }
];

// Line Chart
<ResponsiveContainer width="100%" height={300}>
  <LineChart data={data}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="name" />
    <YAxis />
    <Tooltip />
    <Legend />
    <Line type="monotone" dataKey="value" stroke="#8884d8" />
  </LineChart>
</ResponsiveContainer>

// Bar Chart
<ResponsiveContainer width="100%" height={300}>
  <BarChart data={data}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="name" />
    <YAxis />
    <Tooltip />
    <Bar dataKey="value" fill="#82ca9d" />
  </BarChart>
</ResponsiveContainer>

// Pie Chart
<ResponsiveContainer width="100%" height={300}>
  <PieChart>
    <Pie data={data} dataKey="value" nameKey="name" fill="#8884d8" label />
    <Tooltip />
  </PieChart>
</ResponsiveContainer>
    `
  },

  // ============================================
  // UTILITIES
  // ============================================
  
  dateFns: {
    name: "date-fns",
    installed: true,
    description: "Modern JavaScript date utility library",
    usage: `
import { format, parseISO, addDays, differenceInDays, isAfter, isBefore } from "date-fns";
import { ar } from "date-fns/locale";

// Format dates
format(new Date(), "yyyy-MM-dd"); // "2024-01-15"
format(new Date(), "PPP"); // "January 15th, 2024"
format(new Date(), "PPP", { locale: ar }); // Arabic format

// Parse ISO strings
const date = parseISO("2024-01-15T10:30:00Z");

// Date math
addDays(new Date(), 7); // Add 7 days
differenceInDays(date1, date2); // Days between dates

// Comparisons
isAfter(date1, date2);
isBefore(date1, date2);
    `
  },

  lucideReact: {
    name: "lucide-react",
    installed: true,
    description: "Beautiful & consistent icons",
    usage: `
import { Home, User, Settings, Search, Plus, X, Check, ChevronRight } from "lucide-react";

// Basic usage
<Home size={24} />
<User className="w-6 h-6 text-primary" />
<Settings color="red" strokeWidth={1.5} />

// Common icons:
// Navigation: Home, Menu, ChevronLeft, ChevronRight, ArrowLeft, ArrowRight
// Actions: Plus, Minus, X, Check, Edit, Trash, Copy, Download, Upload
// User: User, Users, UserPlus, LogIn, LogOut
// Media: Play, Pause, Volume2, Image, Camera, Video
// Communication: Mail, MessageCircle, Bell, Phone
// Files: File, Folder, FileText, FilePlus
// UI: Search, Settings, Filter, MoreHorizontal, MoreVertical
    `
  },

  classVarianceAuthority: {
    name: "class-variance-authority",
    installed: true,
    description: "Create variant-based component styles",
    usage: `
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "border border-input bg-background hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

interface ButtonProps extends VariantProps<typeof buttonVariants> {
  className?: string;
}

function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
    `
  },

  monacoEditor: {
    name: "@monaco-editor/react",
    installed: true,
    description: "Monaco Editor (VS Code's editor) for React",
    usage: `
import Editor from "@monaco-editor/react";

<Editor
  height="400px"
  defaultLanguage="typescript"
  defaultValue="// Start coding..."
  theme="vs-dark"
  onChange={(value) => console.log(value)}
  options={{
    minimap: { enabled: false },
    fontSize: 14,
    wordWrap: "on",
    automaticLayout: true
  }}
/>

// Controlled
const [code, setCode] = useState("");
<Editor
  value={code}
  onChange={(value) => setCode(value || "")}
  language="javascript"
/>
    `
  },

  sonner: {
    name: "Sonner",
    installed: true,
    description: "Toast notifications",
    usage: `
import { toast } from "sonner";

// Basic toasts
toast("Event has been created");
toast.success("Successfully saved!");
toast.error("Something went wrong");
toast.warning("Please check your input");
toast.info("New update available");

// With description
toast.success("Saved!", {
  description: "Your changes have been saved successfully."
});

// With action
toast("File deleted", {
  action: {
    label: "Undo",
    onClick: () => restoreFile()
  }
});

// Promise toast
toast.promise(saveData(), {
  loading: "Saving...",
  success: "Saved!",
  error: "Could not save"
});

// Custom duration
toast("Hello", { duration: 5000 });
    `
  }
};

// Export a quick reference for the AI
export const QUICK_REFERENCE = {
  ui: ["shadcn/ui", "Radix UI"],
  animation: ["framer-motion", "react-spring"],
  state: ["zustand", "jotai", "TanStack Query"],
  forms: ["react-hook-form", "zod"],
  data: ["axios", "supabase", "TanStack Query"],
  dnd: ["@dnd-kit/core", "@dnd-kit/sortable"],
  i18n: ["i18next", "react-i18next"],
  pdf: ["@react-pdf/renderer"],
  charts: ["recharts"],
  editor: ["@monaco-editor/react"],
  utils: ["date-fns", "lucide-react", "class-variance-authority", "clsx", "tailwind-merge"]
};

// What each library is best for
export const USE_CASES = {
  "Want toast notifications?": "Use sonner: toast.success('Done!')",
  "Need a form with validation?": "Use react-hook-form + zod",
  "Need animations?": "Use framer-motion for complex, react-spring for physics-based",
  "Need global state?": "Use zustand for simple, jotai for atomic",
  "Need to fetch data?": "Use TanStack Query with supabase",
  "Need drag and drop?": "Use @dnd-kit/sortable",
  "Need charts?": "Use recharts",
  "Need PDF export?": "Use @react-pdf/renderer",
  "Need code editor?": "Use @monaco-editor/react",
  "Need icons?": "Use lucide-react"
};
