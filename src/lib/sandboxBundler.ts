// In-browser preview bundler for the sandbox iframe.
//
// Goals:
// - Work with multi-file projects (a Vite-style file map)
// - Support TS/TSX/JS/JSX via Babel *at runtime* (inside iframe)
// - Avoid injecting raw user code directly into an inline "text/babel" script
//   (this was causing "Unterminated string constant" crashes)
//
// Approach:
// - Build a tiny module graph (src/* only) and emit a runtime loader.
// - Embed the module sources as JSON (safe) inside the iframe.
// - Inside iframe: Babel.transform the concatenated runtime + user sources and eval it.

export type FileMap = Record<string, string>;

type ModuleMap = Record<string, string>;

type ExportInfo = {
  defaultName: string | null;
  named: string[];
};

function normalizeSpecifier(spec: string) {
  return spec.split("?")[0].split("#")[0].replace(/\\/g, "/");
}

function resolveModulePath(files: FileMap, rawSpecifier: string, fromPath?: string): string | null {
  const spec = normalizeSpecifier(rawSpecifier);

  // Alias @/ -> src/
  if (spec.startsWith("@/")) {
    const stem = `src/${spec.slice(2)}`;
    const candidates = [
      stem,
      `${stem}.ts`,
      `${stem}.tsx`,
      `${stem}.js`,
      `${stem}.jsx`,
      `${stem}.json`,
      `${stem}/index.ts`,
      `${stem}/index.tsx`,
      `${stem}/index.js`,
      `${stem}/index.jsx`,
    ];
    return candidates.find((c) => files[c] != null) ?? null;
  }

  // Alias ~/ -> src/ (alternative path alias)
  if (spec.startsWith("~/")) {
    const stem = `src/${spec.slice(2)}`;
    const candidates = [
      stem,
      `${stem}.ts`,
      `${stem}.tsx`,
      `${stem}.js`,
      `${stem}.jsx`,
      `${stem}.json`,
      `${stem}/index.ts`,
      `${stem}/index.tsx`,
      `${stem}/index.js`,
      `${stem}/index.jsx`,
    ];
    return candidates.find((c) => files[c] != null) ?? null;
  }

  // Relative paths (./, ../)
  if ((spec.startsWith("./") || spec.startsWith("../")) && fromPath) {
    const fromDir = fromPath.split("/").slice(0, -1).join("/") || "src";
    const joined = `${fromDir}/${spec}`.replace(/\/\.\//g, "/");

    const parts: string[] = [];
    for (const p of joined.split("/")) {
      if (!p || p === ".") continue;
      if (p === "..") parts.pop();
      else parts.push(p);
    }
    const stem = parts.join("/");

    const candidates = [
      stem,
      `${stem}.ts`,
      `${stem}.tsx`,
      `${stem}.js`,
      `${stem}.jsx`,
      `${stem}.json`,
      `${stem}/index.ts`,
      `${stem}/index.tsx`,
      `${stem}/index.js`,
      `${stem}/index.jsx`,
    ];

    return candidates.find((c) => files[c] != null) ?? null;
  }

  // We do not resolve node_modules in the sandbox.
  return null;
}

function extractExports(original: string): ExportInfo {
  const named = new Set<string>();
  let defaultName: string | null = null;

  // export default function Name
  const m1 = original.match(/export\s+default\s+function\s+([A-Za-z_$][\w$]*)/);
  if (m1) defaultName = m1[1];

  // export default Name
  if (!defaultName) {
    const m2 = original.match(/export\s+default\s+([A-Za-z_$][\w$]*)\s*;?/);
    if (m2) defaultName = m2[1];
  }

  for (const mm of original.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) named.add(mm[1]);
  for (const mm of original.matchAll(/export\s+const\s+([A-Za-z_$][\w$]*)/g)) named.add(mm[1]);
  for (const mm of original.matchAll(/export\s+let\s+([A-Za-z_$][\w$]*)/g)) named.add(mm[1]);
  for (const mm of original.matchAll(/export\s+var\s+([A-Za-z_$][\w$]*)/g)) named.add(mm[1]);
  for (const mm of original.matchAll(/export\s+class\s+([A-Za-z_$][\w$]*)/g)) named.add(mm[1]);

  // export { A, B as C }
  for (const mm of original.matchAll(/export\s*\{([^}]+)\}\s*;?/g)) {
    const inside = mm[1];
    for (const part of inside.split(",")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const asMatch = trimmed.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
      if (!asMatch) continue;
      const exportedName = asMatch[2] ?? asMatch[1];
      named.add(exportedName);
    }
  }

  return { defaultName, named: Array.from(named) };
}

function stripExportsOnly(code: string) {
  // NOTE: Modules are wrapped in an IIFE before Babel runs.
  // TypeScript-only top-level declarations (type/interface) are invalid inside a function body,
  // so we strip them out here to prevent Babel parse errors.
  return code
    // Remove exported TS-only declarations
    .replace(/(^|\n)\s*export\s+type\s+[\s\S]*?;\s*(?=\n|$)/g, "$1")
    .replace(/(^|\n)\s*export\s+interface\s+[A-Za-z_$][\w$]*\s*\{[\s\S]*?\}\s*;?\s*(?=\n|$)/g, "$1")
    // Remove non-exported TS-only declarations that may exist in some files
    .replace(/(^|\n)\s*type\s+[A-Za-z_$][\w$]*\s*=\s*[\s\S]*?;\s*(?=\n|$)/g, "$1")
    .replace(/(^|\n)\s*interface\s+[A-Za-z_$][\w$]*\s*\{[\s\S]*?\}\s*;?\s*(?=\n|$)/g, "$1")
    // Strip runtime exports
    .replace(/export\s+default\s+function\s+/g, "function ")
    .replace(/export\s+default\s+/g, "")
    .replace(/^export\s+(?=(const|let|var|function|class)\b)/gm, "")
    .replace(/^export\s*\{[^}]+\}\s*;?\s*$/gm, "");
}

// Legacy function kept for compatibility but now only strips exports
function stripExportsAndImports(code: string) {
  return code
    .replace(/^import\s+.*?['"].*?['"];?\s*$/gm, "")
    // Remove TS-only declarations
    .replace(/(^|\n)\s*export\s+type\s+[\s\S]*?;\s*(?=\n|$)/g, "$1")
    .replace(/(^|\n)\s*export\s+interface\s+[A-Za-z_$][\w$]*\s*\{[\s\S]*?\}\s*;?\s*(?=\n|$)/g, "$1")
    .replace(/(^|\n)\s*type\s+[A-Za-z_$][\w$]*\s*=\s*[\s\S]*?;\s*(?=\n|$)/g, "$1")
    .replace(/(^|\n)\s*interface\s+[A-Za-z_$][\w$]*\s*\{[\s\S]*?\}\s*;?\s*(?=\n|$)/g, "$1")
    // Strip runtime exports
    .replace(/export\s+default\s+function\s+/g, "function ")
    .replace(/export\s+default\s+/g, "")
    .replace(/^export\s+(?=(const|let|var|function|class)\b)/gm, "")
    .replace(/^export\s*\{[^}]+\}\s*;?\s*$/gm, "");
}

// Mapping of external modules to their window global names and export structure
const EXTERNAL_MODULE_MAP: Record<string, { global: string; namedExports?: string[]; hasDefault?: boolean }> = {
  // React ecosystem
  "react": { global: "React", hasDefault: true, namedExports: ["useState", "useEffect", "useMemo", "useCallback", "useRef", "useReducer", "useContext", "useLayoutEffect", "useId", "createContext", "forwardRef", "memo", "lazy", "Suspense", "Fragment", "StrictMode", "createElement", "cloneElement", "Children", "isValidElement", "Component", "PureComponent", "createRef", "useImperativeHandle", "useDebugValue", "useDeferredValue", "useTransition", "useSyncExternalStore", "useInsertionEffect", "startTransition"] },
  "react-dom": { global: "ReactDOM", hasDefault: true, namedExports: ["createRoot", "hydrateRoot", "flushSync", "createPortal", "findDOMNode", "unmountComponentAtNode", "render", "hydrate"] },
  "react-dom/client": { global: "ReactDOM", hasDefault: true, namedExports: ["createRoot", "hydrateRoot"] },
  "react/jsx-runtime": { global: "React", namedExports: ["jsx", "jsxs", "Fragment"] },
  "react/jsx-dev-runtime": { global: "React", namedExports: ["jsxDEV", "Fragment"] },

  // Styling utilities
  "clsx": { global: "__clsxModule", hasDefault: true, namedExports: ["clsx"] },
  "tailwind-merge": { global: "__twMergeModule", hasDefault: true, namedExports: ["twMerge", "twJoin"] },
  "class-variance-authority": { global: "__cvaModule", hasDefault: true, namedExports: ["cva", "cx"] },
  "tailwindcss-animate": { global: "{}" },
  "tailwindcss": { global: "{}" },
  "tailwindcss/base": { global: "{}" },
  "tailwindcss/components": { global: "{}" },
  "tailwindcss/utilities": { global: "{}" },
  "tailwindcss/preflight": { global: "{}" },

  // Emotion & styled-components
  "@emotion/react": { global: "emotionReact", namedExports: ["css", "jsx", "Global", "ClassNames", "keyframes", "ThemeProvider", "useTheme"] },
  "@emotion/styled": { global: "emotionStyled", hasDefault: true },
  "styled-components": { global: "styledComponents", hasDefault: true, namedExports: ["css", "keyframes", "ThemeProvider", "useTheme", "createGlobalStyle"] },

  // Radix UI primitives (all map to radixUI namespace)
  "@radix-ui/react-accordion": { global: "radixUI.Accordion", namedExports: ["Root", "Item", "Header", "Trigger", "Content"] },
  "@radix-ui/react-alert-dialog": { global: "radixUI.AlertDialog", namedExports: ["Root", "Trigger", "Portal", "Overlay", "Content", "Title", "Description", "Cancel", "Action"] },
  "@radix-ui/react-aspect-ratio": { global: "radixUI.AspectRatio", namedExports: ["Root"] },
  "@radix-ui/react-avatar": { global: "radixUI.Avatar", namedExports: ["Root", "Image", "Fallback"] },
  "@radix-ui/react-checkbox": { global: "radixUI.Checkbox", namedExports: ["Root", "Indicator"] },
  "@radix-ui/react-collapsible": { global: "radixUI.Collapsible", namedExports: ["Root", "Trigger", "Content"] },
  "@radix-ui/react-context-menu": { global: "radixUI.ContextMenu", namedExports: ["Root", "Trigger", "Portal", "Content", "Item", "CheckboxItem", "RadioGroup", "RadioItem", "Sub", "SubTrigger", "SubContent", "Separator", "Label"] },
  "@radix-ui/react-dialog": { global: "radixUI.Dialog", namedExports: ["Root", "Trigger", "Portal", "Overlay", "Content", "Title", "Description", "Close"] },
  "@radix-ui/react-dropdown-menu": { global: "radixUI.DropdownMenu", namedExports: ["Root", "Trigger", "Portal", "Content", "Item", "CheckboxItem", "RadioGroup", "RadioItem", "Sub", "SubTrigger", "SubContent", "Separator", "Label"] },
  "@radix-ui/react-hover-card": { global: "radixUI.HoverCard", namedExports: ["Root", "Trigger", "Portal", "Content"] },
  "@radix-ui/react-label": { global: "radixUI.Label", namedExports: ["Root"] },
  "@radix-ui/react-menubar": { global: "radixUI.Menubar", namedExports: ["Root", "Menu", "Trigger", "Portal", "Content", "Item", "CheckboxItem", "RadioGroup", "RadioItem", "Sub", "SubTrigger", "SubContent", "Separator", "Label"] },
  "@radix-ui/react-navigation-menu": { global: "radixUI.NavigationMenu", namedExports: ["Root", "List", "Item", "Trigger", "Content", "Link", "Viewport", "Indicator"] },
  "@radix-ui/react-popover": { global: "radixUI.Popover", namedExports: ["Root", "Trigger", "Anchor", "Portal", "Content", "Close", "Arrow"] },
  "@radix-ui/react-progress": { global: "radixUI.Progress", namedExports: ["Root", "Indicator"] },
  "@radix-ui/react-radio-group": { global: "radixUI.RadioGroup", namedExports: ["Root", "Item", "Indicator"] },
  "@radix-ui/react-scroll-area": { global: "radixUI.ScrollArea", namedExports: ["Root", "Viewport", "Scrollbar", "Thumb", "Corner"] },
  "@radix-ui/react-select": { global: "radixUI.Select", namedExports: ["Root", "Trigger", "Value", "Icon", "Portal", "Content", "Viewport", "Group", "Label", "Item", "ItemText", "ItemIndicator", "ScrollUpButton", "ScrollDownButton", "Separator"] },
  "@radix-ui/react-separator": { global: "radixUI.Separator", namedExports: ["Root"] },
  "@radix-ui/react-slider": { global: "radixUI.Slider", namedExports: ["Root", "Track", "Range", "Thumb"] },
  "@radix-ui/react-slot": { global: "radixUI.Slot", namedExports: ["Slot", "Slottable"] },
  "@radix-ui/react-switch": { global: "radixUI.Switch", namedExports: ["Root", "Thumb"] },
  "@radix-ui/react-tabs": { global: "radixUI.Tabs", namedExports: ["Root", "List", "Trigger", "Content"] },
  "@radix-ui/react-toast": { global: "radixUI.Toast", namedExports: ["Provider", "Root", "Title", "Description", "Action", "Close", "Viewport"] },
  "@radix-ui/react-toggle": { global: "radixUI.Toggle", namedExports: ["Root"] },
  "@radix-ui/react-toggle-group": { global: "radixUI.ToggleGroup", namedExports: ["Root", "Item"] },
  "@radix-ui/react-tooltip": { global: "radixUI.Tooltip", namedExports: ["Provider", "Root", "Trigger", "Portal", "Content", "Arrow"] },
  "@radix-ui/react-primitive": { global: "radixUI.Primitive", namedExports: ["Primitive"] },
  "@radix-ui/react-presence": { global: "radixUI.Presence", namedExports: ["Presence"] },
  "@radix-ui/react-portal": { global: "radixUI.Portal", namedExports: ["Portal"] },
  "@radix-ui/react-focus-scope": { global: "radixUI.FocusScope", namedExports: ["FocusScope"] },
  "@radix-ui/react-dismissable-layer": { global: "radixUI.DismissableLayer", namedExports: ["DismissableLayer"] },
  "@radix-ui/react-id": { global: "radixUI.Id", namedExports: ["useId"] },
  "@radix-ui/react-compose-refs": { global: "radixUI.ComposeRefs", namedExports: ["composeRefs", "useComposedRefs"] },
  "@radix-ui/react-context": { global: "radixUI.Context", namedExports: ["createContext", "createContextScope"] },
  "@radix-ui/react-use-controllable-state": { global: "radixUI.UseControllableState", namedExports: ["useControllableState"] },
  "@radix-ui/react-use-callback-ref": { global: "radixUI.UseCallbackRef", namedExports: ["useCallbackRef"] },
  "@radix-ui/react-use-escape-keydown": { global: "radixUI.UseEscapeKeydown", namedExports: ["useEscapeKeydown"] },
  "@radix-ui/react-use-layout-effect": { global: "radixUI.UseLayoutEffect", namedExports: ["useLayoutEffect"] },
  "@radix-ui/react-use-previous": { global: "radixUI.UsePrevious", namedExports: ["usePrevious"] },
  "@radix-ui/react-use-size": { global: "radixUI.UseSize", namedExports: ["useSize"] },
  "@radix-ui/react-visually-hidden": { global: "radixUI.VisuallyHidden", namedExports: ["Root"] },
  "@radix-ui/react-arrow": { global: "radixUI.Arrow", namedExports: ["Root"] },
  "@radix-ui/react-collection": { global: "radixUI.Collection", namedExports: ["createCollection"] },
  "@radix-ui/react-direction": { global: "radixUI.Direction", namedExports: ["DirectionProvider", "useDirection"] },
  "@radix-ui/react-focus-guards": { global: "radixUI.FocusGuards", namedExports: ["FocusGuards"] },
  "@radix-ui/react-roving-focus": { global: "radixUI.RovingFocus", namedExports: ["Root", "Item"] },
  "@radix-ui/react-menu": { global: "radixUI.Menu", namedExports: ["Root", "Anchor", "Portal", "Content", "Group", "Label", "Item", "CheckboxItem", "RadioGroup", "RadioItem", "ItemIndicator", "Separator", "Sub", "SubTrigger", "SubContent"] },

  // Icon libraries
  "lucide-react": { global: "lucideReact", hasDefault: true },
  "@heroicons/react": { global: "heroIcons" },
  "@heroicons/react/24/solid": { global: "heroIcons.solid" },
  "@heroicons/react/24/outline": { global: "heroIcons.outline" },
  "@heroicons/react/20/solid": { global: "heroIcons.mini" },
  "react-icons": { global: "reactIcons" },
  "@tabler/icons-react": { global: "tablerIcons" },
  "phosphor-react": { global: "phosphorIcons" },
  "@phosphor-icons/react": { global: "phosphorIcons" },
  "iconoir-react": { global: "iconoirIcons" },
  "react-feather": { global: "featherIcons" },

  // Forms
  "react-hook-form": { global: "reactHookForm", namedExports: ["useForm", "useController", "useFieldArray", "useFormContext", "useFormState", "useWatch", "FormProvider", "Controller"] },
  "@hookform/resolvers": { global: "hookformResolvers", namedExports: ["zodResolver", "yupResolver", "joiResolver"] },
  "@hookform/resolvers/zod": { global: "hookformResolvers.zod", namedExports: ["zodResolver"] },
  "zod": { global: "zod", namedExports: ["z", "ZodError", "ZodSchema"] },
  "yup": { global: "yup", hasDefault: true },

  // Data fetching & state
  "@tanstack/react-query": { global: "reactQuery", namedExports: ["QueryClient", "QueryClientProvider", "useQuery", "useMutation", "useQueryClient", "useInfiniteQuery", "useQueries", "useSuspenseQuery"] },
  "axios": { global: "axios", hasDefault: true, namedExports: ["create", "isAxiosError", "AxiosError"] },
  "swr": { global: "swr", hasDefault: true, namedExports: ["useSWR", "useSWRConfig", "mutate", "SWRConfig"] },
  "zustand": { global: "zustand", hasDefault: true, namedExports: ["create", "createStore", "useStore"] },
  "jotai": { global: "jotai", namedExports: ["atom", "useAtom", "useAtomValue", "useSetAtom", "Provider"] },
  "@reduxjs/toolkit": { global: "reduxToolkit", namedExports: ["configureStore", "createSlice", "createAsyncThunk", "createAction", "createReducer"] },
  "react-redux": { global: "reactRedux", namedExports: ["Provider", "useSelector", "useDispatch", "useStore", "connect"] },
  "recoil": { global: "recoil", namedExports: ["atom", "selector", "useRecoilState", "useRecoilValue", "useSetRecoilState", "RecoilRoot"] },
  "valtio": { global: "valtio", namedExports: ["proxy", "useSnapshot", "subscribe", "snapshot", "ref"] },
  "immer": { global: "immer", hasDefault: true, namedExports: ["produce", "enableMapSet", "enablePatches", "Draft", "Immutable"] },

  // Animation
  "framer-motion": { global: "framerMotion", namedExports: ["motion", "AnimatePresence", "useAnimation", "useMotionValue", "useTransform", "useSpring", "useScroll", "useInView", "useReducedMotion", "LayoutGroup", "Reorder"] },
  "react-spring": { global: "reactSpring", namedExports: ["useSpring", "useSprings", "useTrail", "useTransition", "useChain", "animated", "config"] },
  "@react-spring/web": { global: "reactSpring", namedExports: ["useSpring", "useSprings", "useTrail", "useTransition", "useChain", "animated", "config"] },
  "gsap": { global: "gsap", hasDefault: true, namedExports: ["gsap", "TweenMax", "TweenLite", "TimelineMax", "TimelineLite", "Power0", "Power1", "Power2", "Power3", "Power4", "Linear", "Quad", "Cubic", "Quart", "Quint", "Strong", "Elastic", "Back", "SteppedEase", "Bounce", "Sine", "Expo", "Circ"] },
  "auto-animate": { global: "autoAnimate", hasDefault: true, namedExports: ["useAutoAnimate"] },
  "@formkit/auto-animate": { global: "autoAnimate", hasDefault: true, namedExports: ["useAutoAnimate"] },
  "@formkit/auto-animate/react": { global: "autoAnimate", namedExports: ["useAutoAnimate"] },

  // Date utilities
  "date-fns": { global: "dateFns", namedExports: ["format", "parse", "parseISO", "formatDistance", "formatRelative", "addDays", "addMonths", "addYears", "subDays", "subMonths", "subYears", "startOfWeek", "startOfMonth", "startOfYear", "endOfWeek", "endOfMonth", "endOfYear", "isAfter", "isBefore", "isEqual", "differenceInDays", "differenceInMonths", "differenceInYears", "isValid", "isSameDay", "isSameMonth", "isSameYear", "getDay", "getMonth", "getYear", "setHours", "setMinutes", "setSeconds"] },
  "dayjs": { global: "dayjs", hasDefault: true },
  "moment": { global: "moment", hasDefault: true },
  "luxon": { global: "luxon", namedExports: ["DateTime", "Duration", "Interval", "Info", "Zone", "FixedOffsetZone", "IANAZone", "InvalidZone", "Settings"] },
  "@internationalized/date": { global: "internationalizedDate", namedExports: ["CalendarDate", "CalendarDateTime", "ZonedDateTime", "Time", "parseDate", "parseDateTime", "parseAbsolute", "parseZonedDateTime", "parseTime", "now", "today", "getLocalTimeZone"] },

  // Charts
  "recharts": { global: "Recharts", namedExports: ["LineChart", "Line", "BarChart", "Bar", "PieChart", "Pie", "AreaChart", "Area", "ComposedChart", "ScatterChart", "Scatter", "RadarChart", "Radar", "RadialBarChart", "RadialBar", "Treemap", "Funnel", "FunnelChart", "Sankey", "XAxis", "YAxis", "ZAxis", "CartesianGrid", "Tooltip", "Legend", "Cell", "ResponsiveContainer", "Label", "LabelList", "Brush", "ReferenceLine", "ReferenceDot", "ReferenceArea", "ErrorBar", "PolarGrid", "PolarAngleAxis", "PolarRadiusAxis"] },
  "chart.js": { global: "ChartJS", hasDefault: true, namedExports: ["Chart", "registerables", "CategoryScale", "LinearScale", "PointElement", "LineElement", "BarElement", "ArcElement", "RadialLinearScale", "Tooltip", "Legend", "Title", "Filler"] },
  "react-chartjs-2": { global: "reactChartjs2", namedExports: ["Line", "Bar", "Pie", "Doughnut", "Radar", "PolarArea", "Bubble", "Scatter", "Chart"] },
  "victory": { global: "Victory", namedExports: ["VictoryChart", "VictoryLine", "VictoryBar", "VictoryPie", "VictoryArea", "VictoryScatter", "VictoryAxis", "VictoryStack", "VictoryGroup", "VictoryTheme", "VictoryTooltip", "VictoryLegend", "VictoryLabel"] },
  "nivo": { global: "nivo" },
  "@visx/visx": { global: "visx" },
  "d3": { global: "d3", hasDefault: true },

  // Carousel
  "embla-carousel-react": { global: "emblaCarousel", hasDefault: true, namedExports: ["useEmblaCarousel"] },
  "swiper": { global: "Swiper", hasDefault: true, namedExports: ["Swiper", "SwiperSlide"] },
  "swiper/react": { global: "Swiper", namedExports: ["Swiper", "SwiperSlide"] },
  "react-slick": { global: "reactSlick", hasDefault: true },

  // Toast/Notifications
  "vaul": { global: "vaul", namedExports: ["Drawer"] },
  "sonner": { global: "sonner", namedExports: ["Toaster", "toast"] },
  "react-hot-toast": { global: "reactHotToast", hasDefault: true, namedExports: ["toast", "Toaster", "useToaster", "useToasterStore"] },
  "react-toastify": { global: "reactToastify", namedExports: ["ToastContainer", "toast", "Slide", "Zoom", "Flip", "Bounce", "cssTransition"] },
  "notistack": { global: "notistack", namedExports: ["SnackbarProvider", "useSnackbar", "enqueueSnackbar", "closeSnackbar"] },

  // UI Components
  "cmdk": { global: "cmdk", namedExports: ["Command"] },
  "react-day-picker": { global: "reactDayPicker", namedExports: ["DayPicker", "useDayPicker", "useNavigation", "useDayRender", "DayPickerSingleProps", "DayPickerMultipleProps", "DayPickerRangeProps"] },
  "react-datepicker": { global: "reactDatepicker", hasDefault: true },
  "input-otp": { global: "inputOtp", namedExports: ["OTPInput", "OTPInputContext", "REGEXP_ONLY_CHARS", "REGEXP_ONLY_DIGITS", "REGEXP_ONLY_DIGITS_AND_CHARS"] },
  "react-resizable-panels": { global: "resizablePanels", namedExports: ["Panel", "PanelGroup", "PanelResizeHandle"] },
  "next-themes": { global: "nextThemes", namedExports: ["ThemeProvider", "useTheme"] },
  "@headlessui/react": { global: "headlessUI", namedExports: ["Dialog", "Disclosure", "Menu", "Popover", "RadioGroup", "Switch", "Tab", "Transition", "Combobox", "Listbox"] },

  // DnD
  "@dnd-kit/core": { global: "dndKitCore", namedExports: ["DndContext", "useDraggable", "useDroppable", "DragOverlay", "MouseSensor", "TouchSensor", "KeyboardSensor", "PointerSensor", "useSensor", "useSensors"] },
  "@dnd-kit/sortable": { global: "dndKitSortable", namedExports: ["SortableContext", "useSortable", "arrayMove", "sortableKeyboardCoordinates", "verticalListSortingStrategy", "horizontalListSortingStrategy", "rectSortingStrategy", "rectSwappingStrategy"] },
  "@dnd-kit/utilities": { global: "dndKitUtilities", namedExports: ["CSS", "useCombinedRefs"] },
  "react-beautiful-dnd": { global: "reactBeautifulDnd", namedExports: ["DragDropContext", "Droppable", "Draggable"] },
  "react-dnd": { global: "reactDnd", namedExports: ["DndProvider", "useDrag", "useDrop", "useDragLayer"] },
  "react-dnd-html5-backend": { global: "reactDndHtml5Backend", hasDefault: true, namedExports: ["HTML5Backend", "getEmptyImage", "NativeTypes"] },

  // Maps
  "react-leaflet": { global: "reactLeaflet", namedExports: ["MapContainer", "TileLayer", "Marker", "Popup", "useMap", "useMapEvents", "Polyline", "Polygon", "Circle", "Rectangle", "CircleMarker", "Tooltip", "FeatureGroup", "LayerGroup", "LayersControl", "GeoJSON", "ZoomControl", "ScaleControl", "AttributionControl"] },
  "leaflet": { global: "L", hasDefault: true },
  "@react-google-maps/api": { global: "reactGoogleMaps", namedExports: ["GoogleMap", "LoadScript", "useJsApiLoader", "Marker", "InfoWindow", "Polyline", "Polygon", "Rectangle", "Circle", "OverlayView", "DrawingManager", "Autocomplete", "StandaloneSearchBox", "DirectionsService", "DirectionsRenderer", "HeatmapLayer", "TrafficLayer", "TransitLayer", "BicyclingLayer", "StreetViewPanorama", "GroundOverlay", "MarkerClusterer"] },
  "mapbox-gl": { global: "mapboxgl", hasDefault: true },
  "react-map-gl": { global: "reactMapGl", namedExports: ["Map", "Marker", "Popup", "NavigationControl", "FullscreenControl", "ScaleControl", "GeolocateControl", "AttributionControl", "Source", "Layer", "useMap", "useControl"] },

  // Supabase & Auth
  "@supabase/supabase-js": { global: "supabase", namedExports: ["createClient", "SupabaseClient"] },
  "@supabase/auth-helpers-react": { global: "supabaseAuthHelpers", namedExports: ["SessionContextProvider", "useSession", "useUser", "useSupabaseClient"] },
  "firebase": { global: "firebase", hasDefault: true },
  "firebase/app": { global: "firebaseApp", namedExports: ["initializeApp", "getApp", "getApps", "deleteApp"] },
  "firebase/auth": { global: "firebaseAuth", namedExports: ["getAuth", "signInWithEmailAndPassword", "createUserWithEmailAndPassword", "signInWithPopup", "signOut", "onAuthStateChanged", "GoogleAuthProvider", "FacebookAuthProvider", "TwitterAuthProvider", "GithubAuthProvider", "OAuthProvider", "EmailAuthProvider", "sendPasswordResetEmail", "confirmPasswordReset", "verifyPasswordResetCode", "updatePassword", "updateEmail", "updateProfile", "reauthenticateWithCredential", "linkWithCredential", "unlink", "sendEmailVerification", "PhoneAuthProvider", "RecaptchaVerifier", "multiFactor", "getMultiFactorResolver"] },
  "firebase/firestore": { global: "firebaseFirestore", namedExports: ["getFirestore", "collection", "doc", "getDoc", "getDocs", "setDoc", "updateDoc", "deleteDoc", "addDoc", "query", "where", "orderBy", "limit", "startAfter", "startAt", "endBefore", "endAt", "onSnapshot", "serverTimestamp", "increment", "arrayUnion", "arrayRemove", "Timestamp", "GeoPoint", "FieldPath", "FieldValue", "writeBatch", "runTransaction", "enableIndexedDbPersistence", "enableMultiTabIndexedDbPersistence", "clearIndexedDbPersistence", "connectFirestoreEmulator"] },
  "@clerk/clerk-react": { global: "clerkReact", namedExports: ["ClerkProvider", "SignIn", "SignUp", "SignInButton", "SignUpButton", "SignOutButton", "UserButton", "UserProfile", "useAuth", "useUser", "useClerk", "useSession", "useOrganization", "useOrganizationList", "RedirectToSignIn", "RedirectToSignUp", "SignedIn", "SignedOut", "Protect", "MultisessionAppSupport"] },
  "@auth0/auth0-react": { global: "auth0React", namedExports: ["Auth0Provider", "useAuth0", "withAuthenticationRequired"] },
  "next-auth": { global: "nextAuth", hasDefault: true, namedExports: ["getServerSession", "getSession", "signIn", "signOut", "useSession", "SessionProvider", "getCsrfToken", "getProviders"] },
  "next-auth/react": { global: "nextAuthReact", namedExports: ["useSession", "signIn", "signOut", "SessionProvider", "getCsrfToken", "getProviders", "getSession"] },

  // Stripe
  "@stripe/stripe-js": { global: "stripeJs", namedExports: ["loadStripe", "Stripe"] },
  "@stripe/react-stripe-js": { global: "reactStripeJs", namedExports: ["Elements", "CardElement", "CardNumberElement", "CardExpiryElement", "CardCvcElement", "PaymentElement", "ExpressCheckoutElement", "PaymentRequestButtonElement", "LinkAuthenticationElement", "AddressElement", "useStripe", "useElements", "ElementsConsumer"] },

  // Rich text / Markdown
  "@tiptap/react": { global: "tiptapReact", namedExports: ["useEditor", "EditorContent", "BubbleMenu", "FloatingMenu", "EditorProvider", "useCurrentEditor"] },
  "@tiptap/starter-kit": { global: "tiptapStarterKit", hasDefault: true },
  "@tiptap/extension-link": { global: "tiptapLink", hasDefault: true },
  "@tiptap/extension-image": { global: "tiptapImage", hasDefault: true },
  "@tiptap/extension-placeholder": { global: "tiptapPlaceholder", hasDefault: true },
  "react-markdown": { global: "ReactMarkdown", hasDefault: true },
  "marked": { global: "marked", namedExports: ["marked", "parse", "lexer", "parser", "Marked", "Renderer", "Tokenizer"] },
  "remark-gfm": { global: "remarkGfm", hasDefault: true },
  "rehype-raw": { global: "rehypeRaw", hasDefault: true },
  "react-quill": { global: "ReactQuill", hasDefault: true },
  "slate": { global: "Slate", namedExports: ["createEditor", "Editor", "Transforms", "Range", "Point", "Path", "Node", "Text", "Element"] },
  "slate-react": { global: "SlateReact", namedExports: ["Slate", "Editable", "withReact", "useSlate", "useSlateStatic", "useFocused", "useSelected", "useReadOnly", "ReactEditor"] },

  // Syntax highlighting
  "highlight.js": { global: "hljs", hasDefault: true },
  "prismjs": { global: "Prism", hasDefault: true },
  "react-syntax-highlighter": { global: "SyntaxHighlighter", hasDefault: true, namedExports: ["Prism", "Light", "LightAsync", "PrismLight", "PrismAsync", "PrismAsyncLight"] },
  "shiki": { global: "shiki", namedExports: ["getHighlighter", "codeToHtml", "codeToThemedTokens", "renderToHtml", "BUNDLED_LANGUAGES", "BUNDLED_THEMES"] },

  // File handling
  "react-dropzone": { global: "reactDropzone", namedExports: ["useDropzone", "Dropzone"] },
  "react-cropper": { global: "ReactCropper", hasDefault: true },
  "cropperjs": { global: "Cropper", hasDefault: true },
  "filepond": { global: "FilePond", namedExports: ["create", "registerPlugin", "supported", "setOptions", "getOptions", "FileStatus", "FileOrigin", "OptionTypes"] },
  "react-filepond": { global: "reactFilePond", namedExports: ["FilePond", "registerPlugin"] },

  // Tables
  "@tanstack/react-table": { global: "reactTable", namedExports: ["useReactTable", "createColumnHelper", "flexRender", "getCoreRowModel", "getSortedRowModel", "getFilteredRowModel", "getPaginationRowModel", "getGroupedRowModel", "getExpandedRowModel", "getFacetedRowModel", "getFacetedUniqueValues", "getFacetedMinMaxValues"] },
  "react-table": { global: "reactTable", namedExports: ["useTable", "useSortBy", "useFilters", "usePagination", "useGlobalFilter", "useRowSelect", "useExpanded", "useGroupBy", "useColumnOrder", "useResizeColumns", "useBlockLayout", "useFlexLayout", "useAbsoluteLayout"] },
  "ag-grid-react": { global: "agGridReact", namedExports: ["AgGridReact"] },

  // Virtualization
  "@tanstack/react-virtual": { global: "reactVirtual", namedExports: ["useVirtualizer", "useWindowVirtualizer", "Virtualizer", "VirtualItem"] },
  "react-virtualized": { global: "ReactVirtualized", namedExports: ["List", "Grid", "Table", "Column", "AutoSizer", "CellMeasurer", "CellMeasurerCache", "Collection", "Masonry", "WindowScroller", "InfiniteLoader", "MultiGrid", "ScrollSync", "ArrowKeyStepper"] },
  "react-window": { global: "ReactWindow", namedExports: ["FixedSizeList", "FixedSizeGrid", "VariableSizeList", "VariableSizeGrid", "areEqual", "shouldComponentUpdate"] },

  // PDF
  "@react-pdf/renderer": { global: "reactPdfRenderer", namedExports: ["Document", "Page", "View", "Text", "Image", "Link", "Note", "Canvas", "StyleSheet", "Font", "pdf", "PDFViewer", "PDFDownloadLink", "BlobProvider", "usePDF", "renderToStream", "renderToFile", "renderToBuffer"] },
  "react-pdf": { global: "reactPdf", namedExports: ["Document", "Page", "Outline", "Thumbnail", "pdfjs"] },
  "pdfjs-dist": { global: "pdfjsLib", hasDefault: true },

  // Image
  "react-image-crop": { global: "ReactImageCrop", hasDefault: true, namedExports: ["ReactCrop", "Crop", "PixelCrop", "PercentCrop", "centerCrop", "makeAspectCrop", "containCrop"] },
  "react-zoom-pan-pinch": { global: "reactZoomPanPinch", namedExports: ["TransformWrapper", "TransformComponent", "useTransformContext", "useTransformInit", "useTransformEffect", "useControls"] },
  "react-medium-image-zoom": { global: "Zoom", hasDefault: true, namedExports: ["Controlled", "Uncontrolled"] },

  // Media
  "react-player": { global: "ReactPlayer", hasDefault: true },
  "video.js": { global: "videojs", hasDefault: true },
  "howler": { global: "Howler", namedExports: ["Howl", "Howler"] },
  "tone": { global: "Tone", hasDefault: true },

  // 3D
  "@react-three/fiber": { global: "reactThreeFiber", namedExports: ["Canvas", "useFrame", "useThree", "useLoader", "useGraph", "extend", "createRoot", "events", "addEffect", "addAfterEffect", "addTail", "invalidate", "advance", "getRootState"] },
  "@react-three/drei": { global: "drei", namedExports: ["OrbitControls", "TransformControls", "PerspectiveCamera", "OrthographicCamera", "Html", "Text", "Text3D", "Billboard", "Loader", "Stats", "Preload", "useGLTF", "useFBX", "useTexture", "useProgress", "Center", "Float", "Environment", "Stage", "ContactShadows", "Sky", "Stars", "Cloud", "Sparkles", "Sphere", "Box", "Plane", "Cylinder", "Cone", "Torus", "TorusKnot", "Tube", "useHelper", "Line", "QuadraticBezierLine", "CubicBezierLine", "CatmullRomLine", "Edges", "Outlines", "RoundedBox", "Icosahedron", "Octahedron", "Dodecahedron", "Tetrahedron", "Ring", "Circle", "Lathe", "Shape", "Extrude", "useAnimations"] },
  "three": { global: "THREE", hasDefault: true },

  // i18n
  "i18next": { global: "i18next", hasDefault: true, namedExports: ["use", "init", "t", "changeLanguage", "getFixedT", "exists", "getResourceBundle", "addResourceBundle", "hasResourceBundle", "removeResourceBundle", "loadNamespaces", "loadLanguages", "reloadResources", "setDefaultNamespace", "dir", "format", "createInstance", "cloneInstance", "on", "off", "getDataByLanguage", "language", "languages", "resolvedLanguage", "isInitialized", "store", "services", "options", "modules"] },
  "react-i18next": { global: "reactI18next", namedExports: ["Trans", "Translation", "useTranslation", "withTranslation", "I18nextProvider", "initReactI18next", "setDefaults", "getDefaults", "setI18n", "getI18n", "useSSR", "composeInitialProps"] },
  "next-intl": { global: "nextIntl", namedExports: ["useTranslations", "useFormatter", "useNow", "useTimeZone", "useLocale", "useMessages", "NextIntlClientProvider", "IntlError", "IntlErrorCode", "createSharedPathnamesNavigation", "createLocalizedPathnamesNavigation"] },

  // Utilities
  "lodash": { global: "_", hasDefault: true },
  "lodash-es": { global: "_", hasDefault: true },
  "underscore": { global: "_", hasDefault: true },
  "ramda": { global: "R", hasDefault: true },
  "uuid": { global: "uuid", namedExports: ["v1", "v3", "v4", "v5", "NIL", "version", "validate", "stringify", "parse"] },
  "nanoid": { global: "nanoid", namedExports: ["nanoid", "customAlphabet", "customRandom", "urlAlphabet", "random"] },
  "qs": { global: "Qs", hasDefault: true, namedExports: ["parse", "stringify"] },
  "query-string": { global: "queryString", namedExports: ["parse", "stringify", "parseUrl", "stringifyUrl", "pick", "exclude", "extract"] },
  "validator": { global: "validator", hasDefault: true },
  "email-validator": { global: "emailValidator", namedExports: ["validate"] },
  "libphonenumber-js": { global: "libphonenumber", namedExports: ["parsePhoneNumber", "parsePhoneNumberFromString", "isValidPhoneNumber", "isPossiblePhoneNumber", "formatPhoneNumber", "formatPhoneNumberIntl", "getCountryCallingCode", "getCountries", "AsYouType", "PhoneNumber", "isSupportedCountry", "getExampleNumber", "validatePhoneNumberLength"] },
  "numeral": { global: "numeral", hasDefault: true },
  "currency.js": { global: "currency", hasDefault: true },
  "accounting": { global: "accounting", hasDefault: true },
  "bignumber.js": { global: "BigNumber", hasDefault: true },
  "decimal.js": { global: "Decimal", hasDefault: true },

  // Node polyfills (browser)
  "path": { global: "pathBrowserify", hasDefault: true },
  "path-browserify": { global: "pathBrowserify", hasDefault: true },
  "buffer": { global: "Buffer", namedExports: ["Buffer"] },
  "process": { global: "process", hasDefault: true },
  "stream": { global: "stream", hasDefault: true },
  "stream-browserify": { global: "stream", hasDefault: true },
  "util": { global: "util", hasDefault: true },
  "events": { global: "EventEmitter", namedExports: ["EventEmitter"] },
  "crypto": { global: "crypto" },
  "crypto-browserify": { global: "crypto" },
  "assert": { global: "assert", hasDefault: true },
  "url": { global: "URL", namedExports: ["URL", "URLSearchParams", "parse", "format", "resolve"] },
  "querystring": { global: "querystring", namedExports: ["parse", "stringify", "decode", "encode"] },
  "os": { global: "os" },
  "os-browserify": { global: "os" },

  // HTTP
  "node-fetch": { global: "fetch", hasDefault: true },
  "cross-fetch": { global: "fetch", hasDefault: true },
  "ky": { global: "ky", hasDefault: true },
  "got": { global: "got", hasDefault: true },
  "superagent": { global: "superagent", hasDefault: true },

  // WebSocket
  "socket.io-client": { global: "io", hasDefault: true },
  "ws": { global: "WebSocket", hasDefault: true },

  // Testing (stubs)
  "@testing-library/react": { global: "testingLibraryReact", namedExports: ["render", "screen", "fireEvent", "waitFor", "within", "cleanup", "act"] },
  "@testing-library/jest-dom": { global: "jestDom" },
  "vitest": { global: "vitest", namedExports: ["describe", "it", "test", "expect", "vi", "beforeEach", "afterEach", "beforeAll", "afterAll"] },
  "jest": { global: "jest", namedExports: ["describe", "it", "test", "expect", "jest", "beforeEach", "afterEach", "beforeAll", "afterAll"] },

  // Scroll & Intersection
  "locomotive-scroll": { global: "LocomotiveScroll", hasDefault: true },
  "lenis": { global: "Lenis", hasDefault: true },
  "@studio-freight/lenis": { global: "Lenis", hasDefault: true },
  "react-scroll": { global: "reactScroll", namedExports: ["Link", "Element", "Events", "animateScroll", "scrollSpy", "scroller"] },
  "react-scroll-parallax": { global: "reactScrollParallax", namedExports: ["ParallaxProvider", "Parallax", "ParallaxBanner", "ParallaxBannerLayer", "useParallax", "useParallaxController"] },
  "react-intersection-observer": { global: "reactIntersectionObserver", namedExports: ["useInView", "InView", "useIntersection"] },

  // Floating UI
  "@floating-ui/react": { global: "floatingUI", namedExports: ["useFloating", "useHover", "useFocus", "useDismiss", "useRole", "useInteractions", "useClick", "useListNavigation", "useTypeahead", "FloatingPortal", "FloatingOverlay", "FloatingFocusManager", "FloatingArrow", "FloatingList", "FloatingTree", "FloatingNode", "FloatingDelayGroup", "offset", "flip", "shift", "autoPlacement", "size", "inline", "hide", "arrow", "autoUpdate", "computePosition", "platform"] },
  "@floating-ui/react-dom": { global: "floatingUI", namedExports: ["useFloating", "offset", "flip", "shift", "autoPlacement", "size", "inline", "hide", "arrow", "autoUpdate", "computePosition", "platform"] },
  "@floating-ui/dom": { global: "floatingUI", namedExports: ["computePosition", "offset", "flip", "shift", "autoPlacement", "size", "inline", "hide", "arrow", "autoUpdate", "platform"] },

  // Misc UI
  "react-portal": { global: "ReactPortal", hasDefault: true },
  "focus-trap-react": { global: "FocusTrap", hasDefault: true },
  "react-hotkeys-hook": { global: "reactHotkeysHook", namedExports: ["useHotkeys", "isHotkeyPressed", "useRecordHotkeys"] },
  "hotkeys-js": { global: "hotkeys", hasDefault: true },
  "react-copy-to-clipboard": { global: "CopyToClipboard", namedExports: ["CopyToClipboard"] },
  "clipboard": { global: "ClipboardJS", hasDefault: true },

  // QR & Barcode
  "qrcode.react": { global: "QRCode", namedExports: ["QRCodeSVG", "QRCodeCanvas"] },
  "react-qr-code": { global: "QRCode", hasDefault: true },
  "react-barcode": { global: "Barcode", hasDefault: true },
  "jsbarcode": { global: "JsBarcode", hasDefault: true },

  // Color picker
  "react-colorful": { global: "reactColorful", namedExports: ["HexColorPicker", "HexAlphaColorPicker", "RgbColorPicker", "RgbaColorPicker", "RgbStringColorPicker", "RgbaStringColorPicker", "HslColorPicker", "HslaColorPicker", "HslStringColorPicker", "HslaStringColorPicker", "HsvColorPicker", "HsvaColorPicker", "HsvStringColorPicker", "HsvaStringColorPicker", "HexColorInput"] },
  "react-color": { global: "reactColor", namedExports: ["SketchPicker", "ChromePicker", "PhotoshopPicker", "CompactPicker", "BlockPicker", "GithubPicker", "TwitterPicker", "HuePicker", "AlphaPicker", "CirclePicker", "SliderPicker", "SwatchesPicker", "MaterialPicker"] },

  // Emoji
  "emoji-mart": { global: "EmojiMart", namedExports: ["Picker", "Emoji", "emojiIndex", "store", "frequently", "NimblePicker", "NimbleEmoji"] },
  "@emoji-mart/react": { global: "EmojiMart", namedExports: ["Picker", "Emoji"] },
  "@emoji-mart/data": { global: "emojiMartData", hasDefault: true },

  // Code editors
  "@uiw/react-md-editor": { global: "MDEditor", hasDefault: true, namedExports: ["commands", "MarkdownPreview"] },
  "react-simplemde-editor": { global: "SimpleMDE", hasDefault: true },
  "@monaco-editor/react": { global: "MonacoEditor", hasDefault: true, namedExports: ["Editor", "DiffEditor", "useMonaco", "loader"] },
  "monaco-editor": { global: "monaco" },
  "codemirror": { global: "CodeMirror", hasDefault: true },
  "@codemirror/state": { global: "codemirrorState", namedExports: ["EditorState", "StateField", "StateEffect", "Facet", "Compartment", "Transaction", "Text", "Annotation", "ChangeSet", "ChangeDesc", "CharCategory"] },
  "@codemirror/view": { global: "codemirrorView", namedExports: ["EditorView", "ViewPlugin", "ViewUpdate", "Decoration", "DecorationSet", "WidgetType", "drawSelection", "highlightActiveLine", "highlightSpecialChars", "keymap", "rectangularSelection", "crosshairCursor", "dropCursor", "lineNumbers", "highlightActiveLineGutter", "gutter", "gutters", "GutterMarker", "placeholder", "tooltips", "showTooltip", "hoverTooltip"] },
  "react-codemirror2": { global: "reactCodeMirror", namedExports: ["Controlled", "UnControlled"] },

  // Signature
  "react-signature-canvas": { global: "SignatureCanvas", hasDefault: true },

  // Tours
  "react-joyride": { global: "Joyride", hasDefault: true, namedExports: ["STATUS", "ACTIONS", "EVENTS", "LIFECYCLE"] },
  "@reactour/tour": { global: "reactTour", namedExports: ["TourProvider", "useTour"] },
  "intro.js": { global: "introJs", hasDefault: true },
  "intro.js-react": { global: "introJsReact", namedExports: ["Steps", "Hints"] },

  // Confetti
  "canvas-confetti": { global: "confetti", hasDefault: true },
  "react-confetti": { global: "ReactConfetti", hasDefault: true },

  // Lottie
  "lottie-react": { global: "Lottie", hasDefault: true, namedExports: ["useLottie", "useLottieInteractivity"] },
  "lottie-web": { global: "lottie", hasDefault: true },
  "@lottiefiles/react-lottie-player": { global: "LottiePlayer", namedExports: ["Player", "Controls"] },

  // Particles
  "tsparticles": { global: "tsParticles" },
  "react-tsparticles": { global: "Particles", hasDefault: true },
  "@tsparticles/react": { global: "Particles", namedExports: ["Particles"] },

  // Type animation
  "react-type-animation": { global: "TypeAnimation", namedExports: ["TypeAnimation"] },
  "typed.js": { global: "Typed", hasDefault: true },
  "react-typed": { global: "ReactTyped", hasDefault: true, namedExports: ["ReactTyped"] },

  // Count up
  "react-countup": { global: "CountUp", hasDefault: true, namedExports: ["useCountUp"] },
  "countup.js": { global: "CountUp", namedExports: ["CountUp"] },

  // Masonry
  "react-masonry-css": { global: "Masonry", hasDefault: true },
  "masonry-layout": { global: "Masonry", hasDefault: true },

  // Infinite scroll
  "react-infinite-scroll-component": { global: "InfiniteScroll", hasDefault: true },
  "react-infinite-scroller": { global: "InfiniteScroll", hasDefault: true },
  "react-pull-to-refresh": { global: "PullToRefresh", hasDefault: true },

  // Loading
  "react-loading-skeleton": { global: "Skeleton", hasDefault: true },
  "react-content-loader": { global: "ContentLoader", hasDefault: true, namedExports: ["Facebook", "Instagram", "Code", "List", "BulletList"] },
  "react-spinners": { global: "reactSpinners", namedExports: ["BeatLoader", "BarLoader", "BounceLoader", "CircleLoader", "ClimbingBoxLoader", "ClipLoader", "ClockLoader", "DotLoader", "FadeLoader", "GridLoader", "HashLoader", "MoonLoader", "PacmanLoader", "PropagateLoader", "PuffLoader", "PulseLoader", "RingLoader", "RiseLoader", "RotateLoader", "ScaleLoader", "SkewLoader", "SquareLoader", "SyncLoader"] },
  "react-loader-spinner": { global: "Loader", namedExports: ["Oval", "ThreeDots", "TailSpin", "Rings", "Puff", "Bars", "Audio", "BallTriangle", "Grid", "Hearts", "InfinitySpin", "LineWave", "MagnifyingGlass", "MutatingDots", "ProgressBar", "Radio", "RotatingLines", "RotatingSquare", "Vortex", "Watch", "Comment", "ColorRing", "Triangle", "Circles", "Dna", "FallingLines", "FidgetSpinner", "Hourglass"] },
  "nprogress": { global: "NProgress", hasDefault: true },
  "react-top-loading-bar": { global: "LoadingBar", hasDefault: true },

  // Tooltips
  "react-tooltip": { global: "ReactTooltip", hasDefault: true, namedExports: ["Tooltip"] },
  "tippy.js": { global: "tippy", hasDefault: true },
  "@tippyjs/react": { global: "Tippy", hasDefault: true },
  "react-tiny-popover": { global: "Popover", namedExports: ["Popover", "ArrowContainer", "useArrowContainer"] },

  // Modal
  "react-modal": { global: "ReactModal", hasDefault: true },

  // Tabs & Collapse
  "react-tabs": { global: "ReactTabs", namedExports: ["Tab", "Tabs", "TabList", "TabPanel"] },
  "react-collapse": { global: "ReactCollapse", namedExports: ["Collapse", "UnmountClosed"] },

  // Tree
  "react-arborist": { global: "ReactArborist", namedExports: ["Tree", "useTree", "TreeApi"] },
  "react-treeview": { global: "TreeView", hasDefault: true },

  // Timeline & Stepper
  "react-vertical-timeline-component": { global: "VerticalTimeline", namedExports: ["VerticalTimeline", "VerticalTimelineElement"] },
  "react-stepper-horizontal": { global: "Stepper", hasDefault: true },

  // Rating
  "react-rating": { global: "Rating", hasDefault: true },
  "react-rating-stars-component": { global: "ReactStars", hasDefault: true },

  // Slider & Toggle
  "rc-slider": { global: "Slider", hasDefault: true, namedExports: ["Range", "Handle", "createSliderWithTooltip"] },
  "react-slider": { global: "ReactSlider", hasDefault: true },
  "react-toggle": { global: "Toggle", hasDefault: true },

  // Number/Phone input
  "react-number-format": { global: "NumberFormat", hasDefault: true, namedExports: ["NumericFormat", "PatternFormat"] },
  "react-phone-number-input": { global: "PhoneInput", hasDefault: true, namedExports: ["formatPhoneNumber", "formatPhoneNumberIntl", "isValidPhoneNumber", "isPossiblePhoneNumber", "parsePhoneNumber", "getCountryCallingCode", "getCountries"] },
  "react-phone-input-2": { global: "PhoneInput", hasDefault: true },

  // Credit card
  "react-credit-cards": { global: "Cards", hasDefault: true },
  "react-credit-cards-2": { global: "Cards", hasDefault: true },

  // Autocomplete
  "react-google-autocomplete": { global: "Autocomplete", hasDefault: true, namedExports: ["usePlacesWidget"] },
  "@react-google-maps/autocomplete": { global: "Autocomplete", namedExports: ["Autocomplete", "StandaloneSearchBox"] },
  "react-select": { global: "Select", hasDefault: true, namedExports: ["components", "createFilter", "defaultTheme", "mergeStyles", "useStateManager"] },
  "react-select-async-paginate": { global: "AsyncPaginate", namedExports: ["AsyncPaginate", "withAsyncPaginate", "useAsyncPaginate", "useComponents"] },
  "react-autosuggest": { global: "Autosuggest", hasDefault: true },
  "downshift": { global: "Downshift", hasDefault: true, namedExports: ["useSelect", "useCombobox", "useMultipleSelection"] },

  // Tags
  "react-tag-input": { global: "ReactTags", namedExports: ["WithContext", "WithOutContext", "KEYS"] },
  "react-tagsinput": { global: "TagsInput", hasDefault: true },

  // Mentions
  "react-mentions": { global: "reactMentions", namedExports: ["Mention", "MentionsInput"] },

  // Spreadsheet & Data grid
  "react-spreadsheet": { global: "Spreadsheet", hasDefault: true },
  "react-data-grid": { global: "DataGrid", hasDefault: true },

  // Gantt
  "gantt-task-react": { global: "GanttTask", namedExports: ["Gantt", "Task", "ViewMode"] },

  // Org chart
  "react-organizational-chart": { global: "OrgChart", namedExports: ["Tree", "TreeNode"] },

  // Flow diagrams
  "reactflow": { global: "ReactFlow", hasDefault: true, namedExports: ["Background", "MiniMap", "Controls", "Handle", "Position", "MarkerType", "useNodes", "useEdges", "useReactFlow", "addEdge", "applyNodeChanges", "applyEdgeChanges", "getBezierPath", "getSmoothStepPath", "getStraightPath", "useNodesState", "useEdgesState", "useOnSelectionChange", "useOnViewportChange", "Panel", "NodeToolbar", "EdgeLabelRenderer", "BaseEdge", "EdgeText"] },
  "@xyflow/react": { global: "ReactFlow", hasDefault: true, namedExports: ["Background", "MiniMap", "Controls", "Handle", "Position", "MarkerType", "useNodes", "useEdges", "useReactFlow", "addEdge", "applyNodeChanges", "applyEdgeChanges", "getBezierPath", "getSmoothStepPath", "getStraightPath", "useNodesState", "useEdgesState", "useOnSelectionChange", "useOnViewportChange", "Panel", "NodeToolbar", "EdgeLabelRenderer", "BaseEdge", "EdgeText"] },
  "react-diagrams": { global: "reactDiagrams" },
  "react-mindmap": { global: "ReactMindmap", hasDefault: true },

  // Canvas / Fabric
  "react-konva": { global: "ReactKonva", namedExports: ["Stage", "Layer", "Rect", "Circle", "Ellipse", "Line", "Image", "Text", "TextPath", "Star", "Ring", "Arc", "Label", "Tag", "Path", "RegularPolygon", "Arrow", "Shape", "Sprite", "Group", "Transformer", "Wedge"] },
  "konva": { global: "Konva", hasDefault: true },
  "fabric": { global: "fabric" },
  "react-fabric": { global: "reactFabric" },

  // SVG
  "react-svg": { global: "ReactSVG", hasDefault: true },

  // Router
  "react-router-dom": { global: "ReactRouterDOM", namedExports: ["BrowserRouter", "HashRouter", "MemoryRouter", "Link", "NavLink", "Navigate", "Outlet", "Route", "Routes", "useLocation", "useNavigate", "useParams", "useSearchParams", "useMatch", "useRoutes", "createBrowserRouter", "createHashRouter", "createMemoryRouter", "RouterProvider", "createRoutesFromElements", "ScrollRestoration", "useBeforeUnload", "useBlocker", "useFetcher", "useFetchers", "useFormAction", "useLoaderData", "useActionData", "useNavigation", "useRevalidator", "useMatches", "useRouteLoaderData", "useAsyncValue", "useAsyncError", "Await", "Form", "redirect", "json", "defer", "generatePath", "matchPath", "matchRoutes", "resolvePath", "renderMatches", "createSearchParams"] },

  // AI SDKs
  "@ai-sdk/react": { global: "aiSdkReact", namedExports: ["useChat", "useCompletion", "useAssistant", "useObject", "experimental_useAssistant"] },
  "ai": { global: "ai", namedExports: ["streamText", "generateText", "streamObject", "generateObject", "embed", "embedMany", "tool", "createStreamableValue", "createStreamableUI", "readStreamableValue", "StreamingTextResponse", "StreamData", "createAI", "AIStream", "OpenAIStream", "AnthropicStream", "CohereStream", "HuggingFaceStream", "LangChainStream", "ReplicateStream"] },
  "openai": { global: "OpenAI", hasDefault: true },
  "@anthropic-ai/sdk": { global: "Anthropic", hasDefault: true },

  // Realtime
  "pusher-js": { global: "Pusher", hasDefault: true },
  "ably": { global: "Ably", hasDefault: true },
  "@ably-labs/react-hooks": { global: "ablyReactHooks", namedExports: ["useChannel", "usePresence", "useAbly", "AblyProvider"] },

  // Additional missing libraries
  "@hookform/error-message": { global: "hookformErrorMessage", namedExports: ["ErrorMessage"] },
  "@supabase/ssr": { global: "supabaseSsr", namedExports: ["createBrowserClient", "createServerClient"] },
  "firebase/storage": { global: "firebaseStorage", namedExports: ["getStorage", "ref", "uploadBytes", "uploadBytesResumable", "uploadString", "getDownloadURL", "getMetadata", "updateMetadata", "deleteObject", "list", "listAll", "getBlob", "getBytes", "getStream", "connectStorageEmulator"] },
  
  // FullCalendar
  "@fullcalendar/react": { global: "FullCalendar", hasDefault: true },
  "@fullcalendar/core": { global: "FullCalendarCore", namedExports: ["Calendar", "createPlugin", "sliceEvents", "createDuration", "formatDate", "formatRange"] },
  "@fullcalendar/daygrid": { global: "fullcalendarDayGrid", hasDefault: true },
  "@fullcalendar/timegrid": { global: "fullcalendarTimeGrid", hasDefault: true },
  "@fullcalendar/list": { global: "fullcalendarList", hasDefault: true },
  "@fullcalendar/interaction": { global: "fullcalendarInteraction", hasDefault: true },

  // Lexical
  "lexical": { global: "Lexical", namedExports: ["createEditor", "$getRoot", "$getSelection", "$createParagraphNode", "$createTextNode", "TextNode", "ElementNode", "DecoratorNode", "LexicalEditor", "RootNode", "LineBreakNode", "ParagraphNode", "COMMAND_PRIORITY_LOW", "COMMAND_PRIORITY_NORMAL", "COMMAND_PRIORITY_HIGH", "COMMAND_PRIORITY_CRITICAL", "COMMAND_PRIORITY_EDITOR", "KEY_ENTER_COMMAND", "KEY_BACKSPACE_COMMAND", "KEY_DELETE_COMMAND", "KEY_TAB_COMMAND", "KEY_ESCAPE_COMMAND", "KEY_ARROW_UP_COMMAND", "KEY_ARROW_DOWN_COMMAND", "KEY_ARROW_LEFT_COMMAND", "KEY_ARROW_RIGHT_COMMAND", "FORMAT_TEXT_COMMAND", "FORMAT_ELEMENT_COMMAND", "INSERT_LINE_BREAK_COMMAND", "INSERT_PARAGRAPH_COMMAND", "UNDO_COMMAND", "REDO_COMMAND", "CAN_UNDO_COMMAND", "CAN_REDO_COMMAND", "CLEAR_EDITOR_COMMAND", "CLEAR_HISTORY_COMMAND", "FOCUS_COMMAND", "BLUR_COMMAND", "SELECTION_CHANGE_COMMAND", "CLICK_COMMAND", "PASTE_COMMAND", "COPY_COMMAND", "CUT_COMMAND", "DROP_COMMAND", "DRAGSTART_COMMAND", "DRAGEND_COMMAND", "DRAGOVER_COMMAND"] },
  "@lexical/react": { global: "LexicalReact", namedExports: ["LexicalComposer", "LexicalComposerContext", "useLexicalComposerContext", "ContentEditable", "LexicalContentEditable", "PlainTextPlugin", "RichTextPlugin", "HistoryPlugin", "OnChangePlugin", "AutoFocusPlugin", "LinkPlugin", "ListPlugin", "CheckListPlugin", "TablePlugin", "HorizontalRulePlugin", "MarkdownShortcutPlugin", "CodeHighlightPlugin", "AutoLinkPlugin", "LexicalClickableLinkPlugin", "LexicalErrorBoundary", "TreeView", "useLexicalIsTextContentEmpty", "useLexicalTextEntity", "LexicalNestedComposer", "LexicalHorizontalRuleNode", "LexicalDecoratorBlockNode", "CharacterLimitPlugin", "ClearEditorPlugin", "CollaborationPlugin", "HashtagPlugin", "MaxLengthPlugin", "TabIndentationPlugin", "TableOfContentsPlugin", "EditorRefPlugin"] },

  // Virtuoso
  "react-virtuoso": { global: "ReactVirtuoso", namedExports: ["Virtuoso", "GroupedVirtuoso", "VirtuosoGrid", "TableVirtuoso", "VirtuosoHandle", "GroupedVirtuosoHandle", "VirtuosoGridHandle", "TableVirtuosoHandle"] },

  // PDF
  "pdf-lib": { global: "PDFLib", namedExports: ["PDFDocument", "PDFPage", "PDFFont", "PDFImage", "StandardFonts", "rgb", "cmyk", "grayscale", "degrees", "radians", "PageSizes", "BlendMode", "LineCapStyle", "LineJoinStyle", "TextAlignment", "RotationTypes", "drawRectangle", "drawEllipse", "drawCircle", "drawLine", "drawSvgPath"] },

  // Plyr
  "plyr-react": { global: "PlyrReact", hasDefault: true, namedExports: ["usePlyr"] },
  "plyr": { global: "Plyr", hasDefault: true },

  // Wavesurfer
  "wavesurfer.js": { global: "WaveSurfer", hasDefault: true },

  // Google Generative AI
  "@google/generative-ai": { global: "GoogleGenerativeAI", namedExports: ["GoogleGenerativeAI", "HarmCategory", "HarmBlockThreshold", "TaskType", "ChatSession", "GenerativeModel"] },

  // Textarea autosize
  "react-textarea-autosize": { global: "TextareaAutosize", hasDefault: true },

  // Input mask
  "react-input-mask": { global: "InputMask", hasDefault: true },
  "react-imask": { global: "IMaskInput", namedExports: ["IMaskInput", "useIMask", "IMask"] },

  // Workbox
  "workbox-window": { global: "workbox", namedExports: ["Workbox", "messageSW"] },

  // Helmet
  "react-helmet": { global: "ReactHelmet", namedExports: ["Helmet"] },
  "react-helmet-async": { global: "ReactHelmetAsync", namedExports: ["Helmet", "HelmetProvider"] },

  // React Aria
  "@react-aria/focus": { global: "reactAriaFocus", namedExports: ["useFocusRing", "useFocusVisible", "useFocus", "useFocusWithin", "FocusRing", "FocusScope"] },
  "@react-aria/utils": { global: "reactAriaUtils", namedExports: ["useId", "mergeProps", "mergeRefs", "chain", "useObjectRef", "useLayoutEffect", "useResizeObserver", "useViewportSize", "useDescription", "useSyncRef", "runAfterTransition", "useEvent", "useGlobalListeners", "useLabels", "useDrag1D", "isAndroid", "isIOS", "isMac", "isAppleDevice", "isWebKit", "isIPad", "isIPhone", "getScrollParent", "isScrollable", "getOffset", "clamp", "snapValueToStep", "toDataAttributes", "useEffectEvent"] },
  "@react-aria/interactions": { global: "reactAriaInteractions", namedExports: ["usePress", "useHover", "useFocus", "useFocusVisible", "useFocusWithin", "useKeyboard", "useMove", "useLongPress", "PressResponder", "Pressable"] },
  
  // React Focus Lock
  "react-focus-lock": { global: "FocusLock", hasDefault: true },

  // Grid Layout
  "react-grid-layout": { global: "ReactGridLayout", hasDefault: true, namedExports: ["WidthProvider", "Responsive", "GridLayout"] },

  // Image Gallery
  "react-image-gallery": { global: "ImageGallery", hasDefault: true },
  "lightgallery": { global: "lightGallery", hasDefault: true },
  "lightgallery/react": { global: "LightGallery", hasDefault: true },

  // Slick Carousel
  "slick-carousel": { global: "slick" },

  // Motion One
  "motion": { global: "Motion", namedExports: ["animate", "timeline", "stagger", "spring", "glide", "createMotionState", "createStyles", "style", "inView", "scroll", "scrollInfo", "resize", "withControls"] },
  "@motionone/solid": { global: "motionOneSolid" },

  // Nivo (all packages)
  "@nivo/core": { global: "nivoCore", namedExports: ["ResponsiveWrapper", "Container", "SvgWrapper", "useDimensions", "useTheme", "useMotionConfig", "usePartialTheme", "ThemeProvider", "useTooltip", "Tooltip", "TooltipWrapper", "Crosshair", "Chip", "TableTooltip", "BasicTooltip"] },
  "@nivo/bar": { global: "nivoBar", namedExports: ["Bar", "ResponsiveBar", "BarCanvas", "ResponsiveBarCanvas"] },
  "@nivo/line": { global: "nivoLine", namedExports: ["Line", "ResponsiveLine", "LineCanvas", "ResponsiveLineCanvas"] },
  "@nivo/pie": { global: "nivoPie", namedExports: ["Pie", "ResponsivePie", "PieCanvas", "ResponsivePieCanvas"] },
  "@nivo/heatmap": { global: "nivoHeatmap", namedExports: ["HeatMap", "ResponsiveHeatMap", "HeatMapCanvas", "ResponsiveHeatMapCanvas"] },
  "@nivo/treemap": { global: "nivoTreemap", namedExports: ["TreeMap", "ResponsiveTreeMap", "TreeMapHtml", "ResponsiveTreeMapHtml", "TreeMapCanvas", "ResponsiveTreeMapCanvas"] },
  "@nivo/sankey": { global: "nivoSankey", namedExports: ["Sankey", "ResponsiveSankey"] },
  "@nivo/network": { global: "nivoNetwork", namedExports: ["Network", "ResponsiveNetwork", "NetworkCanvas", "ResponsiveNetworkCanvas"] },
  "@nivo/radar": { global: "nivoRadar", namedExports: ["Radar", "ResponsiveRadar"] },
  "@nivo/funnel": { global: "nivoFunnel", namedExports: ["Funnel", "ResponsiveFunnel"] },

  // AG Grid
  "ag-grid-community": { global: "agGrid", namedExports: ["Grid", "createGrid", "ModuleRegistry", "ColDef", "GridApi", "ColumnApi", "GridOptions", "ICellRendererParams", "ICellEditorParams", "IFilterParams", "ValueFormatterParams", "ValueGetterParams", "ValueSetterParams"] },

  // TipTap PM
  "@tiptap/pm": { global: "tiptapPm" },
  "@tiptap/pm/state": { global: "tiptapPmState", namedExports: ["EditorState", "Plugin", "PluginKey", "Selection", "TextSelection", "NodeSelection", "AllSelection", "Transaction"] },
  "@tiptap/pm/view": { global: "tiptapPmView", namedExports: ["EditorView", "Decoration", "DecorationSet", "NodeView"] },
  "@tiptap/pm/model": { global: "tiptapPmModel", namedExports: ["Node", "Mark", "Schema", "Fragment", "Slice", "ResolvedPos", "NodeRange", "NodeType", "MarkType", "ContentMatch", "DOMParser", "DOMSerializer"] },
  "@tiptap/pm/transform": { global: "tiptapPmTransform", namedExports: ["Transform", "Step", "StepResult", "Mapping", "MapResult", "AddMarkStep", "RemoveMarkStep", "ReplaceStep", "ReplaceAroundStep", "canSplit", "liftTarget", "findWrapping", "canJoin", "joinPoint", "insertPoint", "dropPoint"] },
  "@tiptap/pm/commands": { global: "tiptapPmCommands", namedExports: ["baseKeymap", "toggleMark", "setBlockType", "wrapIn", "lift", "joinUp", "joinDown", "selectParentNode", "selectAll", "deleteSelection", "joinBackward", "joinForward", "selectNodeBackward", "selectNodeForward", "selectTextblockStart", "selectTextblockEnd", "createParagraphNear", "liftEmptyBlock", "splitBlock", "splitBlockKeepMarks", "newlineInCode", "exitCode", "chainCommands", "pcBaseKeymap", "macBaseKeymap"] },
  "@tiptap/pm/history": { global: "tiptapPmHistory", namedExports: ["history", "undo", "redo", "undoDepth", "redoDepth", "closeHistory"] },

  // CodeMirror language support
  "@codemirror/lang-javascript": { global: "codemirrorLangJs", namedExports: ["javascript", "javascriptLanguage", "typescriptLanguage", "jsxLanguage", "tsxLanguage", "localCompletionSource", "completionPath", "scopeCompletionSource", "snippets", "esLint"] },
  "@codemirror/lang-html": { global: "codemirrorLangHtml", namedExports: ["html", "htmlLanguage", "htmlCompletionSource", "htmlCompletionSourceWith"] },
  "@codemirror/lang-css": { global: "codemirrorLangCss", namedExports: ["css", "cssLanguage", "cssCompletionSource", "defineCSSCompletionSource"] },
  "@codemirror/lang-json": { global: "codemirrorLangJson", namedExports: ["json", "jsonLanguage", "jsonParseLinter", "jsonCompletionSource"] },
  "@codemirror/lang-markdown": { global: "codemirrorLangMarkdown", namedExports: ["markdown", "markdownLanguage", "commonmarkLanguage", "markdownKeymap", "insertNewlineContinueMarkup", "deleteMarkupBackward"] },
  "@codemirror/lang-python": { global: "codemirrorLangPython", namedExports: ["python", "pythonLanguage", "localCompletionSource", "globalCompletion"] },
  "@codemirror/lang-sql": { global: "codemirrorLangSql", namedExports: ["sql", "MySQL", "PostgreSQL", "SQLite", "Cassandra", "MSSQL", "MariaSQL", "PLSQL", "StandardSQL", "schemaCompletionSource", "keywordCompletionSource", "SQLDialect", "SQLConfig"] },

  // Lib utils
  "@/lib/utils": { global: "__libUtilsModule", namedExports: ["cn"] },
};

function transformImportLine(files: FileMap, fromPath: string, line: string): string {
  // Handle TypeScript "import type" statements - strip them entirely as they don't exist at runtime
  if (/^import\s+type\s+/.test(line)) {
    return "// Type-only import removed";
  }

  // Handle inline type imports like: import { type Foo, Bar } from '...'
  // We need to remove the "type" keyword from these
  let cleanedLine = line.replace(/\{\s*type\s+([^,}]+)/g, (match, p1) => {
    // If this is the only import, we'll handle it below
    return `{ ${p1}`;
  }).replace(/,\s*type\s+([^,}]+)/g, (match, p1) => {
    // Remove additional type imports
    return `, ${p1}`;
  });

  // Handle side-effect imports: import 'pkg' or import 'file.css'
  const sideEffectMatch = cleanedLine.match(/^import\s+['"]([^'"]+)['"];?\s*$/);
  if (sideEffectMatch) {
    const spec = sideEffectMatch[1].trim();
    // CSS/SCSS side-effect imports - skip
    if (/\.(css|scss|sass|less)$/.test(spec)) {
      return "// CSS import skipped in sandbox";
    }
    // Other side-effect imports (like polyfills) - skip but log
    return `// Side-effect import '${spec}' skipped in sandbox`;
  }

  // import X from '...'
  // import { A, B as C } from '...'
  // import X, { A } from '...'
  // import * as X from '...'
  const m = cleanedLine.match(/^import\s+(.+?)\s+from\s+['"]([^'"]+)['"];?\s*$/);
  if (!m) return "";

  const bindings = m[1].trim();
  const spec = m[2].trim();
  const resolved = resolveModulePath(files, spec, fromPath);

  // For non-local imports we cannot resolve in the sandbox.
  // However, we have a mapping of external modules to window globals.
  if (!resolved) {
    // Check if we have a mapping for this module
    const moduleInfo = EXTERNAL_MODULE_MAP[spec];
    
    // Handle CSS/SCSS module imports (just skip them)
    if (/\.(css|scss|sass|less|module\.css|module\.scss)$/.test(spec)) {
      return "// CSS import skipped in sandbox";
    }

    // Handle asset imports (images, fonts, etc.) - return nice placeholder
    if (/\.(png|jpg|jpeg|gif|svg|webp|ico|bmp|tiff)$/i.test(spec)) {
      const varName = bindings.trim();
      // Create a nicer placeholder with the image icon and filename
      const fileName = spec.split('/').pop() || 'image';
      // SVG placeholder with image icon and filename text
      const placeholderSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23374151' width='400' height='300' rx='8'/%3E%3Crect x='140' y='80' width='120' height='100' rx='8' fill='%234B5563' stroke='%236B7280' stroke-width='2'/%3E%3Ccircle cx='170' cy='115' r='12' fill='%239CA3AF'/%3E%3Cpath d='M150 165 L175 135 L200 155 L225 125 L250 165 Z' fill='%239CA3AF'/%3E%3Ctext x='200' y='220' text-anchor='middle' fill='%239CA3AF' font-family='system-ui, sans-serif' font-size='14'%3E" + encodeURIComponent(fileName) + "%3C/text%3E%3C/svg%3E";
      return `const ${varName} = \"${placeholderSvg}\"; // Image placeholder`;
    }

    if (/\.(mp4|webm|ogg|mp3|wav|flac|aac)$/i.test(spec)) {
      const varName = bindings.trim();
      return `const ${varName} = ""; // Media placeholder`;
    }

    if (/\.(woff|woff2|ttf|eot|otf)$/i.test(spec)) {
      const varName = bindings.trim();
      return `const ${varName} = ""; // Font placeholder`;
    }

    if (/\.json$/i.test(spec)) {
      const varName = bindings.trim();
      return `const ${varName} = {}; // JSON placeholder`;
    }

    // Handle @/ imports that couldn't be resolved - provide stub components
    if (spec.startsWith("@/") || spec.startsWith("~/")) {
      const out: string[] = [];
      
      // Check for shadcn UI components
      if (spec.includes("/components/ui/") || spec.includes("/lib/utils") || spec.includes("/hooks/")) {
        // Extract the named imports and provide stub implementations
        const namedMatch = bindings.match(/\{([^}]+)\}/);
        if (namedMatch) {
          const imports = namedMatch[1]
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => {
              const mm = s.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
              if (!mm) return null;
              const imported = mm[1];
              const local = mm[2] ?? mm[1];
              
              // cn utility function
              if (imported === "cn") {
                return `const ${local} = (...args) => args.filter(Boolean).join(' ');`;
              }
              
              // toast hook
              if (imported === "useToast" || imported === "toast") {
                if (imported === "useToast") {
                  return `const ${local} = () => ({ toast: (opts) => console.log('Toast:', opts), toasts: [], dismiss: () => {} });`;
                }
                return `const ${local} = (opts) => console.log('Toast:', opts);`;
              }
              
              // use-mobile hook
              if (imported === "useIsMobile" || imported === "useMobile") {
                return `const ${local} = () => false;`;
              }
              
              // All other UI components - create passthrough React components
              return `const ${local} = window.React.forwardRef(({ className, children, ...props }, ref) => window.React.createElement('div', { ref, className, ...props }, children));`;
            })
            .filter(Boolean);
          
          out.push(...imports);
        }
        
        // Handle default imports
        const parts = bindings.split(",").map((s) => s.trim()).filter(Boolean);
        const first = parts[0];
        if (first && !first.startsWith("{") && !first.startsWith("*")) {
          out.push(`const ${first} = window.React.forwardRef(({ className, children, ...props }, ref) => window.React.createElement('div', { ref, className, ...props }, children));`);
        }
        
        if (out.length > 0) {
          return out.join("\n");
        }
      }
      
      // For other @/ imports that couldn't be resolved, provide empty stubs
      const namedMatch = bindings.match(/\{([^}]+)\}/);
      if (namedMatch) {
        const imports = namedMatch[1]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => {
            const mm = s.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
            if (!mm) return null;
            const local = mm[2] ?? mm[1];
            return `const ${local} = undefined; // Stub for unresolved import from '${spec}'`;
          })
          .filter(Boolean);
        
        out.push(...imports);
      }
      
      const parts = bindings.split(",").map((s) => s.trim()).filter(Boolean);
      const first = parts[0];
      if (first && !first.startsWith("{") && !first.startsWith("*")) {
        out.push(`const ${first} = undefined; // Stub for unresolved import from '${spec}'`);
      }
      
      if (out.length > 0) {
        return `// Warning: Could not resolve '${spec}' - using stubs\n${out.join("\n")}`;
      }
    }
    
    if (moduleInfo) {
      const out: string[] = [];
      const globalRef = `window.${moduleInfo.global.replace(/\./g, '?.')}`;

      // import * as X from 'module'
      if (bindings.startsWith("*")) {
        const mm = bindings.match(/^\*\s+as\s+([A-Za-z_$][\w$]*)$/);
        if (mm) out.push(`const ${mm[1]} = ${globalRef} || {};`);
        return out.join("\n");
      }

      const parts = bindings.split(",").map((s) => s.trim()).filter(Boolean);
      const first = parts[0];

      // default import
      if (first && !first.startsWith("{")) {
        if (moduleInfo.hasDefault) {
          out.push(`const ${first} = ${globalRef};`);
        } else {
          out.push(`const ${first} = ${globalRef} || {};`);
        }
      }

      // named imports
      const namedMatch = bindings.match(/\{([^}]+)\}/);
      if (namedMatch) {
        const imports = namedMatch[1]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => {
            const mm = s.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
            if (!mm) return null;
            const imported = mm[1];
            const local = mm[2] ?? mm[1];

            // For lucide-react, treat unknown named exports as icon components
            if (spec === "lucide-react") {
              if (["icons", "Icon", "createLucideIcon", "dynamicIconImports"].includes(imported)) {
                return `const ${local} = ${globalRef}?.${imported};`;
              }
              return `const ${local} = ${globalRef}?.[${JSON.stringify(imported)}];`;
            }

            // For icon libraries with proxy support
            if (["@heroicons/react", "@heroicons/react/24/solid", "@heroicons/react/24/outline", "@heroicons/react/20/solid", "react-icons", "@tabler/icons-react", "phosphor-react", "@phosphor-icons/react", "iconoir-react", "react-feather"].includes(spec)) {
              return `const ${local} = ${globalRef}?.[${JSON.stringify(imported)}];`;
            }

            // Standard named export
            return local === imported 
              ? `${imported}` 
              : `${imported}: ${local}`;
          })
          .filter(Boolean);

        // Group standard destructuring vs individual const assignments
        const destructured = imports.filter(i => typeof i === 'string' && !i.startsWith('const '));
        const individual = imports.filter(i => typeof i === 'string' && i.startsWith('const '));

        if (destructured.length > 0) {
          out.push(`const { ${destructured.join(", ")} } = ${globalRef} || {};`);
        }
        if (individual.length > 0) {
          out.push(...individual);
        }
      }

      return out.join("\n");
    }

    // Any other external dependency - provide a warning stub instead of crashing
    console.warn(`Sandbox: Could not resolve import '${spec}'`);
    
    const out: string[] = [];
    const namedMatch = bindings.match(/\{([^}]+)\}/);
    if (namedMatch) {
      const imports = namedMatch[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const mm = s.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
          if (!mm) return null;
          const local = mm[2] ?? mm[1];
          return local;
        })
        .filter(Boolean);
      
      if (imports.length > 0) {
        out.push(`const { ${imports.join(", ")} } = {}; // Stub for unresolved external '${spec}'`);
      }
    }
    
    const parts = bindings.split(",").map((s) => s.trim()).filter(Boolean);
    const first = parts[0];
    if (first && !first.startsWith("{") && !first.startsWith("*")) {
      out.push(`const ${first} = undefined; // Stub for unresolved external '${spec}'`);
    }
    
    if (out.length > 0) {
      return `// Warning: External module '${spec}' not available in sandbox\n${out.join("\n")}`;
    }
    
    return `// Warning: Could not process import from '${spec}'`;
  }

  const moduleRef = `__require(${JSON.stringify(resolved)})`;
  const out: string[] = [];

  // namespace import
  if (bindings.startsWith("*")) {
    const mm = bindings.match(/^\*\s+as\s+([A-Za-z_$][\w$]*)$/);
    if (mm) out.push(`const ${mm[1]} = ${moduleRef};`);
    return out.join("\n");
  }

  // split default + named
  const parts = bindings.split(",").map((s) => s.trim()).filter(Boolean);
  const first = parts[0];

  // default import
  if (first && !first.startsWith("{")) {
    out.push(`const ${first} = ${moduleRef}.default;`);
  }

  // named import
  const namedMatch = bindings.match(/\{([^}]+)\}/);
  if (namedMatch) {
    const inside = namedMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const mm = s.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
        if (!mm) return null;
        return mm[2] ? `${mm[1]}: ${mm[2]}` : mm[1];
      })
      .filter(Boolean)
      .join(", ");

    if (inside) out.push(`const { ${inside} } = ${moduleRef};`);
  }

  return out.join("\n");
}

function transformImports(files: FileMap, fromPath: string, code: string) {
  // Handles single-line and multi-line imports (including side-effect imports).
  // We normalize whitespace before sending to transformImportLine.
  const IMPORT_STMT_REGEX = /(^|\n)\s*(import\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+['"][^'"]+['"]|['"][^'"]+['"])\s*;?)/g;

  return code.replace(IMPORT_STMT_REGEX, (_full, leadingNewline, importStmt) => {
    const normalized = String(importStmt)
      .replace(/\s+/g, " ")
      .replace(/;\s*$/, ";")
      .trim();

    const rewritten = transformImportLine(files, fromPath, normalized);
    return `${leadingNewline}${rewritten}`;
  });
}

function buildModuleMap(files: FileMap): ModuleMap {
  const moduleFiles = Object.keys(files)
    .filter((p) => p.startsWith("src/"))
    .filter((p) => /\.(ts|tsx|js|jsx)$/.test(p))
    .filter((p) => p !== "src/App.tsx" && p !== "src/App.jsx")
    .sort();

  const modules: ModuleMap = {};
  for (const path of moduleFiles) {
    const original = files[path] ?? "";
    const { defaultName, named } = extractExports(original);
    
    // IMPORTANT: Transform imports FIRST (converts @/ imports to __require calls)
    // THEN strip exports (but NOT imports - they've been transformed to const declarations)
    const withTransformedImports = transformImports(files, path, original);
    const body = stripExportsOnly(withTransformedImports);

    const exportLines: string[] = [];
    if (defaultName) exportLines.push(`default: (typeof ${defaultName} !== 'undefined' ? ${defaultName} : undefined)`);
    for (const n of named) exportLines.push(`${JSON.stringify(n)}: (typeof ${n} !== 'undefined' ? ${n} : undefined)`);

    modules[path] = `// ${path}\n(function(){\n${body}\nreturn { ${exportLines.join(", ")} };\n})()`;
  }

  return modules;
}

function buildAppSource(files: FileMap): { appPath: string; appSource: string } {
  const appPath = files["src/App.tsx"] ? "src/App.tsx" : files["src/App.jsx"] ? "src/App.jsx" : "";
  const original = appPath ? files[appPath] : "";

  if (!appPath || !original) {
    return {
      appPath: "",
      appSource: `function App(){\n  return (\n    <div className=\"min-h-screen flex items-center justify-center\">\n      <div className=\"text-center\">\n        <h1 className=\"text-3xl font-bold\">No src/App.tsx found</h1>\n        <p className=\"text-muted-foreground\">Generate files with /build</p>\n      </div>\n    </div>\n  );\n}`,
    };
  }

  // We keep the App file body mostly intact but:
  // - transform src/* imports into __require(...) bindings
  // - remove export keywords
  const withImports = transformImports(files, appPath, original);
  const withoutExports = withImports
    .replace(/export\s+default\s+/g, "")
    .replace(/^export\s+(?=(const|let|var|function|class)\b)/gm, "");

  return { appPath, appSource: `// ${appPath}\n${withoutExports}` };
}

function safeJsonStringify(value: unknown) {
  // Prevent accidental closing of script tags when embedding JSON into HTML.
  return JSON.stringify(value).replace(/<\//g, "<\\/");
}

export function generateBundledHTML(files: FileMap, baseUrl: string = ""): string {
  const cssContent = files["src/index.css"] || files["src/App.css"] || "";

  const moduleMap = buildModuleMap(files);
  const { appSource } = buildAppSource(files);

  const payload = {
    modules: moduleMap,
    app: appSource,
  };

  // A tiny runtime that is compiled by Babel at runtime.
  // NOTE: we do NOT inject user code directly into the script body.
  const runtimeTsx = `
    const __errEl = document.getElementById('__sandbox_error');
    const __copyBtn = document.getElementById('__sandbox_copy');
    const __reloadBtn = document.getElementById('__sandbox_reload');

    const __showErr = (title, err) => {
      try {
        const msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
        __errEl.style.display = 'block';
        __errEl.querySelector('[data-role="title"]').textContent = title || 'Sandbox error';
        __errEl.querySelector('[data-role="msg"]').textContent = msg;
        try { window.parent && window.parent.postMessage({ type: 'SANDBOX_ERROR', title: title || 'Sandbox error', message: msg }, '*'); } catch (_) {}
      } catch (_) {}
    };

    window.addEventListener('error', function(e) { __showErr('Sandbox runtime error', (e && (e.error || e.message))); });
    window.addEventListener('unhandledrejection', function(e) { __showErr('Sandbox unhandled promise rejection', e && e.reason); });

    __copyBtn.addEventListener('click', async () => {
      try {
        const t = __errEl.querySelector('[data-role="title"]').textContent || 'Sandbox error';
        const m = __errEl.querySelector('[data-role="msg"]').textContent || '';
        await navigator.clipboard.writeText([t, m].filter(Boolean).join('\\n\\n'));
      } catch (_) {}
    });

    __reloadBtn.addEventListener('click', () => location.reload());

    // Image inlining: fetch external images and convert to data URLs
    // with caching and size limits for performance
    (function(){
      const __imgCache = {};
      const __imgPending = {};
      const MAX_IMG_SIZE = 2 * 1024 * 1024; // 2MB limit per image
      const MAX_CACHE_SIZE = 20; // Max cached images
      const FETCH_TIMEOUT = 8000; // 8 second timeout

      const __imgPlaceholder = (fileName) => {
        const safe = encodeURIComponent(fileName || 'image');
        return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23374151' width='400' height='300' rx='8'/%3E%3Crect x='140' y='80' width='120' height='100' rx='8' fill='%234B5563' stroke='%236B7280' stroke-width='2'/%3E%3Ccircle cx='170' cy='115' r='12' fill='%239CA3AF'/%3E%3Cpath d='M150 165 L175 135 L200 155 L225 125 L250 165 Z' fill='%239CA3AF'/%3E%3Ctext x='200' y='220' text-anchor='middle' fill='%239CA3AF' font-family='system-ui, sans-serif' font-size='14'%3E" + safe + "%3C/text%3E%3C/svg%3E";
      };

      const __loadingPlaceholder = () => {
        return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%231f2937' width='400' height='300' rx='8'/%3E%3Ccircle cx='200' cy='130' r='30' fill='none' stroke='%236B7280' stroke-width='4' stroke-dasharray='60 30'%3E%3CanimateTransform attributeName='transform' type='rotate' from='0 200 130' to='360 200 130' dur='1s' repeatCount='indefinite'/%3E%3C/circle%3E%3Ctext x='200' y='190' text-anchor='middle' fill='%239CA3AF' font-family='system-ui, sans-serif' font-size='14'%3ELoading...%3C/text%3E%3C/svg%3E";
      };

      const __fetchImageAsDataUrl = async (url) => {
        // Check cache first
        if (__imgCache[url]) return __imgCache[url];
        
        // Check if already fetching
        if (__imgPending[url]) return __imgPending[url];

        // Start fetch with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

        __imgPending[url] = (async () => {
          try {
            const response = await fetch(url, { 
              signal: controller.signal,
              mode: 'cors',
              credentials: 'omit'
            });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error('HTTP ' + response.status);

            // Check content length if available
            const contentLength = response.headers.get('content-length');
            if (contentLength && parseInt(contentLength) > MAX_IMG_SIZE) {
              console.warn('Sandbox: Image too large, using placeholder:', url);
              return null;
            }

            const blob = await response.blob();
            
            // Check actual size
            if (blob.size > MAX_IMG_SIZE) {
              console.warn('Sandbox: Image too large, using placeholder:', url);
              return null;
            }

            // Convert to data URL
            return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const dataUrl = reader.result;
                
                // Manage cache size
                const cacheKeys = Object.keys(__imgCache);
                if (cacheKeys.length >= MAX_CACHE_SIZE) {
                  delete __imgCache[cacheKeys[0]];
                }
                
                __imgCache[url] = dataUrl;
                delete __imgPending[url];
                resolve(dataUrl);
              };
              reader.onerror = () => {
                delete __imgPending[url];
                resolve(null);
              };
              reader.readAsDataURL(blob);
            });
          } catch (err) {
            clearTimeout(timeoutId);
            delete __imgPending[url];
            if (err.name !== 'AbortError') {
              console.warn('Sandbox: Failed to fetch image:', url, err.message);
            }
            return null;
          }
        })();

        return __imgPending[url];
      };

      const __patchImg = async (img) => {
        if (!img || img.__sandboxPatched) return;
        img.__sandboxPatched = true;

        const src = img.getAttribute('src') || '';
        
        // Skip data URLs and empty sources
        if (!src || src.startsWith('data:')) return;
        
        // Check if it's an external URL (http/https)
        if (src.startsWith('http://') || src.startsWith('https://')) {
          // Show loading state
          const originalSrc = src;
          img.setAttribute('src', __loadingPlaceholder());
          
          try {
            const dataUrl = await __fetchImageAsDataUrl(originalSrc);
            if (dataUrl) {
              img.setAttribute('src', dataUrl);
            } else {
              const name = (originalSrc.split('/').pop() || 'image').split('?')[0];
              img.setAttribute('src', __imgPlaceholder(name));
            }
          } catch (_) {
            const name = (originalSrc.split('/').pop() || 'image').split('?')[0];
            img.setAttribute('src', __imgPlaceholder(name));
          }
        } else {
          // For relative URLs, add error handler for fallback
          img.addEventListener('error', () => {
            try {
              if (img.getAttribute('src')?.startsWith('data:')) return;
              const name = (src.split('/').pop() || 'image').split('?')[0];
              img.setAttribute('src', __imgPlaceholder(name));
            } catch (_) {}
          }, { once: true });
        }
      };

      // Also handle background-image CSS property
      const __patchBgImage = async (el) => {
        if (!el || el.__sandboxBgPatched) return;
        el.__sandboxBgPatched = true;

        const style = window.getComputedStyle(el);
        const bgImage = style.backgroundImage;
        
        if (!bgImage || bgImage === 'none') return;
        
        // Extract URL from background-image
        const urlMatch = bgImage.match(/url\\(['"]?(https?:\\/\\/[^'")]+)['"]?\\)/);
        if (!urlMatch) return;
        
        const originalUrl = urlMatch[1];
        
        try {
          const dataUrl = await __fetchImageAsDataUrl(originalUrl);
          if (dataUrl) {
            el.style.backgroundImage = 'url("' + dataUrl + '")';
          }
        } catch (_) {
          // Keep original if fetch fails
        }
      };

      const __scan = () => {
        try { 
          document.querySelectorAll('img').forEach(img => __patchImg(img)); 
          // Scan elements with potential background images
          document.querySelectorAll('[style*="background"], [class*="bg-"]').forEach(el => __patchBgImage(el));
        } catch (_) {}
      };

      // Deeper scan for background images after DOM settles
      const __deepScan = () => {
        try {
          const allElements = document.querySelectorAll('*');
          allElements.forEach(el => {
            const style = window.getComputedStyle(el);
            if (style.backgroundImage && style.backgroundImage !== 'none' && style.backgroundImage.includes('http')) {
              __patchBgImage(el);
            }
          });
        } catch (_) {}
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          __scan();
          setTimeout(__deepScan, 500);
        });
      } else {
        __scan();
        setTimeout(__deepScan, 500);
      }

      try {
        const mo = new MutationObserver(() => {
          __scan();
          setTimeout(__deepScan, 100);
        });
        mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
      } catch (_) {}
    })();

     // Tiny polyfills for common deps used in generated apps.
     // (The sandbox does not have node_modules.)
     
     // clsx function implementation
     const __clsxFn = function clsx() {
       const out = [];
       for (let i = 0; i < arguments.length; i++) {
         const v = arguments[i];
         if (!v) continue;
         if (typeof v === 'string') out.push(v);
         else if (Array.isArray(v)) out.push(__clsxFn.apply(null, v));
         else if (typeof v === 'object') {
           for (const k in v) {
             if (Object.prototype.hasOwnProperty.call(v, k) && v[k]) out.push(k);
           }
         }
       }
       return out.join(' ');
     };
     
     // twMerge function implementation - minimal fallback
     const __twMergeFn = function twMerge() {
       const parts = [];
       for (let i = 0; i < arguments.length; i++) {
         const v = arguments[i];
         if (typeof v === 'string' && v.trim()) parts.push(v.trim());
       }
       return parts.join(' ');
     };
     
     // twJoin function implementation
     const __twJoinFn = function twJoin() {
       return __twMergeFn.apply(null, arguments);
     };
     
     // cx function implementation
     const __cxFn = function cx() {
       return __clsxFn.apply(null, arguments);
     };
     
     // cva function implementation
     const __cvaFn = function cva(base, config) {
       const cfg = config || {};
       const variants = cfg.variants || {};
       const defaultVariants = cfg.defaultVariants || {};
       const compoundVariants = cfg.compoundVariants || [];

       return function (props) {
         const p = props || {};
         const classes = [];
         if (base) classes.push(base);

         // variants
         for (const key in variants) {
           const map = variants[key] || {};
           const value = p[key] !== undefined ? p[key] : defaultVariants[key];
           if (value === undefined) continue;
           const cls = map[value];
           if (cls) classes.push(cls);
         }

         // compoundVariants
         for (let i = 0; i < compoundVariants.length; i++) {
           const cv = compoundVariants[i];
           let match = true;
           for (const k in cv) {
             if (k === 'class' || k === 'className') continue;
             const desired = cv[k];
             const actual = p[k] !== undefined ? p[k] : defaultVariants[k];
             if (actual !== desired) { match = false; break; }
           }
           if (match) {
             if (cv.class) classes.push(cv.class);
             if (cv.className) classes.push(cv.className);
           }
         }

         if (p.class) classes.push(p.class);
         if (p.className) classes.push(p.className);

         return __twMergeFn(__clsxFn.apply(null, classes));
       };
     };
     
     // Expose as module-like objects for proper destructuring
     window.__clsxModule = __clsxFn;
     window.__clsxModule.clsx = __clsxFn;
     window.__clsxModule.default = __clsxFn;
     
     window.__twMergeModule = __twMergeFn;
     window.__twMergeModule.twMerge = __twMergeFn;
     window.__twMergeModule.twJoin = __twJoinFn;
     window.__twMergeModule.default = __twMergeFn;
     
     window.__cvaModule = __cvaFn;
     window.__cvaModule.cva = __cvaFn;
     window.__cvaModule.cx = __cxFn;
     window.__cvaModule.default = __cvaFn;
     
     // Also expose on window for direct access
     window.clsx = __clsxFn;
     window.twMerge = __twMergeFn;
     window.twJoin = __twJoinFn;
     window.cx = __cxFn;
      window.cva = __cvaFn;
     
     // cn utility function (combines clsx + twMerge)
     const __cnFn = function cn() {
       return __twMergeFn(__clsxFn.apply(null, arguments));
     };
     
     // Expose libUtils module
     window.__libUtilsModule = { cn: __cnFn };

     if (!window.lucideReact) {
        // Common Lucide icon paths - provides recognizable SVG shapes
        const iconPaths = {
          // Navigation & UI
          Menu: 'M4 6h16M4 12h16M4 18h16',
          X: 'M18 6L6 18M6 6l12 12',
          ChevronDown: 'M6 9l6 6 6-6',
          ChevronUp: 'M18 15l-6-6-6 6',
          ChevronLeft: 'M15 18l-6-6 6-6',
          ChevronRight: 'M9 18l6-6-6 6',
          ArrowLeft: 'M19 12H5M12 19l-7-7 7-7',
          ArrowRight: 'M5 12h14M12 5l7 7-7 7',
          ArrowUp: 'M12 19V5M5 12l7-7 7 7',
          ArrowDown: 'M12 5v14M19 12l-7 7-7-7',
          Check: 'M20 6L9 17l-5-5',
          Plus: 'M12 5v14M5 12h14',
          Minus: 'M5 12h14',
          Search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
          Settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z',
          // User & Profile
          User: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
          Users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
          UserPlus: 'M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M8.5 11a4 4 0 100-8 4 4 0 000 8zM20 8v6M23 11h-6',
          LogIn: 'M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3',
          LogOut: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
          // Commerce & Shopping
          ShoppingCart: 'M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6M9 22a1 1 0 100-2 1 1 0 000 2zM20 22a1 1 0 100-2 1 1 0 000 2z',
          ShoppingBag: 'M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0',
          CreditCard: 'M1 4h22a1 1 0 011 1v14a1 1 0 01-1 1H1a1 1 0 01-1-1V5a1 1 0 011-1zM1 10h22',
          DollarSign: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
          Package: 'M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12',
          // Food & Delivery
          UtensilsCrossed: 'M3 2l3 18M15 2l-3 18M3 2c3 6 0 12-3 18M15 2c-3 6 0 12 3 18M21 2v6a3 3 0 01-6 0V2M18 8v14',
          Pizza: 'M12 2a10 10 0 0110 10H12V2zM12 12a2 2 0 100-4 2 2 0 000 4zM17 17a2 2 0 100-4 2 2 0 000 4zM7 17a2 2 0 100-4 2 2 0 000 4z',
          Coffee: 'M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3',
          Truck: 'M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM18.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
          Bike: 'M5 19a4 4 0 100-8 4 4 0 000 8zM19 19a4 4 0 100-8 4 4 0 000 8zM12 19V5l7 7H5',
          // Location & Maps
          MapPin: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0zM12 13a3 3 0 100-6 3 3 0 000 6z',
          Navigation: 'M3 11l19-9-9 19-2-8-8-2z',
          Map: 'M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4zM8 2v16M16 6v16',
          Home: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9zM9 22V12h6v10',
          Building: 'M6 22V2h12v20M6 12h12M6 7h12M9 22v-4h6v4',
          // Communication
          Phone: 'M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z',
          Mail: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6',
          MessageCircle: 'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z',
          Bell: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0',
          // Time & Calendar
          Clock: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2',
          Calendar: 'M4 4h16a2 2 0 012 2v14a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM16 2v4M8 2v4M2 10h20',
          // Rating & Feedback
          Star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
          Heart: 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z',
          ThumbsUp: 'M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3',
          ThumbsDown: 'M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3zm7-13h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17',
          // Status & Info
          Info: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 16v-4M12 8h.01',
          AlertCircle: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 8v4M12 16h.01',
          AlertTriangle: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01',
          CheckCircle: 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3',
          XCircle: 'M12 22a10 10 0 100-20 10 10 0 000 20zM15 9l-6 6M9 9l6 6',
          HelpCircle: 'M12 22a10 10 0 100-20 10 10 0 000 20zM9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01',
          // Media & Files
          Image: 'M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM21 15l-5-5L5 21',
          Camera: 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z',
          Video: 'M23 7l-7 5 7 5V7zM14 5H3a2 2 0 00-2 2v10a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2z',
          File: 'M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9zM13 2v7h7',
          Folder: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z',
          Download: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
          Upload: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12',
          Trash: 'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2',
          Trash2: 'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6',
          Edit: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
          Edit2: 'M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z',
          Edit3: 'M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z',
          Copy: 'M20 8H10a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V10a2 2 0 00-2-2zM16 4H6a2 2 0 00-2 2v10',
          // Misc
          Eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 100-6 3 3 0 000 6z',
          EyeOff: 'M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22',
          Lock: 'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4',
          Unlock: 'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 019.9-1',
          Filter: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3z',
          MoreHorizontal: 'M12 13a1 1 0 100-2 1 1 0 000 2zM19 13a1 1 0 100-2 1 1 0 000 2zM5 13a1 1 0 100-2 1 1 0 000 2z',
          MoreVertical: 'M12 13a1 1 0 100-2 1 1 0 000 2zM12 6a1 1 0 100-2 1 1 0 000 2zM12 20a1 1 0 100-2 1 1 0 000 2z',
          Share: 'M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13',
          Share2: 'M18 8a3 3 0 100-6 3 3 0 000 6zM6 15a3 3 0 100-6 3 3 0 000 6zM18 22a3 3 0 100-6 3 3 0 000 6zM8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98',
          ExternalLink: 'M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3',
          RefreshCw: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
          RotateCw: 'M23 4v6h-6M21 12a9 9 0 11-2.64-6.36L23 10',
          Loader: 'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83',
          Loader2: 'M21 12a9 9 0 11-6.219-8.56',
          Sun: 'M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42',
          Moon: 'M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z',
          Zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
          Award: 'M12 15a7 7 0 100-14 7 7 0 000 14zM8.21 13.89L7 23l5-3 5 3-1.21-9.12',
          Gift: 'M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 110-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 100-5C13 2 12 7 12 7z',
          Tag: 'M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01',
          Bookmark: 'M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z',
          Flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7',
          Send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
          Wifi: 'M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01',
          WifiOff: 'M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.58 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01',
          Bluetooth: 'M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11',
          Battery: 'M17 7H4a2 2 0 00-2 2v6a2 2 0 002 2h13a2 2 0 002-2V9a2 2 0 00-2-2zM22 11v2',
          Power: 'M18.36 6.64a9 9 0 11-12.73 0M12 2v10',
          Globe: 'M12 22a10 10 0 100-20 10 10 0 000 20zM2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z',
          Link: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
          Link2: 'M15 7h3a5 5 0 015 5 5 5 0 01-5 5h-3m-6 0H6a5 5 0 01-5-5 5 5 0 015-5h3M8 12h8',
          Paperclip: 'M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48',
          Clipboard: 'M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2M9 2h6a1 1 0 011 1v2a1 1 0 01-1 1H9a1 1 0 01-1-1V3a1 1 0 011-1z',
          Terminal: 'M4 17l6-6-6-6M12 19h8',
          Code: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
          Database: 'M12 2a9 3 0 100 6 9 3 0 000-6zM3 5v14a9 3 0 0018 0V5M3 12a9 3 0 0018 0',
          Server: 'M2 4h20v6H2zM2 14h20v6H2zM6 8h.01M6 18h.01',
          Cloud: 'M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z',
          CloudOff: 'M22.61 16.95A5 5 0 0018 10h-1.26a8 8 0 00-7.05-6M5 5a8 8 0 004 15h9a5 5 0 001.7-.3M1 1l22 22',
          Layers: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
          Layout: 'M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zM3 9h18M9 21V9',
          Grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
          List: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
          Inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z',
          Archive: 'M21 8v13H3V8M1 3h22v5H1zM10 12h4',
          Printer: 'M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z',
          Save: 'M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zM17 21v-8H7v8M7 3v5h8',
          Repeat: 'M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3',
          Shuffle: 'M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5',
          Play: 'M5 3l14 9-14 9V3z',
          Pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
          SkipBack: 'M19 20L9 12l10-8v16zM5 19V5',
          SkipForward: 'M5 4l10 8-10 8V4zM19 5v14',
          Volume: 'M11 5L6 9H2v6h4l5 4V5z',
          Volume1: 'M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 010 7.07',
          Volume2: 'M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07',
          VolumeX: 'M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6',
          Mic: 'M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8',
          MicOff: 'M1 1l22 22M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23M12 19v4M8 23h8',
          Headphones: 'M3 18v-6a9 9 0 0118 0v6M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z',
          Radio: 'M12 14a2 2 0 100-4 2 2 0 000 4zM16.24 7.76a6 6 0 010 8.49m-8.48-.01a6 6 0 010-8.49m11.31-2.82a10 10 0 010 14.14m-14.14 0a10 10 0 010-14.14',
          Tv: 'M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM17 2l-5 5-5-5',
          Monitor: 'M20 3H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V5a2 2 0 00-2-2zM8 21h8M12 17v4',
          Smartphone: 'M17 2H7a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V4a2 2 0 00-2-2zM12 18h.01',
          Tablet: 'M18 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zM12 18h.01',
          Watch: 'M12 18a6 6 0 100-12 6 6 0 000 12zM12 9v3l1.5 1.5M16.51 17.35l-.35 3.83a2 2 0 01-2 1.82H9.83a2 2 0 01-2-1.82l-.35-3.83m.01-10.7l.35-3.83A2 2 0 019.83 1h4.35a2 2 0 012 1.82l.35 3.83',
          Compass: 'M12 22a10 10 0 100-20 10 10 0 000 20zM16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z',
          Crosshair: 'M12 22a10 10 0 100-20 10 10 0 000 20zM22 12h-4M6 12H2M12 6V2M12 22v-4',
          Target: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z',
          Activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
          TrendingUp: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
          TrendingDown: 'M23 18l-9.5-9.5-5 5L1 6M17 18h6v-6',
          BarChart: 'M12 20V10M18 20V4M6 20v-4',
          BarChart2: 'M18 20V10M12 20V4M6 20v-6',
          PieChart: 'M21.21 15.89A10 10 0 118 2.83M22 12A10 10 0 0012 2v10z',
          Percent: 'M19 5L5 19M6.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM17.5 20a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
          Hash: 'M4 9h16M4 15h16M10 3L8 21M16 3l-2 18',
          AtSign: 'M12 16a4 4 0 100-8 4 4 0 000 8zM16 8v5a3 3 0 006 0v-1a10 10 0 10-3.92 7.94',
          Bold: 'M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6zM6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z',
          Italic: 'M19 4h-9M14 20H5M15 4L9 20',
          Underline: 'M6 3v7a6 6 0 006 6 6 6 0 006-6V3M4 21h16',
          AlignLeft: 'M17 10H3M21 6H3M21 14H3M17 18H3',
          AlignCenter: 'M18 10H6M21 6H3M21 14H3M18 18H6',
          AlignRight: 'M21 10H7M21 6H3M21 14H3M21 18H7',
          AlignJustify: 'M21 10H3M21 6H3M21 14H3M21 18H3',
          Type: 'M4 7V4h16v3M9 20h6M12 4v16',
          Maximize: 'M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3',
          Maximize2: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
          Minimize: 'M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3',
          Minimize2: 'M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7',
          Move: 'M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20',
          Square: 'M3 3h18v18H3z',
          Circle: 'M12 22a10 10 0 100-20 10 10 0 000 20z',
          Triangle: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
          Octagon: 'M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86L7.86 2z',
          Hexagon: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z',
          Pentagon: 'M12 2l9.09 6.61L18.18 20H5.82L2.91 8.61 12 2z',
          Feather: 'M20.24 12.24a6 6 0 00-8.49-8.49L5 10.5V19h8.5zM16 8L2 22M17.5 15H9',
          Anchor: 'M12 8a3 3 0 100-6 3 3 0 000 6zM12 22V8M5 12H2a10 10 0 0020 0h-3',
          Umbrella: 'M23 12a11.05 11.05 0 00-22 0zM12 12v9a3 3 0 006 0',
          Droplet: 'M12 2.69l5.66 5.66a8 8 0 11-11.31 0z',
          CloudRain: 'M16 13v8M8 13v8M12 15v8M20 16.58A5 5 0 0018 7h-1.26A8 8 0 104 15.25',
          CloudSnow: 'M20 17.58A5 5 0 0018 8h-1.26A8 8 0 104 16.25M8 16h.01M8 20h.01M12 18h.01M12 22h.01M16 16h.01M16 20h.01',
          Wind: 'M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2',
          Thermometer: 'M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z',
          Sunrise: 'M17 18a5 5 0 00-10 0M12 2v7M4.22 10.22l1.42 1.42M1 18h2M21 18h2M18.36 11.64l1.42-1.42M23 22H1M8 6l4-4 4 4',
          Sunset: 'M17 18a5 5 0 00-10 0M12 9V2M4.22 10.22l1.42 1.42M1 18h2M21 18h2M18.36 11.64l1.42-1.42M23 22H1M16 5l-4 4-4-4',
          Aperture: 'M12 22a10 10 0 100-20 10 10 0 000 20zM14.31 8l5.74 9.94M9.69 8h11.48M7.38 12l5.74-9.94M9.69 16L3.95 6.06M14.31 16H2.83M16.62 12l-5.74 9.94',
          Cpu: 'M18 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2zM9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3',
          HardDrive: 'M22 12H2M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11zM6 16h.01M10 16h.01',
          Disc: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 15a3 3 0 100-6 3 3 0 000 6z',
          Film: 'M19.82 2H4.18A2.18 2.18 0 002 4.18v15.64A2.18 2.18 0 004.18 22h15.64A2.18 2.18 0 0022 19.82V4.18A2.18 2.18 0 0019.82 2zM7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5',
          Briefcase: 'M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16',
          Book: 'M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z',
          BookOpen: 'M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z',
          Bookmark: 'M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z',
          Box: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12',
          Scissors: 'M6 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12',
          Key: 'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4',
          Unlock: 'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 019.9-1',
          Shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
          ShieldOff: 'M19.69 14a6.9 6.9 0 00.31-2V5l-8-3-3.16 1.18M4.73 4.73L4 5v7c0 6 8 10 8 10a20.29 20.29 0 005.62-4.38M1 1l22 22',
          ShieldCheck: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
        };
        
        // Default path for unknown icons - a simple square with diagonal
        const defaultPath = 'M4 4h16v16H4zM4 4l16 16';
        
        const makeIcon = (name) => {
          return React.forwardRef(function LucideIcon(props, ref) {
            const p = props || {};
            const size = p.size || 24;
            const strokeWidth = p.strokeWidth || p['stroke-width'] || 2;
            const color = p.color || 'currentColor';
            const absoluteStrokeWidth = p.absoluteStrokeWidth;
            const finalStrokeWidth = absoluteStrokeWidth ? (strokeWidth * 24) / size : strokeWidth;
            
            // Remove non-SVG props
            const { size: _, color: __, strokeWidth: ___, absoluteStrokeWidth: ____, className, ...svgProps } = p;
            
            const pathD = iconPaths[name] || defaultPath;
            
            return React.createElement('svg', {
              ref,
              xmlns: 'http://www.w3.org/2000/svg',
              width: size,
              height: size,
              viewBox: '0 0 24 24',
              fill: 'none',
              stroke: color,
              strokeWidth: finalStrokeWidth,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              className: className ? ('lucide lucide-' + name.toLowerCase() + ' ' + className) : ('lucide lucide-' + name.toLowerCase()),
              'aria-hidden': 'true',
              ...svgProps,
            },
              // Split multiple paths and render each
              ...pathD.split('M').filter(Boolean).map((d, i) => 
                React.createElement('path', { key: i, d: 'M' + d })
              )
            );
          });
        };

        const iconProxy = new Proxy({}, {
          get(_t, key) {
            if (typeof key !== 'string') return undefined;
            return makeIcon(key);
          }
        });

        window.lucideReact = new Proxy({
          icons: iconProxy,
          Icon: makeIcon('Icon'),
          createLucideIcon: (name) => makeIcon(name),
          dynamicIconImports: new Proxy({}, {
            get(_, key) {
              if (typeof key !== 'string') return undefined;
              return () => Promise.resolve({ default: makeIcon(key) });
            }
          }),
        }, {
          get(target, key) {
            if (key in target) return target[key];
            if (typeof key === 'string') return makeIcon(key);
            return undefined;
          }
        });
      }

      // Generic icon library proxy factory
      const createIconProxy = () => new Proxy({}, {
        get(_, key) {
          if (typeof key !== 'string') return undefined;
          return React.forwardRef(function IconStub(props, ref) {
            const p = props || {};
            const size = p.size || 24;
            const color = p.color || 'currentColor';
            return React.createElement('svg', { 
              ref,
              xmlns: 'http://www.w3.org/2000/svg',
              width: size, 
              height: size, 
              viewBox: '0 0 24 24', 
              fill: 'none', 
              stroke: color, 
              strokeWidth: 2, 
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              'aria-hidden': 'true',
              ...p 
            },
              React.createElement('rect', { x: 4, y: 4, width: 16, height: 16, rx: 2 }),
              React.createElement('path', { d: 'M4 4l16 16' })
            );
          });
        }
      });

      // Icon libraries
      if (!window.heroIcons) window.heroIcons = { solid: createIconProxy(), outline: createIconProxy(), mini: createIconProxy() };
      if (!window.tablerIcons) window.tablerIcons = createIconProxy();
      if (!window.phosphorIcons) window.phosphorIcons = createIconProxy();
      if (!window.iconoirIcons) window.iconoirIcons = createIconProxy();
      if (!window.featherIcons) window.featherIcons = createIconProxy();
      if (!window.reactIcons) window.reactIcons = createIconProxy();

      // Radix UI stubs (minimal functional stubs)
      if (!window.radixUI) {
        const createRadixStub = (displayName) => {
          const Comp = React.forwardRef((props, ref) => {
            const { children, asChild, ...rest } = props || {};
            if (asChild && React.Children.count(children) === 1) {
              return React.cloneElement(React.Children.only(children), { ref, ...rest });
            }
            return React.createElement('div', { ref, ...rest }, children);
          });
          Comp.displayName = displayName;
          return Comp;
        };
        
        const createRadixNS = (names) => {
          const ns = {};
          names.forEach(n => { ns[n] = createRadixStub(n); });
          return ns;
        };

        window.radixUI = {
          Accordion: createRadixNS(['Root', 'Item', 'Header', 'Trigger', 'Content']),
          AlertDialog: createRadixNS(['Root', 'Trigger', 'Portal', 'Overlay', 'Content', 'Title', 'Description', 'Cancel', 'Action']),
          AspectRatio: createRadixNS(['Root']),
          Avatar: createRadixNS(['Root', 'Image', 'Fallback']),
          Checkbox: createRadixNS(['Root', 'Indicator']),
          Collapsible: createRadixNS(['Root', 'Trigger', 'Content']),
          ContextMenu: createRadixNS(['Root', 'Trigger', 'Portal', 'Content', 'Item', 'CheckboxItem', 'RadioGroup', 'RadioItem', 'Sub', 'SubTrigger', 'SubContent', 'Separator', 'Label']),
          Dialog: createRadixNS(['Root', 'Trigger', 'Portal', 'Overlay', 'Content', 'Title', 'Description', 'Close']),
          DropdownMenu: createRadixNS(['Root', 'Trigger', 'Portal', 'Content', 'Item', 'CheckboxItem', 'RadioGroup', 'RadioItem', 'Sub', 'SubTrigger', 'SubContent', 'Separator', 'Label']),
          HoverCard: createRadixNS(['Root', 'Trigger', 'Portal', 'Content']),
          Label: createRadixNS(['Root']),
          Menubar: createRadixNS(['Root', 'Menu', 'Trigger', 'Portal', 'Content', 'Item', 'CheckboxItem', 'RadioGroup', 'RadioItem', 'Sub', 'SubTrigger', 'SubContent', 'Separator', 'Label']),
          NavigationMenu: createRadixNS(['Root', 'List', 'Item', 'Trigger', 'Content', 'Link', 'Viewport', 'Indicator']),
          Popover: createRadixNS(['Root', 'Trigger', 'Anchor', 'Portal', 'Content', 'Close', 'Arrow']),
          Progress: createRadixNS(['Root', 'Indicator']),
          RadioGroup: createRadixNS(['Root', 'Item', 'Indicator']),
          ScrollArea: createRadixNS(['Root', 'Viewport', 'Scrollbar', 'Thumb', 'Corner']),
          Select: createRadixNS(['Root', 'Trigger', 'Value', 'Icon', 'Portal', 'Content', 'Viewport', 'Group', 'Label', 'Item', 'ItemText', 'ItemIndicator', 'ScrollUpButton', 'ScrollDownButton', 'Separator']),
          Separator: createRadixNS(['Root']),
          Slider: createRadixNS(['Root', 'Track', 'Range', 'Thumb']),
          Slot: { Slot: createRadixStub('Slot'), Slottable: createRadixStub('Slottable') },
          Switch: createRadixNS(['Root', 'Thumb']),
          Tabs: createRadixNS(['Root', 'List', 'Trigger', 'Content']),
          Toast: createRadixNS(['Provider', 'Root', 'Title', 'Description', 'Action', 'Close', 'Viewport']),
          Toggle: createRadixNS(['Root']),
          ToggleGroup: createRadixNS(['Root', 'Item']),
          Tooltip: createRadixNS(['Provider', 'Root', 'Trigger', 'Portal', 'Content', 'Arrow']),
          Primitive: { Primitive: createRadixStub('Primitive') },
          Presence: { Presence: createRadixStub('Presence') },
          Portal: { Portal: createRadixStub('Portal') },
          FocusScope: { FocusScope: createRadixStub('FocusScope') },
          DismissableLayer: { DismissableLayer: createRadixStub('DismissableLayer') },
          Id: { useId: () => React.useId ? React.useId() : 'id-' + Math.random().toString(36).slice(2) },
          ComposeRefs: { composeRefs: (...refs) => (node) => refs.forEach(r => { if (typeof r === 'function') r(node); else if (r) r.current = node; }), useComposedRefs: (...refs) => React.useCallback((node) => refs.forEach(r => { if (typeof r === 'function') r(node); else if (r) r.current = node; }), refs) },
          Context: { createContext: React.createContext, createContextScope: () => [() => React.createContext(null), () => {}] },
          UseControllableState: { useControllableState: ({ prop, defaultProp, onChange }) => { const [state, setState] = React.useState(defaultProp); return [prop !== undefined ? prop : state, (v) => { setState(v); onChange?.(v); }]; } },
          UseCallbackRef: { useCallbackRef: (cb) => { const ref = React.useRef(cb); ref.current = cb; return React.useCallback((...args) => ref.current?.(...args), []); } },
          UseEscapeKeydown: { useEscapeKeydown: () => {} },
          UseLayoutEffect: { useLayoutEffect: React.useLayoutEffect },
          UsePrevious: { usePrevious: (v) => { const ref = React.useRef(); React.useEffect(() => { ref.current = v; }); return ref.current; } },
          UseSize: { useSize: () => null },
          VisuallyHidden: createRadixNS(['Root']),
          Arrow: createRadixNS(['Root']),
          Collection: { createCollection: () => ({ Provider: ({children}) => children, Slot: createRadixStub('Slot'), ItemSlot: createRadixStub('ItemSlot') }) },
          Direction: { DirectionProvider: ({children}) => children, useDirection: () => 'ltr' },
          FocusGuards: { FocusGuards: ({children}) => children },
          RovingFocus: createRadixNS(['Root', 'Item']),
          Menu: createRadixNS(['Root', 'Anchor', 'Portal', 'Content', 'Group', 'Label', 'Item', 'CheckboxItem', 'RadioGroup', 'RadioItem', 'ItemIndicator', 'Separator', 'Sub', 'SubTrigger', 'SubContent']),
        };
      }

      // Framer Motion stub
      if (!window.framerMotion) {
        const motionProxy = new Proxy({}, {
          get(_, tag) {
            return React.forwardRef((props, ref) => {
              const { initial, animate, exit, transition, variants, whileHover, whileTap, whileFocus, whileDrag, whileInView, layout, layoutId, ...rest } = props || {};
              return React.createElement(tag, { ref, ...rest });
            });
          }
        });
        window.framerMotion = {
          motion: motionProxy,
          AnimatePresence: ({ children }) => children,
          useAnimation: () => ({ start: () => Promise.resolve(), stop: () => {}, set: () => {} }),
          useMotionValue: (v) => ({ get: () => v, set: () => {}, on: () => () => {} }),
          useTransform: (v) => v,
          useSpring: (v) => v,
          useScroll: () => ({ scrollX: { get: () => 0 }, scrollY: { get: () => 0 }, scrollXProgress: { get: () => 0 }, scrollYProgress: { get: () => 0 } }),
          useInView: () => true,
          useReducedMotion: () => false,
          LayoutGroup: ({ children }) => children,
          Reorder: { Group: ({ children }) => children, Item: ({ children }) => children },
        };
      }

      // React Router DOM stub
      if (!window.ReactRouterDOM) {
        const noop = () => {};
        const noopNav = () => noop;
        window.ReactRouterDOM = {
          BrowserRouter: ({ children }) => children,
          HashRouter: ({ children }) => children,
          MemoryRouter: ({ children }) => children,
          Link: React.forwardRef(({ to, children, ...props }, ref) => React.createElement('a', { ref, href: typeof to === 'string' ? to : to?.pathname || '#', ...props }, children)),
          NavLink: React.forwardRef(({ to, children, ...props }, ref) => React.createElement('a', { ref, href: typeof to === 'string' ? to : to?.pathname || '#', ...props }, children)),
          Navigate: () => null,
          Outlet: () => null,
          Route: () => null,
          Routes: ({ children }) => children,
          useLocation: () => ({ pathname: '/', search: '', hash: '', state: null, key: 'default' }),
          useNavigate: () => noopNav,
          useParams: () => ({}),
          useSearchParams: () => [new URLSearchParams(), noop],
          useMatch: () => null,
          useRoutes: () => null,
          createBrowserRouter: () => ({}),
          createHashRouter: () => ({}),
          createMemoryRouter: () => ({}),
          RouterProvider: ({ children }) => children,
          createRoutesFromElements: () => [],
          ScrollRestoration: () => null,
          redirect: (url) => new Response(null, { status: 302, headers: { Location: url } }),
          json: (data) => new Response(JSON.stringify(data)),
          defer: (data) => data,
          generatePath: (path) => path,
          matchPath: () => null,
          matchRoutes: () => null,
          resolvePath: (to) => ({ pathname: to, search: '', hash: '' }),
          renderMatches: () => null,
          createSearchParams: (init) => new URLSearchParams(init),
        };
      }

      // Date-fns stub (common functions)
      if (!window.dateFns) {
        window.dateFns = {
          format: (d, f) => d?.toISOString?.() || String(d),
          parse: (s) => new Date(s),
          parseISO: (s) => new Date(s),
          formatDistance: () => '',
          formatRelative: () => '',
          addDays: (d, n) => new Date(d.getTime() + n * 86400000),
          addMonths: (d, n) => { const r = new Date(d); r.setMonth(r.getMonth() + n); return r; },
          addYears: (d, n) => { const r = new Date(d); r.setFullYear(r.getFullYear() + n); return r; },
          subDays: (d, n) => new Date(d.getTime() - n * 86400000),
          subMonths: (d, n) => { const r = new Date(d); r.setMonth(r.getMonth() - n); return r; },
          subYears: (d, n) => { const r = new Date(d); r.setFullYear(r.getFullYear() - n); return r; },
          startOfWeek: (d) => d,
          startOfMonth: (d) => new Date(d.getFullYear(), d.getMonth(), 1),
          startOfYear: (d) => new Date(d.getFullYear(), 0, 1),
          endOfWeek: (d) => d,
          endOfMonth: (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0),
          endOfYear: (d) => new Date(d.getFullYear(), 11, 31),
          isAfter: (a, b) => a > b,
          isBefore: (a, b) => a < b,
          isEqual: (a, b) => a?.getTime?.() === b?.getTime?.(),
          differenceInDays: (a, b) => Math.floor((a - b) / 86400000),
          isValid: (d) => d instanceof Date && !isNaN(d),
          isSameDay: (a, b) => a?.toDateString?.() === b?.toDateString?.(),
        };
      }

      // Sonner toast stub
      if (!window.sonner) {
        window.sonner = {
          Toaster: () => null,
          toast: Object.assign((msg) => console.log('[toast]', msg), {
            success: (msg) => console.log('[toast success]', msg),
            error: (msg) => console.log('[toast error]', msg),
            warning: (msg) => console.log('[toast warning]', msg),
            info: (msg) => console.log('[toast info]', msg),
            loading: (msg) => console.log('[toast loading]', msg),
            promise: (p) => p,
            dismiss: () => {},
            custom: () => {},
          }),
        };
      }

      // React Query stub
      if (!window.reactQuery) {
        const QueryClient = function() { this.cache = {}; };
        QueryClient.prototype.getQueryData = function() { return undefined; };
        QueryClient.prototype.setQueryData = function() {};
        QueryClient.prototype.invalidateQueries = function() { return Promise.resolve(); };
        
        window.reactQuery = {
          QueryClient,
          QueryClientProvider: ({ children }) => children,
          useQuery: () => ({ data: undefined, isLoading: false, isError: false, error: null, refetch: () => Promise.resolve() }),
          useMutation: () => ({ mutate: () => {}, mutateAsync: () => Promise.resolve(), isLoading: false, isError: false }),
          useQueryClient: () => new QueryClient(),
          useInfiniteQuery: () => ({ data: undefined, isLoading: false, fetchNextPage: () => {} }),
          useQueries: () => [],
          useSuspenseQuery: () => ({ data: undefined }),
        };
      }

      // Zod stub
      if (!window.zod) {
        const createSchema = () => {
          const schema = {
            parse: (v) => v,
            safeParse: (v) => ({ success: true, data: v }),
            optional: () => schema,
            nullable: () => schema,
            default: () => schema,
            refine: () => schema,
            transform: () => schema,
            pipe: () => schema,
            and: () => schema,
            or: () => schema,
            array: () => schema,
            min: () => schema,
            max: () => schema,
            length: () => schema,
            email: () => schema,
            url: () => schema,
            uuid: () => schema,
            regex: () => schema,
            trim: () => schema,
            toLowerCase: () => schema,
            toUpperCase: () => schema,
            positive: () => schema,
            negative: () => schema,
            int: () => schema,
            nonnegative: () => schema,
            nonpositive: () => schema,
            finite: () => schema,
            shape: {},
            _def: { typeName: 'ZodString' },
          };
          return schema;
        };
        
        window.zod = {
          z: {
            string: createSchema,
            number: createSchema,
            boolean: createSchema,
            date: createSchema,
            bigint: createSchema,
            symbol: createSchema,
            undefined: createSchema,
            null: createSchema,
            void: createSchema,
            any: createSchema,
            unknown: createSchema,
            never: createSchema,
            literal: createSchema,
            enum: createSchema,
            nativeEnum: createSchema,
            object: (shape) => ({ ...createSchema(), shape, partial: () => createSchema(), pick: () => createSchema(), omit: () => createSchema(), extend: () => createSchema(), merge: () => createSchema(), passthrough: () => createSchema(), strict: () => createSchema(), strip: () => createSchema(), catchall: () => createSchema() }),
            array: createSchema,
            tuple: createSchema,
            union: createSchema,
            discriminatedUnion: createSchema,
            intersection: createSchema,
            record: createSchema,
            map: createSchema,
            set: createSchema,
            function: createSchema,
            lazy: createSchema,
            promise: createSchema,
            instanceof: createSchema,
            preprocess: createSchema,
            custom: createSchema,
            coerce: { string: createSchema, number: createSchema, boolean: createSchema, bigint: createSchema, date: createSchema },
            infer: () => {},
          },
          ZodError: class ZodError extends Error {},
          ZodSchema: class ZodSchema {},
        };
        window.zod.z.ZodError = window.zod.ZodError;
      }

      // React Hook Form stub
      if (!window.reactHookForm) {
        window.reactHookForm = {
          useForm: () => ({
            register: (name) => ({ name, onChange: () => {}, onBlur: () => {}, ref: () => {} }),
            handleSubmit: (fn) => (e) => { e?.preventDefault?.(); fn({}); },
            watch: () => undefined,
            setValue: () => {},
            getValues: () => ({}),
            reset: () => {},
            formState: { errors: {}, isSubmitting: false, isValid: true, isDirty: false },
            control: {},
            trigger: () => Promise.resolve(true),
            setError: () => {},
            clearErrors: () => {},
            setFocus: () => {},
          }),
          useController: () => ({ field: { value: '', onChange: () => {}, onBlur: () => {}, ref: () => {} }, fieldState: { error: null } }),
          useFieldArray: () => ({ fields: [], append: () => {}, remove: () => {}, insert: () => {}, update: () => {}, move: () => {}, swap: () => {}, replace: () => {} }),
          useFormContext: () => window.reactHookForm.useForm(),
          useFormState: () => ({ errors: {}, isSubmitting: false }),
          useWatch: () => undefined,
          FormProvider: ({ children }) => children,
          Controller: ({ render, control, name }) => render?.({ field: { value: '', onChange: () => {}, onBlur: () => {}, ref: () => {} }, fieldState: { error: null } }) || null,
        };
      }

      // Hookform resolvers stub
      if (!window.hookformResolvers) {
        const createResolver = () => async (values) => ({ values, errors: {} });
        window.hookformResolvers = {
          zodResolver: () => createResolver(),
          yupResolver: () => createResolver(),
          joiResolver: () => createResolver(),
          zod: { zodResolver: () => createResolver() },
        };
      }

      // Next-themes stub
      if (!window.nextThemes) {
        window.nextThemes = {
          ThemeProvider: ({ children }) => children,
          useTheme: () => ({ theme: 'light', setTheme: () => {}, resolvedTheme: 'light', themes: ['light', 'dark'], systemTheme: 'light' }),
        };
      }

      // Vaul (drawer) stub
      if (!window.vaul) {
        const DrawerComp = ({ children }) => children;
        DrawerComp.Root = ({ children }) => children;
        DrawerComp.Trigger = React.forwardRef((props, ref) => React.createElement('button', { ref, ...props }));
        DrawerComp.Portal = ({ children }) => children;
        DrawerComp.Overlay = React.forwardRef((props, ref) => React.createElement('div', { ref, ...props }));
        DrawerComp.Content = React.forwardRef((props, ref) => React.createElement('div', { ref, ...props }));
        DrawerComp.Title = React.forwardRef((props, ref) => React.createElement('h2', { ref, ...props }));
        DrawerComp.Description = React.forwardRef((props, ref) => React.createElement('p', { ref, ...props }));
        DrawerComp.Handle = React.forwardRef((props, ref) => React.createElement('div', { ref, ...props }));
        DrawerComp.Close = React.forwardRef((props, ref) => React.createElement('button', { ref, ...props }));
        window.vaul = { Drawer: DrawerComp };
      }

      // CMDK stub
      if (!window.cmdk) {
        const Cmd = React.forwardRef(({ children, ...props }, ref) => React.createElement('div', { ref, role: 'combobox', ...props }, children));
        Cmd.Input = React.forwardRef((props, ref) => React.createElement('input', { ref, ...props }));
        Cmd.List = React.forwardRef((props, ref) => React.createElement('div', { ref, role: 'listbox', ...props }));
        Cmd.Empty = React.forwardRef((props, ref) => React.createElement('div', { ref, ...props }));
        Cmd.Group = React.forwardRef((props, ref) => React.createElement('div', { ref, role: 'group', ...props }));
        Cmd.Item = React.forwardRef((props, ref) => React.createElement('div', { ref, role: 'option', ...props }));
        Cmd.Separator = React.forwardRef((props, ref) => React.createElement('hr', { ref, ...props }));
        Cmd.Loading = React.forwardRef((props, ref) => React.createElement('div', { ref, ...props }));
        Cmd.Dialog = React.forwardRef((props, ref) => React.createElement('div', { ref, role: 'dialog', ...props }));
        window.cmdk = { Command: Cmd };
      }

      // Input OTP stub
      if (!window.inputOtp) {
        window.inputOtp = {
          OTPInput: React.forwardRef(({ children, ...props }, ref) => React.createElement('div', { ref, ...props }, children)),
          OTPInputContext: React.createContext({}),
          REGEXP_ONLY_CHARS: /^[a-zA-Z]+$/,
          REGEXP_ONLY_DIGITS: /^[0-9]+$/,
          REGEXP_ONLY_DIGITS_AND_CHARS: /^[a-zA-Z0-9]+$/,
        };
      }

      // Resizable panels stub
      if (!window.resizablePanels) {
        window.resizablePanels = {
          Panel: React.forwardRef(({ children, ...props }, ref) => React.createElement('div', { ref, style: { flex: 1 }, ...props }, children)),
          PanelGroup: React.forwardRef(({ children, direction, ...props }, ref) => React.createElement('div', { ref, style: { display: 'flex', flexDirection: direction === 'vertical' ? 'column' : 'row', width: '100%', height: '100%' }, ...props }, children)),
          PanelResizeHandle: React.forwardRef((props, ref) => React.createElement('div', { ref, style: { width: 4, cursor: 'col-resize', background: '#e5e5e5' }, ...props })),
        };
      }

      // Recharts stub
      if (!window.Recharts) {
        const ChartComp = ({ children, ...props }) => React.createElement('div', { style: { width: props.width || '100%', height: props.height || 300 }, ...props }, children);
        const AxisComp = () => null;
        const DataComp = ({ children }) => children || null;
        window.Recharts = {
          ResponsiveContainer: ({ children }) => React.createElement('div', { style: { width: '100%', height: '100%' } }, children),
          LineChart: ChartComp, Line: DataComp, BarChart: ChartComp, Bar: DataComp, PieChart: ChartComp, Pie: DataComp,
          AreaChart: ChartComp, Area: DataComp, ComposedChart: ChartComp, ScatterChart: ChartComp, Scatter: DataComp,
          RadarChart: ChartComp, Radar: DataComp, RadialBarChart: ChartComp, RadialBar: DataComp, Treemap: ChartComp,
          Funnel: DataComp, FunnelChart: ChartComp, Sankey: ChartComp,
          XAxis: AxisComp, YAxis: AxisComp, ZAxis: AxisComp, CartesianGrid: () => null, Tooltip: () => null, Legend: () => null,
          Cell: DataComp, Label: () => null, LabelList: () => null, Brush: () => null,
          ReferenceLine: () => null, ReferenceDot: () => null, ReferenceArea: () => null, ErrorBar: () => null,
          PolarGrid: () => null, PolarAngleAxis: () => null, PolarRadiusAxis: () => null,
        };
      }

      // Embla Carousel stub
      if (!window.emblaCarousel) {
        window.emblaCarousel = {
          default: () => [null, { scrollPrev: () => {}, scrollNext: () => {}, canScrollPrev: () => false, canScrollNext: () => false, selectedScrollSnap: () => 0, scrollSnapList: () => [], on: () => () => {} }],
          useEmblaCarousel: () => [null, { scrollPrev: () => {}, scrollNext: () => {}, canScrollPrev: () => false, canScrollNext: () => false, selectedScrollSnap: () => 0, scrollSnapList: () => [], on: () => () => {} }],
        };
      }

      // React Day Picker stub
      if (!window.reactDayPicker) {
        window.reactDayPicker = {
          DayPicker: (props) => React.createElement('div', { className: 'rdp' }, 'Calendar'),
          useDayPicker: () => ({}),
          useNavigation: () => ({ goToMonth: () => {}, nextMonth: null, previousMonth: null }),
          useDayRender: () => ({ buttonProps: {}, divProps: {}, isButton: true, isHidden: false }),
        };
      }

     const payload = JSON.parse(document.getElementById('__sandbox_payload').textContent || '{}');

     // Provide common React hooks as globals so generated code that forgets
     // to import them (e.g. useState) still runs in the sandbox.
     try {
       const hookNames = [
         'useState',
         'useEffect',
         'useMemo',
         'useCallback',
         'useRef',
         'useReducer',
         'useContext',
         'useLayoutEffect',
         'useId',
       ];
       hookNames.forEach((name) => {
         if (window.React && window.React[name] && !window[name]) {
           window[name] = window.React[name];
         }
       });
     } catch (_) {}

    const __compile = (code, filename) => {
      try {
        // Force .tsx extension for Babel so JSX is always enabled (users may put JSX in .ts files)
        const babelFilename = (filename || 'unknown').replace(/\\.ts$/, '.tsx').replace(/\\.js$/, '.jsx');
        return Babel.transform(code, {
          filename: babelFilename.endsWith('.tsx') || babelFilename.endsWith('.jsx') ? babelFilename : babelFilename + '.tsx',
          presets: ['typescript', 'react'],
        }).code;
      } catch (e) {
        throw new Error('Babel compile failed for ' + (filename || 'unknown') + '\\n' + String((e && (e.stack || e.message)) || e));
      }
    };

    const __cache = {};
    const __require = (path) => {
      if (__cache[path]) return __cache[path];
      const factorySrc = payload.modules && payload.modules[path];
      if (!factorySrc) throw new Error('Module not found: ' + path);
      const compiled = __compile(factorySrc, path);
      const exportsObj = (0, eval)(compiled);
      __cache[path] = exportsObj;
      return exportsObj;
    };

    // Expose require globally for transformed imports.
    window.__require = __require;

    try {
      // Evaluate App source (after import transforms). It should define App.
      const compiledApp = __compile(payload.app || '', 'src/App.tsx');
      (0, eval)(compiledApp);

      const AppComponent = typeof App !== 'undefined' ? App : function(){ return React.createElement('div', null, 'No App component found'); };
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(React.StrictMode, null, React.createElement(AppComponent, null)));
    } catch (e) {
      __showErr('Sandbox render failed', e);
    }
  `;

  // We transform the runtime with Babel in the iframe (so TSX works),
  // but we keep the user payload as JSON.
  const runnerJs = `
    (function(){
      const payloadScript = document.getElementById('__sandbox_payload');
      if (!payloadScript) return;

      const source = document.getElementById('__sandbox_runtime').textContent || '';
      try {
        const out = Babel.transform(source, { filename: 'runtime.tsx', presets: ['typescript', 'react'] }).code;
        (0, eval)(out);
      } catch (e) {
        // If even the runtime fails, show a minimal error.
        const el = document.getElementById('__sandbox_error');
        if (el) {
          el.style.display = 'block';
          const msg = (e && (e.stack || e.message)) ? (e.stack || e.message) : String(e);
          el.querySelector('[data-role="title"]').textContent = 'Sandbox bootstrap failed';
          el.querySelector('[data-role="msg"]').textContent = msg;
        }
        try { window.parent && window.parent.postMessage({ type: 'SANDBOX_ERROR', title: 'Sandbox bootstrap failed', message: String(e && (e.stack || e.message) || e) }, '*'); } catch (_) {}
      }
    })();
  `;

  // Improved CSS extraction - include all animations from index.css
  const baseAnimations = `
    /* Animations */
    @keyframes float {
      0%, 100% { transform: translateY(0) rotate(0deg); }
      33% { transform: translateY(-15px) rotate(1deg); }
      66% { transform: translateY(-8px) rotate(-1deg); }
    }
    @keyframes float-slow {
      0%, 100% { transform: translate(0, 0) scale(1); }
      25% { transform: translate(20px, -20px) scale(1.05); }
      50% { transform: translate(-10px, -30px) scale(0.95); }
      75% { transform: translate(-20px, -10px) scale(1.02); }
    }
    @keyframes pulse-glow {
      0%, 100% { opacity: 0.6; transform: scale(1); filter: blur(60px); }
      50% { opacity: 1; transform: scale(1.1); filter: blur(80px); }
    }
    @keyframes gradient-flow {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    @keyframes shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }
    @keyframes slide-up {
      0% { opacity: 0; transform: translateY(30px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes slide-down {
      0% { opacity: 0; transform: translateY(-30px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes scale-in {
      0% { opacity: 0; transform: scale(0.9); }
      100% { opacity: 1; transform: scale(1); }
    }
    @keyframes rotate-slow {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes bounce-soft {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }
    @keyframes typing-dot {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-8px); opacity: 1; }
    }
    @keyframes energy-pulse {
      0%, 100% { box-shadow: 0 0 20px hsl(270 100% 65% / 0.3), 0 0 40px hsl(45 100% 55% / 0.2); }
      50% { box-shadow: 0 0 40px hsl(270 100% 65% / 0.5), 0 0 80px hsl(45 100% 55% / 0.3); }
    }
    @keyframes glitch {
      0%, 100% { transform: translate(0); text-shadow: -2px 0 hsl(270 100% 65%), 2px 0 hsl(45 100% 55%); }
      20% { transform: translate(-2px, 2px); text-shadow: 2px 0 hsl(270 100% 65%), -2px 0 hsl(45 100% 55%); }
      40% { transform: translate(-2px, -2px); text-shadow: 2px 0 hsl(320 100% 60%), -2px 0 hsl(180 100% 50%); }
      60% { transform: translate(2px, 2px); text-shadow: -2px 0 hsl(45 100% 55%), 2px 0 hsl(270 100% 65%); }
      80% { transform: translate(2px, -2px); text-shadow: 2px 0 hsl(180 100% 50%), -2px 0 hsl(320 100% 60%); }
    }
    @keyframes wave { 0%, 100% { transform: translateY(0) rotate(0deg); } 25% { transform: translateY(-5px) rotate(-5deg); } 50% { transform: translateY(0) rotate(0deg); } 75% { transform: translateY(5px) rotate(5deg); } }
    @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes ping { 0% { transform: scale(1); opacity: 1; } 75%, 100% { transform: scale(2); opacity: 0; } }
    @keyframes wiggle { 0%, 100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
    @keyframes shake { 0%, 100% { transform: translateX(0); } 10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); } 20%, 40%, 60%, 80% { transform: translateX(2px); } }
    @keyframes flip { 0% { transform: perspective(400px) rotateY(0); } 100% { transform: perspective(400px) rotateY(360deg); } }
    @keyframes swing { 0%, 100% { transform: rotate(0deg); transform-origin: top center; } 25% { transform: rotate(15deg); } 50% { transform: rotate(-10deg); } 75% { transform: rotate(5deg); } }
    @keyframes rubber-band { 0% { transform: scale(1, 1); } 30% { transform: scale(1.25, 0.75); } 40% { transform: scale(0.75, 1.25); } 50% { transform: scale(1.15, 0.85); } 65% { transform: scale(0.95, 1.05); } 75% { transform: scale(1.05, 0.95); } 100% { transform: scale(1, 1); } }
    @keyframes heartbeat { 0%, 100% { transform: scale(1); } 14% { transform: scale(1.1); } 28% { transform: scale(1); } 42% { transform: scale(1.1); } 70% { transform: scale(1); } }
    @keyframes jello { 0%, 100% { transform: skewX(0deg) skewY(0deg); } 11.1% { transform: skewX(-12.5deg) skewY(-12.5deg); } 22.2% { transform: skewX(6.25deg) skewY(6.25deg); } 33.3% { transform: skewX(-3.125deg) skewY(-3.125deg); } 44.4% { transform: skewX(1.5625deg) skewY(1.5625deg); } }
    @keyframes flash { 0%, 50%, 100% { opacity: 1; } 25%, 75% { opacity: 0; } }
    @keyframes tada { 0% { transform: scale(1) rotate(0deg); } 10%, 20% { transform: scale(0.9) rotate(-3deg); } 30%, 50%, 70%, 90% { transform: scale(1.1) rotate(3deg); } 40%, 60%, 80% { transform: scale(1.1) rotate(-3deg); } 100% { transform: scale(1) rotate(0deg); } }
    @keyframes zoom-in-out { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
    @keyframes color-shift { 0%, 100% { filter: hue-rotate(0deg); } 50% { filter: hue-rotate(30deg); } }
    @keyframes neon-flicker { 0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% { text-shadow: 0 0 5px hsl(270 100% 65%), 0 0 10px hsl(270 100% 65%), 0 0 20px hsl(270 100% 65%), 0 0 40px hsl(270 100% 65%); } 20%, 24%, 55% { text-shadow: none; } }
    @keyframes morph-blob { 0%, 100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; } 25% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; } 50% { border-radius: 50% 60% 30% 60% / 30% 60% 70% 40%; } 75% { border-radius: 60% 40% 60% 30% / 70% 30% 50% 60%; } }
    @keyframes ripple { 0% { transform: scale(0.8); opacity: 1; } 100% { transform: scale(2.4); opacity: 0; } }
    @keyframes text-reveal { 0% { clip-path: inset(0 100% 0 0); } 100% { clip-path: inset(0 0 0 0); } }
    @keyframes fade-in { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
    @keyframes fade-out { 0% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(10px); } }
    @keyframes accordion-down { from { height: 0; opacity: 0; } to { height: var(--radix-accordion-content-height); opacity: 1; } }
    @keyframes accordion-up { from { height: var(--radix-accordion-content-height); opacity: 1; } to { height: 0; opacity: 0; } }
    
    /* Animation classes */
    .animate-float { animation: float 6s ease-in-out infinite; }
    .animate-float-slow { animation: float-slow 10s ease-in-out infinite; }
    .animate-pulse-glow { animation: pulse-glow 4s ease-in-out infinite; }
    .animate-gradient-flow { background-size: 200% 200%; animation: gradient-flow 4s ease infinite; }
    .animate-shimmer { animation: shimmer 2s linear infinite; }
    .animate-slide-up { animation: slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-slide-down { animation: slide-down 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-scale-in { animation: scale-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-rotate-slow { animation: rotate-slow 20s linear infinite; }
    .animate-bounce-soft { animation: bounce-soft 2s ease-in-out infinite; }
    .animate-typing { animation: typing-dot 1.4s ease-in-out infinite; }
    .animate-energy-pulse { animation: energy-pulse 2s ease-in-out infinite; }
    .animate-glitch { animation: glitch 0.3s ease-in-out infinite; }
    .animate-glitch-hover:hover { animation: glitch 0.3s ease-in-out infinite; }
    .animate-wave { animation: wave 2s ease-in-out infinite; }
    .animate-spin-slow { animation: spin-slow 8s linear infinite; }
    .animate-ping-slow { animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite; }
    .animate-wiggle { animation: wiggle 1s ease-in-out infinite; }
    .animate-shake { animation: shake 0.5s ease-in-out; }
    .animate-flip { animation: flip 1s ease-in-out; }
    .animate-swing { animation: swing 1s ease-in-out infinite; }
    .animate-rubber-band { animation: rubber-band 1s ease; }
    .animate-heartbeat { animation: heartbeat 1.5s ease-in-out infinite; }
    .animate-jello { animation: jello 1s ease; }
    .animate-flash { animation: flash 1s ease infinite; }
    .animate-tada { animation: tada 1s ease; }
    .animate-zoom { animation: zoom-in-out 2s ease-in-out infinite; }
    .animate-color-shift { animation: color-shift 3s ease-in-out infinite; }
    .animate-neon { animation: neon-flicker 1.5s infinite alternate; }
    .animate-morph { animation: morph-blob 8s ease-in-out infinite; }
    .animate-ripple { animation: ripple 1s linear infinite; }
    .animate-text-reveal { animation: text-reveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-fade-in { animation: fade-in 0.3s ease-out; }
    .animate-fade-out { animation: fade-out 0.3s ease-out; }
    .animate-accordion-down { animation: accordion-down 0.2s ease-out; }
    .animate-accordion-up { animation: accordion-up 0.2s ease-out; }
    
    /* Delay classes */
    .delay-100 { animation-delay: 0.1s; }
    .delay-200 { animation-delay: 0.2s; }
    .delay-300 { animation-delay: 0.3s; }
    .delay-400 { animation-delay: 0.4s; }
    .delay-500 { animation-delay: 0.5s; }
    .delay-600 { animation-delay: 0.6s; }
    .delay-700 { animation-delay: 0.7s; }
    .delay-800 { animation-delay: 0.8s; }
    .delay-900 { animation-delay: 0.9s; }
    .delay-1000 { animation-delay: 1s; }
    
    /* Hover effects */
    .hover-lift { transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease; }
    .hover-lift:hover { transform: translateY(-4px); box-shadow: var(--shadow-float); }
    .hover-glow { transition: box-shadow 0.3s ease; }
    .hover-glow:hover { box-shadow: var(--shadow-glow-purple); }
    .hover-scale { transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
    .hover-scale:hover { transform: scale(1.05); }
    .hover-rotate { transition: transform 0.3s ease; }
    .hover-rotate:hover { transform: rotate(5deg); }
    .hover-shake:hover { animation: shake 0.5s ease-in-out; }
    
    /* Glass morphism */
    .glass { background: var(--glass-bg); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid var(--glass-border); }
    .glass-card { background: var(--glass-bg-strong); backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px); border: 1px solid var(--glass-border-strong); }
    .glass-input { background: hsl(260 30% 6% / 0.5); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid var(--glass-border); }
    .glass-button { background: hsl(0 0% 100% / 0.05); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid var(--glass-border); }
    
    /* Gradients */
    .text-gradient { background-clip: text; -webkit-background-clip: text; color: transparent; background-image: var(--gradient-primary); }
    .text-gradient-purple { background-clip: text; -webkit-background-clip: text; color: transparent; background-image: var(--gradient-purple); }
    .text-gradient-gold { background-clip: text; -webkit-background-clip: text; color: transparent; background-image: var(--gradient-gold); }
    .bg-gradient-primary { background-image: var(--gradient-primary); }
    .bg-gradient-purple { background-image: var(--gradient-purple); }
    .bg-gradient-gold { background-image: var(--gradient-gold); }
    .bg-gradient-energy { background-image: var(--gradient-energy); }
    .bg-gradient-dark { background-image: var(--gradient-dark); }
    
    /* Glow effects */
    .shadow-glow { box-shadow: var(--shadow-glow-purple); }
    .shadow-glow-gold { box-shadow: var(--shadow-glow-gold); }
    .shadow-glow-mixed { box-shadow: var(--shadow-glow-mixed); }
    .shadow-float { box-shadow: var(--shadow-float); }
    
    /* Glow text */
    .glow-text { text-shadow: 0 0 20px hsl(270 100% 65% / 0.5), 0 0 40px hsl(270 100% 65% / 0.3); }
    .glow-text-gold { text-shadow: 0 0 20px hsl(45 100% 55% / 0.5), 0 0 40px hsl(45 100% 55% / 0.3); }
    .glow-text-neon { text-shadow: 0 0 5px hsl(270 100% 65%), 0 0 10px hsl(270 100% 65%), 0 0 20px hsl(270 100% 65%), 0 0 40px hsl(45 100% 55%); }
    
    /* Orbs */
    .orb { position: absolute; border-radius: 50%; pointer-events: none; }
    .orb-purple { background: radial-gradient(circle, hsl(270 100% 65% / 0.6) 0%, hsl(270 100% 65% / 0) 70%); filter: blur(60px); }
    .orb-gold { background: radial-gradient(circle, hsl(45 100% 55% / 0.5) 0%, hsl(45 100% 55% / 0) 70%); filter: blur(60px); }
    .orb-pink { background: radial-gradient(circle, hsl(320 100% 60% / 0.5) 0%, hsl(320 100% 60% / 0) 70%); filter: blur(60px); }
    .orb-cyan { background: radial-gradient(circle, hsl(180 100% 50% / 0.5) 0%, hsl(180 100% 50% / 0) 70%); filter: blur(60px); }
  `;

  // Always use CDN URLs for vendor files so they work from any domain (including vipe.lovable.app/app/...)
  const vendorBase = "https://vipe.lovable.app";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preview</title>

  <!-- React from CDN for better reliability -->
  <script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"><\/script>
  <script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"><\/script>
  <script src="https://unpkg.com/@babel/standalone@7.24.5/babel.min.js"><\/script>

  <!-- THREE.js for 3D graphics -->
  <script src="https://unpkg.com/three@0.170.0/build/three.min.js"><\/script>
  
  <!-- GSAP for animations -->
  <script src="https://unpkg.com/gsap@3.12.5/dist/gsap.min.js"><\/script>
  <script src="https://unpkg.com/gsap@3.12.5/dist/ScrollTrigger.min.js"><\/script>

  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Syne', 'system-ui', 'sans-serif'],
            mono: ['JetBrains Mono', 'monospace'],
          },
          colors: {
            background: 'hsl(var(--background))',
            foreground: 'hsl(var(--foreground))',
            muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
            border: 'hsl(var(--border))',
            input: 'hsl(var(--input))',
            ring: 'hsl(var(--ring))',
            card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
            popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
            primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
            secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
            accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
            destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
          },
          borderRadius: {
            lg: 'var(--radius)',
            md: 'calc(var(--radius) - 2px)',
            sm: 'calc(var(--radius) - 4px)'
          }
        }
      }
    };
  <\/script>

  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">

  <style>
    :root {
      --background: 260 30% 4%;
      --foreground: 0 0% 98%;
      --card: 260 25% 8%;
      --card-foreground: 0 0% 98%;
      --popover: 260 25% 10%;
      --popover-foreground: 0 0% 98%;
      --primary: 270 100% 65%;
      --primary-foreground: 0 0% 100%;
      --secondary: 260 30% 12%;
      --secondary-foreground: 0 0% 98%;
      --muted: 260 25% 15%;
      --muted-foreground: 260 15% 55%;
      --accent: 45 100% 55%;
      --accent-foreground: 260 30% 4%;
      --destructive: 0 85% 60%;
      --destructive-foreground: 0 0% 98%;
      --border: 260 25% 18%;
      --input: 260 25% 12%;
      --ring: 270 100% 65%;
      --radius: 1rem;
      --gradient-primary: linear-gradient(135deg, hsl(270 100% 65%), hsl(320 100% 60%), hsl(45 100% 55%));
      --gradient-purple: linear-gradient(135deg, hsl(270 100% 65%), hsl(300 100% 50%));
      --gradient-gold: linear-gradient(135deg, hsl(45 100% 55%), hsl(35 100% 60%));
      --gradient-energy: linear-gradient(135deg, hsl(45 100% 55%), hsl(270 100% 65%));
      --gradient-dark: linear-gradient(180deg, hsl(260 30% 6%), hsl(260 30% 2%));
      --glass-bg: hsl(260 30% 8% / 0.4);
      --glass-bg-strong: hsl(260 30% 6% / 0.7);
      --glass-border: hsl(0 0% 100% / 0.08);
      --glass-border-strong: hsl(0 0% 100% / 0.15);
      --glass-highlight: hsl(0 0% 100% / 0.05);
      --shadow-glow-purple: 0 0 60px hsl(270 100% 65% / 0.4), 0 0 120px hsl(270 100% 65% / 0.2);
      --shadow-glow-gold: 0 0 60px hsl(45 100% 55% / 0.4), 0 0 120px hsl(45 100% 55% / 0.2);
      --shadow-glow-mixed: 0 0 40px hsl(270 100% 65% / 0.3), 0 0 80px hsl(45 100% 55% / 0.2);
      --shadow-float: 0 25px 80px hsl(260 30% 2% / 0.8);
    }

    * { border-color: hsl(var(--border)); box-sizing: border-box; }
    
    body {
      margin: 0;
      background: hsl(var(--background));
      color: hsl(var(--foreground));
      font-family: 'Syne', system-ui, -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    a { color: inherit; text-decoration: inherit; }
    button { cursor: pointer; }

    ${baseAnimations}
    ${cssContent}
  </style>
</head>
<body class="bg-background text-foreground min-h-screen antialiased">
  <div id="root" class="min-h-screen"></div>

  <div id="__sandbox_error" style="display:none; position:fixed; inset:12px; padding:14px; border-radius:14px; background:hsl(var(--background)); color:hsl(var(--foreground)); border:1px solid hsl(var(--border)); box-shadow:0 20px 60px rgba(0,0,0,0.35); overflow:auto; z-index:99999;">
    <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px;">
      <div style="font-weight:700;" data-role="title">Sandbox error</div>
      <div style="display:flex; gap:8px;">
        <button id="__sandbox_copy" style="padding:8px 10px; border-radius:10px; border:1px solid hsl(var(--border)); background:transparent; color:inherit; cursor:pointer;">Copy error</button>
        <button id="__sandbox_reload" style="padding:8px 10px; border-radius:10px; border:1px solid hsl(var(--border)); background:transparent; color:inherit; cursor:pointer;">Reload</button>
      </div>
    </div>
    <pre data-role="msg" style="margin:0; white-space:pre-wrap; word-break:break-word; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono','Courier New', monospace; font-size:12px; line-height:1.45; color:hsl(var(--destructive));"></pre>
  </div>

  <script id="__sandbox_payload" type="application/json">${safeJsonStringify(payload)}</script>
  <script id="__sandbox_runtime" type="text/plain">${runtimeTsx.replace(/<\//g, "<\\/")}</script>
  <script>${runnerJs.replace(/<\//g, "<\\/")}</script>
</body>
</html>`;
}
