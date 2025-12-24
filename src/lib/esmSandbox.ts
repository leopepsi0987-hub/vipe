// ESM-based sandbox that uses native ES modules, Blob URLs, and importmaps
// This is a modern alternative to the eval-based bundler

export type FileMap = Record<string, string>;

// CDN base for esm.sh
const ESM_SH = "https://esm.sh";

// Importmap for all external packages pointing to esm.sh
// Using ?dev for React to get better error messages
const IMPORT_MAP: Record<string, string> = {
  // React ecosystem (dev mode for better errors)
  "react": `${ESM_SH}/react@18.3.1?dev`,
  "react/jsx-runtime": `${ESM_SH}/react@18.3.1/jsx-runtime?dev`,
  "react/jsx-dev-runtime": `${ESM_SH}/react@18.3.1/jsx-dev-runtime?dev`,
  "react-dom": `${ESM_SH}/react-dom@18.3.1?dev`,
  "react-dom/client": `${ESM_SH}/react-dom@18.3.1/client?dev`,
  "react-router-dom": `${ESM_SH}/react-router-dom@6.30.1`,
  
  // Styling
  "clsx": `${ESM_SH}/clsx@2.1.1`,
  "tailwind-merge": `${ESM_SH}/tailwind-merge@2.6.0`,
  "class-variance-authority": `${ESM_SH}/class-variance-authority@0.7.1`,
  "tailwindcss-animate": `${ESM_SH}/tailwindcss-animate@1.0.7`,
  
  // Radix UI
  "@radix-ui/react-accordion": `${ESM_SH}/@radix-ui/react-accordion@1.2.11`,
  "@radix-ui/react-alert-dialog": `${ESM_SH}/@radix-ui/react-alert-dialog@1.1.14`,
  "@radix-ui/react-aspect-ratio": `${ESM_SH}/@radix-ui/react-aspect-ratio@1.1.7`,
  "@radix-ui/react-avatar": `${ESM_SH}/@radix-ui/react-avatar@1.1.10`,
  "@radix-ui/react-checkbox": `${ESM_SH}/@radix-ui/react-checkbox@1.3.2`,
  "@radix-ui/react-collapsible": `${ESM_SH}/@radix-ui/react-collapsible@1.1.11`,
  "@radix-ui/react-context-menu": `${ESM_SH}/@radix-ui/react-context-menu@2.2.15`,
  "@radix-ui/react-dialog": `${ESM_SH}/@radix-ui/react-dialog@1.1.14`,
  "@radix-ui/react-dropdown-menu": `${ESM_SH}/@radix-ui/react-dropdown-menu@2.1.15`,
  "@radix-ui/react-hover-card": `${ESM_SH}/@radix-ui/react-hover-card@1.1.14`,
  "@radix-ui/react-label": `${ESM_SH}/@radix-ui/react-label@2.1.7`,
  "@radix-ui/react-menubar": `${ESM_SH}/@radix-ui/react-menubar@1.1.15`,
  "@radix-ui/react-navigation-menu": `${ESM_SH}/@radix-ui/react-navigation-menu@1.2.13`,
  "@radix-ui/react-popover": `${ESM_SH}/@radix-ui/react-popover@1.1.14`,
  "@radix-ui/react-progress": `${ESM_SH}/@radix-ui/react-progress@1.1.7`,
  "@radix-ui/react-radio-group": `${ESM_SH}/@radix-ui/react-radio-group@1.3.7`,
  "@radix-ui/react-scroll-area": `${ESM_SH}/@radix-ui/react-scroll-area@1.2.9`,
  "@radix-ui/react-select": `${ESM_SH}/@radix-ui/react-select@2.2.5`,
  "@radix-ui/react-separator": `${ESM_SH}/@radix-ui/react-separator@1.1.7`,
  "@radix-ui/react-slider": `${ESM_SH}/@radix-ui/react-slider@1.3.5`,
  "@radix-ui/react-slot": `${ESM_SH}/@radix-ui/react-slot@1.2.3`,
  "@radix-ui/react-switch": `${ESM_SH}/@radix-ui/react-switch@1.2.5`,
  "@radix-ui/react-tabs": `${ESM_SH}/@radix-ui/react-tabs@1.1.12`,
  "@radix-ui/react-toast": `${ESM_SH}/@radix-ui/react-toast@1.2.14`,
  "@radix-ui/react-toggle": `${ESM_SH}/@radix-ui/react-toggle@1.1.9`,
  "@radix-ui/react-toggle-group": `${ESM_SH}/@radix-ui/react-toggle-group@1.1.10`,
  "@radix-ui/react-tooltip": `${ESM_SH}/@radix-ui/react-tooltip@1.2.7`,
  "@radix-ui/react-primitive": `${ESM_SH}/@radix-ui/react-primitive@2.0.4`,
  "@radix-ui/react-presence": `${ESM_SH}/@radix-ui/react-presence@1.1.4`,
  "@radix-ui/react-portal": `${ESM_SH}/@radix-ui/react-portal@1.1.6`,
  "@radix-ui/react-focus-scope": `${ESM_SH}/@radix-ui/react-focus-scope@1.1.4`,
  "@radix-ui/react-dismissable-layer": `${ESM_SH}/@radix-ui/react-dismissable-layer@1.1.5`,
  "@radix-ui/react-id": `${ESM_SH}/@radix-ui/react-id@1.1.0`,
  "@radix-ui/react-compose-refs": `${ESM_SH}/@radix-ui/react-compose-refs@1.1.1`,
  "@radix-ui/react-context": `${ESM_SH}/@radix-ui/react-context@1.1.1`,
  "@radix-ui/react-use-controllable-state": `${ESM_SH}/@radix-ui/react-use-controllable-state@1.1.0`,
  "@radix-ui/react-use-callback-ref": `${ESM_SH}/@radix-ui/react-use-callback-ref@1.1.0`,
  "@radix-ui/react-use-escape-keydown": `${ESM_SH}/@radix-ui/react-use-escape-keydown@1.1.0`,
  "@radix-ui/react-use-layout-effect": `${ESM_SH}/@radix-ui/react-use-layout-effect@1.1.0`,
  "@radix-ui/react-use-previous": `${ESM_SH}/@radix-ui/react-use-previous@1.1.0`,
  "@radix-ui/react-use-size": `${ESM_SH}/@radix-ui/react-use-size@1.1.0`,
  "@radix-ui/react-visually-hidden": `${ESM_SH}/@radix-ui/react-visually-hidden@1.1.4`,
  "@radix-ui/react-arrow": `${ESM_SH}/@radix-ui/react-arrow@1.1.4`,
  "@radix-ui/react-collection": `${ESM_SH}/@radix-ui/react-collection@1.1.4`,
  "@radix-ui/react-direction": `${ESM_SH}/@radix-ui/react-direction@1.1.0`,
  "@radix-ui/react-focus-guards": `${ESM_SH}/@radix-ui/react-focus-guards@1.1.1`,
  "@radix-ui/react-roving-focus": `${ESM_SH}/@radix-ui/react-roving-focus@1.1.4`,
  "@radix-ui/react-menu": `${ESM_SH}/@radix-ui/react-menu@2.1.15`,
  
  // Icons
  "lucide-react": `${ESM_SH}/lucide-react@0.462.0`,
  "@heroicons/react": `${ESM_SH}/@heroicons/react@2`,
  "@heroicons/react/24/solid": `${ESM_SH}/@heroicons/react@2/24/solid`,
  "@heroicons/react/24/outline": `${ESM_SH}/@heroicons/react@2/24/outline`,
  "@heroicons/react/20/solid": `${ESM_SH}/@heroicons/react@2/20/solid`,
  "react-icons": `${ESM_SH}/react-icons@5`,
  "@tabler/icons-react": `${ESM_SH}/@tabler/icons-react@3`,
  "phosphor-react": `${ESM_SH}/phosphor-react@1`,
  "@phosphor-icons/react": `${ESM_SH}/@phosphor-icons/react@2`,
  "iconoir-react": `${ESM_SH}/iconoir-react@7`,
  "react-feather": `${ESM_SH}/react-feather@2`,
  
  // Forms & Validation
  "react-hook-form": `${ESM_SH}/react-hook-form@7.61.1`,
  "@hookform/resolvers": `${ESM_SH}/@hookform/resolvers@3.10.0`,
  "@hookform/resolvers/zod": `${ESM_SH}/@hookform/resolvers@3.10.0/zod`,
  "@hookform/error-message": `${ESM_SH}/@hookform/error-message@2`,
  "zod": `${ESM_SH}/zod@3.25.76`,
  "yup": `${ESM_SH}/yup@1`,
  
  // Data & State
  "@tanstack/react-query": `${ESM_SH}/@tanstack/react-query@5.83.0`,
  "axios": `${ESM_SH}/axios@1`,
  "swr": `${ESM_SH}/swr@2`,
  "ky": `${ESM_SH}/ky@1`,
  "zustand": `${ESM_SH}/zustand@4`,
  "jotai": `${ESM_SH}/jotai@2`,
  "@reduxjs/toolkit": `${ESM_SH}/@reduxjs/toolkit@2`,
  "react-redux": `${ESM_SH}/react-redux@9`,
  "recoil": `${ESM_SH}/recoil@0.7`,
  "valtio": `${ESM_SH}/valtio@1`,
  "immer": `${ESM_SH}/immer@10`,
  
  // Animation
  "framer-motion": `${ESM_SH}/framer-motion@11`,
  "react-spring": `${ESM_SH}/react-spring@9`,
  "@react-spring/web": `${ESM_SH}/@react-spring/web@9`,
  "gsap": `${ESM_SH}/gsap@3`,
  "@formkit/auto-animate": `${ESM_SH}/@formkit/auto-animate@0.8`,
  "@formkit/auto-animate/react": `${ESM_SH}/@formkit/auto-animate@0.8/react`,
  "motion": `${ESM_SH}/motion@11`,
  "@motionone/solid": `${ESM_SH}/@motionone/solid@10`,
  
  // Date
  "date-fns": `${ESM_SH}/date-fns@3.6.0`,
  "dayjs": `${ESM_SH}/dayjs@1`,
  "moment": `${ESM_SH}/moment@2`,
  "luxon": `${ESM_SH}/luxon@3`,
  "@internationalized/date": `${ESM_SH}/@internationalized/date@3`,
  
  // Charts
  "recharts": `${ESM_SH}/recharts@2.15.4`,
  "chart.js": `${ESM_SH}/chart.js@4`,
  "react-chartjs-2": `${ESM_SH}/react-chartjs-2@5`,
  "victory": `${ESM_SH}/victory@37`,
  "@nivo/core": `${ESM_SH}/@nivo/core@0.87`,
  "@visx/visx": `${ESM_SH}/@visx/visx@3`,
  "d3": `${ESM_SH}/d3@7`,
  
  // Carousel
  "embla-carousel-react": `${ESM_SH}/embla-carousel-react@8.6.0`,
  "swiper": `${ESM_SH}/swiper@11`,
  "react-slick": `${ESM_SH}/react-slick@0.30`,
  "slick-carousel": `${ESM_SH}/slick-carousel@1`,
  
  // Toast & Notifications
  "sonner": `${ESM_SH}/sonner@1.7.4`,
  "react-hot-toast": `${ESM_SH}/react-hot-toast@2`,
  "react-toastify": `${ESM_SH}/react-toastify@10`,
  "notistack": `${ESM_SH}/notistack@3`,
  
  // UI Components
  "cmdk": `${ESM_SH}/cmdk@1.1.1`,
  "input-otp": `${ESM_SH}/input-otp@1.4.2`,
  "react-resizable-panels": `${ESM_SH}/react-resizable-panels@2.1.9`,
  "next-themes": `${ESM_SH}/next-themes@0.3.0`,
  "vaul": `${ESM_SH}/vaul@0.9.9`,
  "react-day-picker": `${ESM_SH}/react-day-picker@8.10.1`,
  "react-datepicker": `${ESM_SH}/react-datepicker@6`,
  "@fullcalendar/react": `${ESM_SH}/@fullcalendar/react@6`,
  "@fullcalendar/core": `${ESM_SH}/@fullcalendar/core@6`,
  "@fullcalendar/daygrid": `${ESM_SH}/@fullcalendar/daygrid@6`,
  
  // DnD
  "@dnd-kit/core": `${ESM_SH}/@dnd-kit/core@6`,
  "@dnd-kit/sortable": `${ESM_SH}/@dnd-kit/sortable@8`,
  "@dnd-kit/utilities": `${ESM_SH}/@dnd-kit/utilities@3`,
  "react-beautiful-dnd": `${ESM_SH}/react-beautiful-dnd@13`,
  "react-dnd": `${ESM_SH}/react-dnd@16`,
  "react-dnd-html5-backend": `${ESM_SH}/react-dnd-html5-backend@16`,
  
  // Maps
  "react-leaflet": `${ESM_SH}/react-leaflet@4`,
  "leaflet": `${ESM_SH}/leaflet@1`,
  "@react-google-maps/api": `${ESM_SH}/@react-google-maps/api@2`,
  "mapbox-gl": `${ESM_SH}/mapbox-gl@3`,
  "react-map-gl": `${ESM_SH}/react-map-gl@7`,
  
  // Supabase & Auth
  "@supabase/supabase-js": `${ESM_SH}/@supabase/supabase-js@2`,
  "@supabase/auth-helpers-react": `${ESM_SH}/@supabase/auth-helpers-react@0.5`,
  "@supabase/ssr": `${ESM_SH}/@supabase/ssr@0.5`,
  "firebase": `${ESM_SH}/firebase@10`,
  "firebase/app": `${ESM_SH}/firebase@10/app`,
  "firebase/auth": `${ESM_SH}/firebase@10/auth`,
  "firebase/firestore": `${ESM_SH}/firebase@10/firestore`,
  "firebase/storage": `${ESM_SH}/firebase@10/storage`,
  "@clerk/clerk-react": `${ESM_SH}/@clerk/clerk-react@5`,
  "@auth0/auth0-react": `${ESM_SH}/@auth0/auth0-react@2`,
  
  // Stripe
  "@stripe/stripe-js": `${ESM_SH}/@stripe/stripe-js@4`,
  "@stripe/react-stripe-js": `${ESM_SH}/@stripe/react-stripe-js@2`,
  
  // Rich Text & Markdown
  "@tiptap/react": `${ESM_SH}/@tiptap/react@2`,
  "@tiptap/starter-kit": `${ESM_SH}/@tiptap/starter-kit@2`,
  "@tiptap/extension-link": `${ESM_SH}/@tiptap/extension-link@2`,
  "@tiptap/extension-image": `${ESM_SH}/@tiptap/extension-image@2`,
  "@tiptap/extension-placeholder": `${ESM_SH}/@tiptap/extension-placeholder@2`,
  "@tiptap/pm": `${ESM_SH}/@tiptap/pm@2`,
  "react-markdown": `${ESM_SH}/react-markdown@9`,
  "marked": `${ESM_SH}/marked@12`,
  "remark-gfm": `${ESM_SH}/remark-gfm@4`,
  "rehype-raw": `${ESM_SH}/rehype-raw@7`,
  "react-quill": `${ESM_SH}/react-quill@2`,
  "slate": `${ESM_SH}/slate@0.103`,
  "slate-react": `${ESM_SH}/slate-react@0.111`,
  "lexical": `${ESM_SH}/lexical@0.20`,
  "@lexical/react": `${ESM_SH}/@lexical/react@0.20`,
  
  // Syntax Highlighting
  "highlight.js": `${ESM_SH}/highlight.js@11`,
  "prismjs": `${ESM_SH}/prismjs@1`,
  "react-syntax-highlighter": `${ESM_SH}/react-syntax-highlighter@15`,
  "shiki": `${ESM_SH}/shiki@1`,
  
  // File Handling
  "react-dropzone": `${ESM_SH}/react-dropzone@14`,
  "react-cropper": `${ESM_SH}/react-cropper@2`,
  "cropperjs": `${ESM_SH}/cropperjs@1`,
  "filepond": `${ESM_SH}/filepond@4`,
  "react-filepond": `${ESM_SH}/react-filepond@7`,
  
  // Tables
  "@tanstack/react-table": `${ESM_SH}/@tanstack/react-table@8`,
  "react-table": `${ESM_SH}/react-table@7`,
  "ag-grid-react": `${ESM_SH}/ag-grid-react@32`,
  "ag-grid-community": `${ESM_SH}/ag-grid-community@32`,
  
  // Virtualization
  "@tanstack/react-virtual": `${ESM_SH}/@tanstack/react-virtual@3`,
  "react-virtualized": `${ESM_SH}/react-virtualized@9`,
  "react-window": `${ESM_SH}/react-window@1`,
  "react-virtuoso": `${ESM_SH}/react-virtuoso@4`,
  
  // PDF
  "@react-pdf/renderer": `${ESM_SH}/@react-pdf/renderer@4`,
  "react-pdf": `${ESM_SH}/react-pdf@9`,
  "pdfjs-dist": `${ESM_SH}/pdfjs-dist@4`,
  "pdf-lib": `${ESM_SH}/pdf-lib@1`,
  
  // Image
  "react-image-crop": `${ESM_SH}/react-image-crop@11`,
  "react-zoom-pan-pinch": `${ESM_SH}/react-zoom-pan-pinch@3`,
  "react-medium-image-zoom": `${ESM_SH}/react-medium-image-zoom@5`,
  "react-image-gallery": `${ESM_SH}/react-image-gallery@1`,
  "lightgallery": `${ESM_SH}/lightgallery@2`,
  
  // Media
  "react-player": `${ESM_SH}/react-player@2`,
  "video.js": `${ESM_SH}/video.js@8`,
  "plyr-react": `${ESM_SH}/plyr-react@5`,
  "howler": `${ESM_SH}/howler@2`,
  "tone": `${ESM_SH}/tone@15`,
  "wavesurfer.js": `${ESM_SH}/wavesurfer.js@7`,
  
  // 3D
  "@react-three/fiber": `${ESM_SH}/@react-three/fiber@8`,
  "@react-three/drei": `${ESM_SH}/@react-three/drei@9`,
  "three": `${ESM_SH}/three@0.170`,
  
  // i18n
  "i18next": `${ESM_SH}/i18next@23`,
  "react-i18next": `${ESM_SH}/react-i18next@15`,
  
  // Utilities
  "lodash": `${ESM_SH}/lodash@4`,
  "lodash-es": `${ESM_SH}/lodash-es@4`,
  "underscore": `${ESM_SH}/underscore@1`,
  "ramda": `${ESM_SH}/ramda@0.30`,
  "uuid": `${ESM_SH}/uuid@10`,
  "nanoid": `${ESM_SH}/nanoid@5`,
  "qs": `${ESM_SH}/qs@6`,
  "query-string": `${ESM_SH}/query-string@9`,
  "validator": `${ESM_SH}/validator@13`,
  "email-validator": `${ESM_SH}/email-validator@2`,
  "libphonenumber-js": `${ESM_SH}/libphonenumber-js@1`,
  "numeral": `${ESM_SH}/numeral@2`,
  "currency.js": `${ESM_SH}/currency.js@2`,
  "bignumber.js": `${ESM_SH}/bignumber.js@9`,
  "decimal.js": `${ESM_SH}/decimal.js@10`,
  
  // Node polyfills (browser versions)
  "path": `${ESM_SH}/path-browserify@1`,
  "path-browserify": `${ESM_SH}/path-browserify@1`,
  "buffer": `${ESM_SH}/buffer@6`,
  "process": `${ESM_SH}/process@0.11`,
  "stream": `${ESM_SH}/stream-browserify@3`,
  "stream-browserify": `${ESM_SH}/stream-browserify@3`,
  "util": `${ESM_SH}/util@0.12`,
  "events": `${ESM_SH}/events@3`,
  "crypto": `${ESM_SH}/crypto-browserify@3`,
  "crypto-browserify": `${ESM_SH}/crypto-browserify@3`,
  "assert": `${ESM_SH}/assert@2`,
  "url": `${ESM_SH}/url@0.11`,
  "querystring": `${ESM_SH}/querystring@0.2`,
  "os": `${ESM_SH}/os-browserify@0.3`,
  "os-browserify": `${ESM_SH}/os-browserify@0.3`,
  
  // HTTP
  "node-fetch": `${ESM_SH}/node-fetch@3`,
  "cross-fetch": `${ESM_SH}/cross-fetch@4`,
  "socket.io-client": `${ESM_SH}/socket.io-client@4`,
  
  // Headless UI & Floating
  "@headlessui/react": `${ESM_SH}/@headlessui/react@2`,
  "@floating-ui/react": `${ESM_SH}/@floating-ui/react@0.26`,
  "@floating-ui/react-dom": `${ESM_SH}/@floating-ui/react-dom@2`,
  "@floating-ui/dom": `${ESM_SH}/@floating-ui/dom@1`,
  "focus-trap-react": `${ESM_SH}/focus-trap-react@10`,
  "react-hotkeys-hook": `${ESM_SH}/react-hotkeys-hook@4`,
  "hotkeys-js": `${ESM_SH}/hotkeys-js@3`,
  "react-copy-to-clipboard": `${ESM_SH}/react-copy-to-clipboard@5`,
  
  // QR & Barcode
  "qrcode.react": `${ESM_SH}/qrcode.react@4`,
  "react-qr-code": `${ESM_SH}/react-qr-code@2`,
  "react-barcode": `${ESM_SH}/react-barcode@1`,
  "jsbarcode": `${ESM_SH}/jsbarcode@3`,
  
  // Color Picker
  "react-colorful": `${ESM_SH}/react-colorful@5`,
  "react-color": `${ESM_SH}/react-color@2`,
  
  // Emoji
  "emoji-mart": `${ESM_SH}/emoji-mart@5`,
  "@emoji-mart/react": `${ESM_SH}/@emoji-mart/react@1`,
  "@emoji-mart/data": `${ESM_SH}/@emoji-mart/data@1`,
  
  // Code Editor
  "@monaco-editor/react": `${ESM_SH}/@monaco-editor/react@4`,
  "monaco-editor": `${ESM_SH}/monaco-editor@0.52`,
  "codemirror": `${ESM_SH}/codemirror@6`,
  "@codemirror/state": `${ESM_SH}/@codemirror/state@6`,
  "@codemirror/view": `${ESM_SH}/@codemirror/view@6`,
  "@codemirror/lang-javascript": `${ESM_SH}/@codemirror/lang-javascript@6`,
  "@codemirror/lang-html": `${ESM_SH}/@codemirror/lang-html@6`,
  "@codemirror/lang-css": `${ESM_SH}/@codemirror/lang-css@6`,
  "@codemirror/lang-json": `${ESM_SH}/@codemirror/lang-json@6`,
  
  // Tours
  "react-joyride": `${ESM_SH}/react-joyride@2`,
  "@reactour/tour": `${ESM_SH}/@reactour/tour@3`,
  "intro.js": `${ESM_SH}/intro.js@7`,
  "intro.js-react": `${ESM_SH}/intro.js-react@1`,
  
  // Confetti & Effects
  "canvas-confetti": `${ESM_SH}/canvas-confetti@1`,
  "react-confetti": `${ESM_SH}/react-confetti@6`,
  "lottie-react": `${ESM_SH}/lottie-react@2`,
  "lottie-web": `${ESM_SH}/lottie-web@5`,
  "@lottiefiles/react-lottie-player": `${ESM_SH}/@lottiefiles/react-lottie-player@3`,
  "tsparticles": `${ESM_SH}/tsparticles@3`,
  "react-tsparticles": `${ESM_SH}/react-tsparticles@2`,
  "@tsparticles/react": `${ESM_SH}/@tsparticles/react@3`,
  
  // Typing Animation
  "react-type-animation": `${ESM_SH}/react-type-animation@3`,
  "typed.js": `${ESM_SH}/typed.js@2`,
  "react-typed": `${ESM_SH}/react-typed@2`,
  "react-countup": `${ESM_SH}/react-countup@6`,
  "countup.js": `${ESM_SH}/countup.js@2`,
  
  // Masonry & Grid
  "react-masonry-css": `${ESM_SH}/react-masonry-css@1`,
  "masonry-layout": `${ESM_SH}/masonry-layout@4`,
  "react-grid-layout": `${ESM_SH}/react-grid-layout@1`,
  
  // Scroll & Loading
  "react-infinite-scroll-component": `${ESM_SH}/react-infinite-scroll-component@6`,
  "react-infinite-scroller": `${ESM_SH}/react-infinite-scroller@1`,
  "react-scroll": `${ESM_SH}/react-scroll@1`,
  "react-scroll-parallax": `${ESM_SH}/react-scroll-parallax@3`,
  "locomotive-scroll": `${ESM_SH}/locomotive-scroll@4`,
  "lenis": `${ESM_SH}/lenis@1`,
  "@studio-freight/lenis": `${ESM_SH}/@studio-freight/lenis@1`,
  "react-intersection-observer": `${ESM_SH}/react-intersection-observer@9`,
  
  // Loading
  "react-loading-skeleton": `${ESM_SH}/react-loading-skeleton@3`,
  "react-content-loader": `${ESM_SH}/react-content-loader@7`,
  "react-spinners": `${ESM_SH}/react-spinners@0.14`,
  "react-loader-spinner": `${ESM_SH}/react-loader-spinner@6`,
  "nprogress": `${ESM_SH}/nprogress@0.2`,
  "react-top-loading-bar": `${ESM_SH}/react-top-loading-bar@3`,
  
  // Tooltips & Modals
  "react-tooltip": `${ESM_SH}/react-tooltip@5`,
  "tippy.js": `${ESM_SH}/tippy.js@6`,
  "@tippyjs/react": `${ESM_SH}/@tippyjs/react@4`,
  "react-modal": `${ESM_SH}/react-modal@3`,
  "react-collapse": `${ESM_SH}/react-collapse@5`,
  "react-arborist": `${ESM_SH}/react-arborist@3`,
  
  // Timeline & Rating
  "react-vertical-timeline-component": `${ESM_SH}/react-vertical-timeline-component@3`,
  "react-rating": `${ESM_SH}/react-rating@2`,
  "react-rating-stars-component": `${ESM_SH}/react-rating-stars-component@2`,
  "rc-slider": `${ESM_SH}/rc-slider@11`,
  "react-slider": `${ESM_SH}/react-slider@2`,
  
  // Number & Phone
  "react-number-format": `${ESM_SH}/react-number-format@5`,
  "react-phone-number-input": `${ESM_SH}/react-phone-number-input@3`,
  "react-phone-input-2": `${ESM_SH}/react-phone-input-2@2`,
  "react-credit-cards": `${ESM_SH}/react-credit-cards@0.8`,
  "react-credit-cards-2": `${ESM_SH}/react-credit-cards-2@1`,
  
  // Select & Tags
  "react-select": `${ESM_SH}/react-select@5`,
  "downshift": `${ESM_SH}/downshift@9`,
  "react-tagsinput": `${ESM_SH}/react-tagsinput@3`,
  "react-mentions": `${ESM_SH}/react-mentions@4`,
  
  // Spreadsheet & Data Grid
  "react-spreadsheet": `${ESM_SH}/react-spreadsheet@0.9`,
  "react-data-grid": `${ESM_SH}/react-data-grid@7`,
  
  // Flow & Diagrams
  "reactflow": `${ESM_SH}/reactflow@11`,
  "@xyflow/react": `${ESM_SH}/@xyflow/react@12`,
  "react-konva": `${ESM_SH}/react-konva@18`,
  "konva": `${ESM_SH}/konva@9`,
  "fabric": `${ESM_SH}/fabric@6`,
  "react-signature-canvas": `${ESM_SH}/react-signature-canvas@1`,
  
  // AI SDKs
  "@ai-sdk/react": `${ESM_SH}/@ai-sdk/react@1`,
  "ai": `${ESM_SH}/ai@4`,
  "openai": `${ESM_SH}/openai@4`,
  "@anthropic-ai/sdk": `${ESM_SH}/@anthropic-ai/sdk@0.30`,
  "@google/generative-ai": `${ESM_SH}/@google/generative-ai@0.21`,
  
  // Realtime
  "pusher-js": `${ESM_SH}/pusher-js@8`,
  "ably": `${ESM_SH}/ably@2`,
  
  // Misc
  "@uiw/react-md-editor": `${ESM_SH}/@uiw/react-md-editor@4`,
  "react-textarea-autosize": `${ESM_SH}/react-textarea-autosize@8`,
  "react-input-mask": `${ESM_SH}/react-input-mask@2`,
  "react-imask": `${ESM_SH}/react-imask@7`,
  "workbox-window": `${ESM_SH}/workbox-window@7`,
  "react-helmet": `${ESM_SH}/react-helmet@6`,
  "react-helmet-async": `${ESM_SH}/react-helmet-async@2`,
  "@react-aria/focus": `${ESM_SH}/@react-aria/focus@3`,
  "@react-aria/utils": `${ESM_SH}/@react-aria/utils@3`,
  "react-focus-lock": `${ESM_SH}/react-focus-lock@2`,
};

// Helper to resolve @/ and ~/ paths
function resolveAliasPath(spec: string): string {
  if (spec.startsWith("@/")) {
    return `src/${spec.slice(2)}`;
  }
  if (spec.startsWith("~/")) {
    return `src/${spec.slice(2)}`;
  }
  return spec;
}

// Find actual file path with extension resolution
function resolveFilePath(files: FileMap, rawPath: string, fromPath?: string): string | null {
  const extensions = ["", ".ts", ".tsx", ".js", ".jsx", ".json"];
  const indexFiles = ["/index.ts", "/index.tsx", "/index.js", "/index.jsx"];
  
  let basePath = rawPath;
  
  // Handle relative paths
  if ((rawPath.startsWith("./") || rawPath.startsWith("../")) && fromPath) {
    const fromDir = fromPath.split("/").slice(0, -1).join("/") || "";
    const parts: string[] = [];
    const combined = `${fromDir}/${rawPath}`.split("/");
    for (const p of combined) {
      if (p === "" || p === ".") continue;
      if (p === "..") parts.pop();
      else parts.push(p);
    }
    basePath = parts.join("/");
  }
  
  // Try with extensions
  for (const ext of extensions) {
    const candidate = basePath + ext;
    if (files[candidate] != null) return candidate;
  }
  
  // Try index files
  for (const idx of indexFiles) {
    const candidate = basePath + idx;
    if (files[candidate] != null) return candidate;
  }
  
  return null;
}

// Check if import is external (npm package)
function isExternalImport(spec: string): boolean {
  // Local paths
  if (spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("@/") || spec.startsWith("~/")) {
    return false;
  }
  // CSS/asset imports are handled separately
  if (/\.(css|scss|sass|less|png|jpg|jpeg|gif|svg|webp|ico|mp4|mp3|wav|woff|woff2|ttf|eot)$/i.test(spec)) {
    return false;
  }
  return true;
}

// Extract all imports from code
function extractImports(code: string): Array<{ full: string; bindings: string; path: string; isType: boolean }> {
  const imports: Array<{ full: string; bindings: string; path: string; isType: boolean }> = [];
  
  // import X from 'path'
  // import { A, B } from 'path'
  // import * as X from 'path'
  // import X, { A } from 'path'
  // import type { X } from 'path'
  const importRegex = /^import\s+(type\s+)?(.+?)\s+from\s+['"]([^'"]+)['"];?\s*$/gm;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    imports.push({
      full: match[0],
      isType: !!match[1],
      bindings: match[2],
      path: match[3],
    });
  }
  
  // Side-effect imports: import 'path'
  const sideEffectRegex = /^import\s+['"]([^'"]+)['"];?\s*$/gm;
  while ((match = sideEffectRegex.exec(code)) !== null) {
    imports.push({
      full: match[0],
      isType: false,
      bindings: "",
      path: match[1],
    });
  }
  
  return imports;
}

// Transpile TSX/TS to JS using Babel (in browser)
declare const Babel: {
  transform: (code: string, options: { filename?: string; presets?: string[] }) => { code: string };
};

export interface ESMSandboxResult {
  html: string;
  blobUrls: string[];
}

export function generateESMSandbox(
  files: FileMap,
  entryFile: string = "src/App.tsx"
): ESMSandboxResult {
  const blobUrls: string[] = [];
  const fileToUrlMap = new Map<string, string>();
  const cssContent: string[] = [];
  
  // Step 1: Collect all CSS content
  for (const [path, content] of Object.entries(files)) {
    if (/\.(css|scss|sass)$/i.test(path)) {
      cssContent.push(`/* ${path} */\n${content}`);
    }
  }
  
  // Step 2: Build dependency graph and process files
  const processedFiles = new Map<string, string>();
  const visitedPaths = new Set<string>();
  
  function processFile(filePath: string): void {
    if (visitedPaths.has(filePath)) return;
    visitedPaths.add(filePath);
    
    const content = files[filePath];
    if (content == null) return;
    
    // Skip non-JS files
    if (!/\.(ts|tsx|js|jsx)$/i.test(filePath)) return;
    
    const imports = extractImports(content);
    
    // Process dependencies first (topological order)
    for (const imp of imports) {
      const resolvedPath = resolveAliasPath(imp.path);
      
      // Skip external and CSS imports
      if (isExternalImport(imp.path) || /\.(css|scss|sass)$/i.test(imp.path)) continue;
      
      const actualPath = resolveFilePath(files, resolvedPath, filePath);
      if (actualPath) {
        processFile(actualPath);
      }
    }
    
    // Store processed file path
    processedFiles.set(filePath, content);
  }
  
  // Start processing from entry
  const resolvedEntry = resolveFilePath(files, entryFile);
  if (resolvedEntry) {
    processFile(resolvedEntry);
  } else {
    // Try App.tsx if entry not found
    const appEntry = resolveFilePath(files, "src/App.tsx") || resolveFilePath(files, "src/App");
    if (appEntry) processFile(appEntry);
  }
  
  // Step 3: Pre-transform all files and create Blob URLs
  const fileToBlobUrl = new Map<string, string>();
  const transformedSources: Record<string, string> = {};
  
  // Transform all files first
  for (const [filePath, content] of processedFiles) {
    let transformedCode = content;
    const imports = extractImports(content);
    
    // Rewrite local imports
    for (const imp of imports) {
      // Skip type-only imports
      if (imp.isType) {
        transformedCode = transformedCode.replace(imp.full, `// Type import: ${imp.path}`);
        continue;
      }
      
      // Remove inline type imports
      if (imp.bindings.includes(" type ")) {
        const cleanedBindings = imp.bindings
          .replace(/\btype\s+([A-Za-z_$][\w$]*)/g, "")
          .replace(/,\s*,/g, ",")
          .replace(/\{\s*,/g, "{")
          .replace(/,\s*\}/g, "}")
          .trim();
        
        if (!cleanedBindings || cleanedBindings === "{}" || cleanedBindings === "{ }") {
          transformedCode = transformedCode.replace(imp.full, `// Type import removed: ${imp.path}`);
          continue;
        }
        
        const newImport = `import ${cleanedBindings} from "${imp.path}";`;
        transformedCode = transformedCode.replace(imp.full, newImport);
      }
      
      // Skip CSS imports (will be injected as style)
      if (/\.(css|scss|sass|less)$/i.test(imp.path)) {
        transformedCode = transformedCode.replace(imp.full, `// CSS: ${imp.path}`);
        continue;
      }
      
      // Handle asset imports
      if (/\.(png|jpg|jpeg|gif|svg|webp|ico|bmp)$/i.test(imp.path)) {
        const placeholder = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23ccc' width='100' height='100'/%3E%3C/svg%3E`;
        const varName = imp.bindings.replace(/^default\s+as\s+/, "").trim();
        transformedCode = transformedCode.replace(imp.full, `const ${varName} = "${placeholder}";`);
        continue;
      }
      
      if (/\.(mp4|webm|mp3|wav|ogg)$/i.test(imp.path)) {
        const varName = imp.bindings.trim();
        transformedCode = transformedCode.replace(imp.full, `const ${varName} = "";`);
        continue;
      }
      
      // Skip external imports (they use importmap)
      if (isExternalImport(imp.path)) continue;
      
      // Resolve local import to actual file path
      const resolvedPath = resolveAliasPath(imp.path);
      const actualPath = resolveFilePath(files, resolvedPath, filePath);
      
      if (actualPath) {
        // Rewrite to use importmap key format
        const moduleKey = `__local__/${actualPath}`;
        const newImport = imp.full.replace(/from\s+['"][^'"]+['"]/, `from "${moduleKey}"`);
        transformedCode = transformedCode.replace(imp.full, newImport);
      } else {
        // Provide stub for unresolved imports
        const namedMatch = imp.bindings.match(/\{([^}]+)\}/);
        let stubCode = "";
        
        if (namedMatch) {
          const names = namedMatch[1]
            .split(",")
            .map((s) => s.trim().split(" as ").pop()?.trim())
            .filter(Boolean);
          for (const name of names) {
            if (name === "cn") {
              stubCode += `const ${name} = (...args) => args.filter(Boolean).join(' ');\n`;
            } else if (name === "useToast") {
              stubCode += `const ${name} = () => ({ toast: () => {}, toasts: [] });\n`;
            } else if (name === "toast") {
              stubCode += `const ${name} = () => {};\n`;
            } else {
              stubCode += `const ${name} = window.React?.forwardRef?.(({ children, ...props }, ref) => window.React.createElement('div', { ref, ...props }, children)) || (() => null);\n`;
            }
          }
        }
        
        const defaultMatch = imp.bindings.match(/^([A-Za-z_$][\w$]*)(?:\s*,|$)/);
        if (defaultMatch && !imp.bindings.startsWith("{")) {
          stubCode += `const ${defaultMatch[1]} = window.React?.forwardRef?.(({ children, ...props }, ref) => window.React.createElement('div', { ref, ...props }, children)) || (() => null);\n`;
        }
        
        transformedCode = transformedCode.replace(imp.full, `// Stub for: ${imp.path}\n${stubCode}`);
      }
    }
    
    transformedSources[filePath] = transformedCode;
  }
  
  // Step 4: Generate the importmap with local modules as Blob URLs
  // We'll do the actual Blob URL creation in the browser, but prepare the module registry
  const importMap = {
    imports: { ...IMPORT_MAP } as Record<string, string>
  };
  
  // The runtime script will handle local module loading
  const moduleRegistry: Record<string, string> = {};
  for (const [filePath, source] of Object.entries(transformedSources)) {
    moduleRegistry[`__local__/${filePath}`] = source;
  }
  
  // Step 5: Build the HTML with inline Blob URL creation
  const entryModuleKey = `__local__/${resolvedEntry || "src/App.tsx"}`;
  
  const runtimeScript = `
    // Module registry (raw source)
    const __modules = ${JSON.stringify(moduleRegistry).replace(/<\//g, "<\\/")};
    const __blobUrls = {};
    const __moduleCache = {};
    const __pending = {};
    
    // Error display
    function __showError(title, err) {
      const el = document.getElementById('__sandbox_error');
      if (el) {
        el.style.display = 'block';
        el.querySelector('[data-role="title"]').textContent = title;
        el.querySelector('[data-role="msg"]').textContent = String(err?.stack || err?.message || err);
      }
      window.parent?.postMessage({ type: 'SANDBOX_ERROR', title, message: String(err?.stack || err?.message || err) }, '*');
    }
    
    window.onerror = (msg, src, line, col, err) => {
      __showError('Runtime Error', err || msg);
    };
    
    window.onunhandledrejection = (e) => {
      __showError('Unhandled Promise Rejection', e.reason);
    };
    
    // Create Blob URLs for all local modules
    function __createBlobUrls() {
      const keys = Object.keys(__modules);
      
      // First pass: transform all modules and create blob URLs
      for (const key of keys) {
        const source = __modules[key];
        try {
          const transformed = Babel.transform(source, {
            filename: key.replace('__local__/', ''),
            presets: ['typescript', 'react'],
          }).code;
          
          // Rewrite imports to use blob URLs
          let finalCode = transformed;
          
          const blob = new Blob([finalCode], { type: 'application/javascript' });
          __blobUrls[key] = URL.createObjectURL(blob);
        } catch (err) {
          console.error('Failed to transform:', key, err);
          __showError('Transform Error: ' + key, err);
        }
      }
      
      // Second pass: update all blob content with correct import paths
      for (const key of keys) {
        const source = __modules[key];
        try {
          let transformed = Babel.transform(source, {
            filename: key.replace('__local__/', ''),
            presets: ['typescript', 'react'],
          }).code;
          
          // Replace local module references with blob URLs
          for (const [modKey, blobUrl] of Object.entries(__blobUrls)) {
            // Match import statements for this module
            const escapedKey = modKey.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
            const importRegex = new RegExp('from\\\\s*["\\'"]' + escapedKey + '["\\'"]', 'g');
            transformed = transformed.replace(importRegex, 'from "' + blobUrl + '"');
            
            // Also handle dynamic imports
            const dynamicRegex = new RegExp('import\\\\(["\\'"]' + escapedKey + '["\\'"]\\\\)', 'g');
            transformed = transformed.replace(dynamicRegex, 'import("' + blobUrl + '")');
          }
          
          // Recreate blob with updated imports
          URL.revokeObjectURL(__blobUrls[key]);
          const blob = new Blob([transformed], { type: 'application/javascript' });
          __blobUrls[key] = URL.createObjectURL(blob);
        } catch (err) {
          // Keep the old blob URL
        }
      }
    }
    
    // Bootstrap the app
    async function __bootstrap() {
      try {
        const React = await import('react');
        const ReactDOM = await import('react-dom/client');
        
        // Make React available globally BEFORE loading any modules
        window.React = React;
        window.ReactDOM = ReactDOM;
        
        // Provide common hooks globally
        ['useState', 'useEffect', 'useMemo', 'useCallback', 'useRef', 'useReducer', 'useContext', 'useLayoutEffect', 'useId', 'Fragment', 'createElement', 'forwardRef', 'memo', 'lazy', 'Suspense', 'createContext', 'Children', 'cloneElement', 'isValidElement'].forEach(name => {
          if (React[name]) window[name] = React[name];
        });
        
        // Create all blob URLs
        __createBlobUrls();
        
        // Import entry module
        const entryUrl = __blobUrls['${entryModuleKey}'];
        if (!entryUrl) {
          throw new Error('Entry module not found: ${entryModuleKey}');
        }
        
        const AppModule = await import(entryUrl);
        let App = AppModule.default || AppModule.App;
        
        // Debug: log what we got
        console.log('AppModule:', AppModule);
        console.log('App:', App);
        console.log('typeof App:', typeof App);
        
        // Handle case where App is already a React element (JSX) instead of a component function
        if (App && typeof App === 'object' && App.$$typeof) {
          // It's already a React element, render it directly
          console.log('App is already a React element, rendering directly');
          const root = ReactDOM.createRoot(document.getElementById('root'));
          root.render(React.createElement(React.StrictMode, null, App));
          return;
        }
        
        // Ensure App is a valid component
        if (!App || (typeof App !== 'function' && typeof App !== 'object')) {
          console.warn('No valid App component found, creating placeholder');
          App = () => React.createElement('div', { 
            style: { padding: '20px', textAlign: 'center' }
          }, 'No App component found');
        }
        
        // Render
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(React.StrictMode, null, React.createElement(App)));
      } catch (err) {
        console.error('Bootstrap error:', err);
        __showError('Bootstrap Error', err);
      }
    }
    
    __bootstrap();
  `;
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ESM Sandbox</title>
  
  <script type="importmap">
${JSON.stringify(importMap, null, 2)}
  </script>
  
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
            secondary: 'hsl(var(--secondary))',
            'secondary-foreground': 'hsl(var(--secondary-foreground))',
            accent: 'hsl(var(--accent))',
            'accent-foreground': 'hsl(var(--accent-foreground))',
            destructive: 'hsl(var(--destructive))',
            'destructive-foreground': 'hsl(var(--destructive-foreground))',
            ring: 'hsl(var(--ring))',
            input: 'hsl(var(--input))',
          },
          borderRadius: {
            lg: 'var(--radius)',
            md: 'calc(var(--radius) - 2px)',
            sm: 'calc(var(--radius) - 4px)',
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
      --popover: 0 0% 100%;
      --popover-foreground: 222.2 84% 4.9%;
      --primary: 221.2 83.2% 53.3%;
      --primary-foreground: 210 40% 98%;
      --secondary: 210 40% 96.1%;
      --secondary-foreground: 222.2 47.4% 11.2%;
      --muted: 210 40% 96.1%;
      --muted-foreground: 215.4 16.3% 46.9%;
      --accent: 210 40% 96.1%;
      --accent-foreground: 222.2 47.4% 11.2%;
      --destructive: 0 84.2% 60.2%;
      --destructive-foreground: 210 40% 98%;
      --border: 214.3 31.8% 91.4%;
      --input: 214.3 31.8% 91.4%;
      --ring: 221.2 83.2% 53.3%;
      --radius: 0.5rem;
    }
    
    .dark {
      --background: 222.2 84% 4.9%;
      --foreground: 210 40% 98%;
      --card: 222.2 84% 4.9%;
      --card-foreground: 210 40% 98%;
      --popover: 222.2 84% 4.9%;
      --popover-foreground: 210 40% 98%;
      --primary: 217.2 91.2% 59.8%;
      --primary-foreground: 222.2 47.4% 11.2%;
      --secondary: 217.2 32.6% 17.5%;
      --secondary-foreground: 210 40% 98%;
      --muted: 217.2 32.6% 17.5%;
      --muted-foreground: 215 20.2% 65.1%;
      --accent: 217.2 32.6% 17.5%;
      --accent-foreground: 210 40% 98%;
      --destructive: 0 62.8% 30.6%;
      --destructive-foreground: 210 40% 98%;
      --border: 217.2 32.6% 17.5%;
      --input: 217.2 32.6% 17.5%;
      --ring: 224.3 76.3% 48%;
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: hsl(var(--background));
      color: hsl(var(--foreground));
    }
    
    ${cssContent.join("\n\n")}
  </style>
</head>
<body class="bg-background text-foreground">
  <div id="root"></div>
  
  <div id="__sandbox_error" style="display:none; position:fixed; inset:12px; padding:16px; border-radius:12px; background:hsl(var(--background)); border:1px solid hsl(var(--border)); box-shadow:0 20px 60px rgba(0,0,0,0.3); overflow:auto; z-index:99999;">
    <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px;">
      <div style="font-weight:700; color:hsl(var(--destructive));" data-role="title">Error</div>
      <button onclick="location.reload()" style="padding:6px 12px; border-radius:6px; border:1px solid hsl(var(--border)); background:transparent; color:inherit; cursor:pointer;">Reload</button>
    </div>
    <pre data-role="msg" style="margin:0; white-space:pre-wrap; word-break:break-word; font-family:ui-monospace, monospace; font-size:12px; color:hsl(var(--destructive));"></pre>
  </div>
  
  <script type="module">
${runtimeScript}
  </script>
</body>
</html>`;
  
  return { html, blobUrls };
}

// Helper to add more packages to the import map at runtime
export function extendImportMap(packages: Record<string, string>): void {
  Object.assign(IMPORT_MAP, packages);
}

// Get the current import map
export function getImportMap(): Record<string, string> {
  return { ...IMPORT_MAP };
}
