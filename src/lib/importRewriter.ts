/**
 * Import rewriter utility.
 * Rewrites common AI-generated imports to use existing shadcn UI components
 * before file operations are applied to prevent "missing import" errors.
 */

// Map of common AI-generated import paths to actual project paths
const IMPORT_MAP: Record<string, { path: string; named?: string[] }> = {
  // Button variations
  "./components/Button": { path: "@/components/ui/button", named: ["Button"] },
  "./components/button": { path: "@/components/ui/button", named: ["Button"] },
  "../components/Button": { path: "@/components/ui/button", named: ["Button"] },
  "../components/button": { path: "@/components/ui/button", named: ["Button"] },

  // Card variations
  "./components/Card": { path: "@/components/ui/card", named: ["Card", "CardContent", "CardHeader", "CardTitle", "CardDescription", "CardFooter"] },
  "./components/card": { path: "@/components/ui/card", named: ["Card", "CardContent", "CardHeader", "CardTitle", "CardDescription", "CardFooter"] },
  "../components/Card": { path: "@/components/ui/card", named: ["Card", "CardContent", "CardHeader", "CardTitle", "CardDescription", "CardFooter"] },

  // Input variations
  "./components/Input": { path: "@/components/ui/input", named: ["Input"] },
  "./components/input": { path: "@/components/ui/input", named: ["Input"] },
  "../components/Input": { path: "@/components/ui/input", named: ["Input"] },

  // Checkbox variations
  "./components/Checkbox": { path: "@/components/ui/checkbox", named: ["Checkbox"] },
  "./components/checkbox": { path: "@/components/ui/checkbox", named: ["Checkbox"] },

  // Dialog/Modal variations
  "./components/Dialog": { path: "@/components/ui/dialog", named: ["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription", "DialogFooter", "DialogTrigger"] },
  "./components/Modal": { path: "@/components/ui/dialog", named: ["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription", "DialogFooter", "DialogTrigger"] },

  // Label variations
  "./components/Label": { path: "@/components/ui/label", named: ["Label"] },
  "./components/label": { path: "@/components/ui/label", named: ["Label"] },

  // Select variations
  "./components/Select": { path: "@/components/ui/select", named: ["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"] },

  // Tabs variations
  "./components/Tabs": { path: "@/components/ui/tabs", named: ["Tabs", "TabsContent", "TabsList", "TabsTrigger"] },

  // Badge variations
  "./components/Badge": { path: "@/components/ui/badge", named: ["Badge"] },

  // Alert variations
  "./components/Alert": { path: "@/components/ui/alert", named: ["Alert", "AlertDescription", "AlertTitle"] },

  // Avatar variations
  "./components/Avatar": { path: "@/components/ui/avatar", named: ["Avatar", "AvatarFallback", "AvatarImage"] },

  // Progress variations
  "./components/Progress": { path: "@/components/ui/progress", named: ["Progress"] },

  // Skeleton variations
  "./components/Skeleton": { path: "@/components/ui/skeleton", named: ["Skeleton"] },

  // Switch variations
  "./components/Switch": { path: "@/components/ui/switch", named: ["Switch"] },

  // Textarea variations
  "./components/Textarea": { path: "@/components/ui/textarea", named: ["Textarea"] },

  // Tooltip variations
  "./components/Tooltip": { path: "@/components/ui/tooltip", named: ["Tooltip", "TooltipContent", "TooltipProvider", "TooltipTrigger"] },

  // ScrollArea variations
  "./components/ScrollArea": { path: "@/components/ui/scroll-area", named: ["ScrollArea", "ScrollBar"] },

  // Separator variations
  "./components/Separator": { path: "@/components/ui/separator", named: ["Separator"] },

  // Slider variations
  "./components/Slider": { path: "@/components/ui/slider", named: ["Slider"] },

  // Table variations
  "./components/Table": { path: "@/components/ui/table", named: ["Table", "TableBody", "TableCell", "TableHead", "TableHeader", "TableRow"] },

  // Form variations
  "./components/Form": { path: "@/components/ui/form" },

  // Dropdown variations
  "./components/Dropdown": { path: "@/components/ui/dropdown-menu", named: ["DropdownMenu", "DropdownMenuContent", "DropdownMenuItem", "DropdownMenuTrigger"] },
  "./components/DropdownMenu": { path: "@/components/ui/dropdown-menu", named: ["DropdownMenu", "DropdownMenuContent", "DropdownMenuItem", "DropdownMenuTrigger"] },

  // Popover variations
  "./components/Popover": { path: "@/components/ui/popover", named: ["Popover", "PopoverContent", "PopoverTrigger"] },

  // Sheet (side panel) variations
  "./components/Sheet": { path: "@/components/ui/sheet", named: ["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription", "SheetTrigger"] },

  // Command (combobox) variations
  "./components/Command": { path: "@/components/ui/command" },

  // Calendar variations
  "./components/Calendar": { path: "@/components/ui/calendar", named: ["Calendar"] },

  // Accordion variations
  "./components/Accordion": { path: "@/components/ui/accordion", named: ["Accordion", "AccordionContent", "AccordionItem", "AccordionTrigger"] },

  // Collapsible variations
  "./components/Collapsible": { path: "@/components/ui/collapsible", named: ["Collapsible", "CollapsibleContent", "CollapsibleTrigger"] },

  // RadioGroup variations
  "./components/RadioGroup": { path: "@/components/ui/radio-group", named: ["RadioGroup", "RadioGroupItem"] },
};

// Regex to match import statements
const IMPORT_REGEX = /^(import\s+)(\{[^}]+\}|[^{}\s]+)(\s+from\s+['"])([^'"]+)(['"];?\s*)$/gm;

/**
 * Rewrite imports in a single file content string.
 */
export function rewriteImports(content: string): string {
  return content.replace(IMPORT_REGEX, (match, prefix, imports, fromPart, importPath, suffix) => {
    const mapping = IMPORT_MAP[importPath];
    if (!mapping) return match; // No mapping, keep original

    return `${prefix}${imports}${fromPart}${mapping.path}${suffix}`;
  });
}

/**
 * Rewrite imports in all file operations before they are applied.
 */
export function rewriteFileOperations(
  operations: Array<{ path: string; action: string; content?: string }>
): Array<{ path: string; action: string; content?: string }> {
  return operations.map((op) => {
    if ((op.action === "create" || op.action === "update") && op.content) {
      // Only rewrite .tsx, .ts, .jsx, .js files
      if (/\.(tsx?|jsx?)$/.test(op.path)) {
        return {
          ...op,
          content: rewriteImports(op.content),
        };
      }
    }
    return op;
  });
}
