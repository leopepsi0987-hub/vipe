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
  return code
    .replace(/export\s+default\s+function\s+/g, "function ")
    .replace(/export\s+default\s+/g, "")
    .replace(/^export\s+(?=(const|let|var|function|class)\b)/gm, "")
    .replace(/^export\s*\{[^}]+\}\s*;?\s*$/gm, "");
}

// Legacy function kept for compatibility but now only strips exports
function stripExportsAndImports(code: string) {
  return code
    .replace(/^import\s+.*?['"].*?['"];?\s*$/gm, "")
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
  "clsx": { global: "clsx", hasDefault: true, namedExports: ["clsx"] },
  "tailwind-merge": { global: "twMerge", hasDefault: true, namedExports: ["twMerge", "twJoin"] },
  "class-variance-authority": { global: "cva", hasDefault: true, namedExports: ["cva", "cx"] },
  "tailwindcss-animate": { global: "{}"},
  "tailwindcss": { global: "{}" },

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
  "@/lib/utils": { global: "libUtils", namedExports: ["cn"] },
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

    // Handle asset imports (images, fonts, etc.) - return placeholder URL
    if (/\.(png|jpg|jpeg|gif|svg|webp|ico|bmp|tiff)$/i.test(spec)) {
      const varName = bindings.trim();
      return `const ${varName} = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23ddd' width='100' height='100'/%3E%3C/svg%3E"; // Image placeholder`;
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

export function generateBundledHTML(files: FileMap): string {
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

     // Tiny polyfills for common deps used in generated apps.
     // (The sandbox does not have node_modules.)
     if (!window.clsx) {
       window.clsx = function clsx() {
         const out = [];
         for (let i = 0; i < arguments.length; i++) {
           const v = arguments[i];
           if (!v) continue;
           if (typeof v === 'string') out.push(v);
           else if (Array.isArray(v)) out.push(window.clsx.apply(null, v));
           else if (typeof v === 'object') {
             for (const k in v) {
               if (Object.prototype.hasOwnProperty.call(v, k) && v[k]) out.push(k);
             }
           }
         }
         return out.join(' ');
       };
     }
     if (!window.twMerge) {
       // Minimal fallback: just joins class strings. (Not a full Tailwind conflict resolver.)
       window.twMerge = function twMerge() {
         const parts = [];
         for (let i = 0; i < arguments.length; i++) {
           const v = arguments[i];
           if (typeof v === 'string' && v.trim()) parts.push(v.trim());
         }
         return parts.join(' ');
       };
     }

     if (!window.cx) {
       window.cx = function cx() {
         // alias to clsx if available
         return (window.clsx || function(){ return Array.prototype.join.call(arguments, ' '); }).apply(null, arguments);
       };
     }

     if (!window.cva) {
       window.cva = function cva(base, config) {
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

           return (window.twMerge || function(x){return x;})( (window.cx || window.clsx).apply(null, classes) );
         };
       };
     }

     if (!window.lucideReact) {
        const makeIcon = (name) => {
          return function LucideIcon(props) {
            const p = props || {};
            const size = p.size || 24;
            const strokeWidth = p.strokeWidth || 2;
            const color = p.color || 'currentColor';
            const svgProps = {
              width: size,
              height: size,
              viewBox: '0 0 24 24',
              fill: 'none',
              stroke: color,
              strokeWidth,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              'aria-label': name,
              ...p,
            };
            return React.createElement('svg', svgProps,
              React.createElement('circle', { cx: 12, cy: 12, r: 9 }),
              React.createElement('path', { d: 'M8 12h8' })
            );
          };
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
          dynamicIconImports: {},
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
          return function IconStub(props) {
            const p = props || {};
            return React.createElement('svg', { width: p.size || 24, height: p.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, ...p },
              React.createElement('circle', { cx: 12, cy: 12, r: 9 })
            );
          };
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
        return Babel.transform(code, {
          filename: filename || 'unknown.tsx',
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preview</title>

  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            background: 'hsl(var(--background))',
            foreground: 'hsl(var(--foreground))',
            muted: 'hsl(var(--muted))',
            'muted-foreground': 'hsl(var(--muted-foreground))',
            border: 'hsl(var(--border))',
            card: 'hsl(var(--card))',
            'card-foreground': 'hsl(var(--card-foreground))',
            primary: 'hsl(var(--primary))',
            'primary-foreground': 'hsl(var(--primary-foreground))',
            destructive: 'hsl(var(--destructive))',
            'destructive-foreground': 'hsl(var(--destructive-foreground))'
          },
          borderRadius: {
            lg: 'var(--radius)',
            md: 'calc(var(--radius) - 2px)',
            sm: 'calc(var(--radius) - 4px)'
          }
        }
      }
    };
  </script>

  <style>
    :root {
      --background: 0 0% 100%;
      --foreground: 222.2 84% 4.9%;
      --card: 0 0% 100%;
      --card-foreground: 222.2 84% 4.9%;
      --primary: 221.2 83.2% 53.3%;
      --primary-foreground: 210 40% 98%;
      --muted: 210 40% 96%;
      --muted-foreground: 215.4 16.3% 46.9%;
      --destructive: 0 84.2% 60.2%;
      --destructive-foreground: 210 40% 98%;
      --border: 214.3 31.8% 91.4%;
      --radius: 0.5rem;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --background: 222.2 84% 4.9%;
        --foreground: 210 40% 98%;
        --card: 222.2 84% 4.9%;
        --card-foreground: 210 40% 98%;
        --primary: 217.2 91.2% 59.8%;
        --primary-foreground: 222.2 47.4% 11.2%;
        --muted: 217.2 32.6% 17.5%;
        --muted-foreground: 215 20.2% 65.1%;
        --destructive: 0 62.8% 30.6%;
        --destructive-foreground: 210 40% 98%;
        --border: 217.2 32.6% 17.5%;
      }
    }

    body {
      margin: 0;
      background: hsl(var(--background));
      color: hsl(var(--foreground));
      font-family: system-ui, -apple-system, sans-serif;
    }

    ${cssContent}
  </style>
</head>
<body class="bg-background text-foreground">
  <div id="root"></div>

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
