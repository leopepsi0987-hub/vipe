import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Language = "en" | "dz";

// Algerian Darija (DZ Slang) translations
export const translations = {
  en: {
    // Auth
    welcomeBack: "Welcome back",
    createAccount: "Create your account",
    email: "Email",
    password: "Password",
    signIn: "Sign In",
    signUp: "Create Account",
    noAccount: "Don't have an account? Sign up",
    hasAccount: "Already have an account? Sign in",
    fillFields: "Please fill in all fields",
    passwordMinLength: "Password must be at least 6 characters",
    welcomeBackToast: "Welcome back!",
    accountCreated: "Account created! You can now start building.",
    emailRegistered: "This email is already registered. Try logging in.",
    aiPlatform: "AI-powered code generation platform",
    buildWithAI: "Build beautiful apps with AI assistance",
    
    // Sidebar
    projects: "Apps",
    noProjects: "No apps yet",
    newProject: "New App",
    rename: "Rename",
    delete: "Delete",
    signOut: "Sign Out",
    
    // Dashboard
    selectProject: "Select an app",
    selectProjectDesc: "Choose an app from the sidebar or create a new one",
    projectCreated: "App created!",
    projectDeleted: "App deleted",
    signedOut: "Signed out",
    
    // Editor/Chat
    howCanIHelp: "How can I help you?",
    tellMeWhatToBuild: "Tell me what you want to build and I'll create it for you",
    buildTodoApp: "Build a todo app",
    createLandingPage: "Create a landing page",
    makeDashboard: "Make a dashboard",
    whatToBuild: "What do you want to build?",
    continueConvo: "Continue the conversation...",
    askAnything: "Ask anything or describe the app you want to build...",
    building: "Building your app...",
    aiDisclaimer: "Vipe uses AI. Check important info.",
    you: "You",
    copy: "Copy",
    good: "Good",
    bad: "Bad",
    regenerate: "Regenerate",
    preview: "Preview",
    code: "Code",
    sharedImage: "Shared image",
    uploadPreview: "Upload preview",
    imageTooLarge: "Image must be less than 10MB",
    attachImage: "Attach image",
    webSearch: "Web search",
    
    // Tabs
    chat: "Chat",
    data: "Data",
    history: "History",
    publish: "Publish",
    
    // Version History
    versionHistory: "Version History",
    restore: "Restore",
    restoredTo: "Restored to version",
    
    // Data Panel
    storage: "Storage",
    tables: "Tables",
    noData: "No data yet",
    
    // Preview
    desktop: "Desktop",
    tablet: "Tablet",
    mobile: "Mobile",
    openInNewTab: "Open in new tab",
    
    // Misc
    loading: "Loading...",
    error: "Something went wrong",
    tryAgain: "Try again",
    cancel: "Cancel",
    save: "Save",
    close: "Close",
    done: "Done! Your app is ready. 🚀",
    oops: "Oops, something went wrong! Try again? 😅",
    buildStopped: "Build stopped",
    
    // Builder Page
    builder: "Builder",
    generateNewApp: "Generate New App",
    createAndManage: "Create and manage your AI-powered apps",
    noAppsYet: "No apps yet",
    generateFirst: "Generate your first app to get started",
    generateFirstApp: "Generate First App",
    createWithAI: "Create with AI",
    published: "Published",
    
    // Generation Page
    enterUrl: "Enter URL or describe what to build...",
    pasteUrl: "Paste a URL, describe your app, or attach a screenshot",
    creatingEnvironment: "Creating sandbox environment...",
    analyzingUrl: "Analyzing website...",
    generatingCode: "Generating code...",
    applyingChanges: "Applying changes...",
    
    // Mobile tabs
    chatTab: "Chat",
    previewTab: "Preview",
    
    // Video
    skip: "Skip",
    
    // Profile
    profile: "Profile",
    editProfile: "Edit Profile",
    myApps: "My Apps",
    posts: "Posts",
    followers: "Followers",
    following: "Following",
    joined: "Joined",
    publishedProjects: "Published Projects",
    noPublishedProjects: "No published projects yet",
    
    // Social
    like: "Like",
    comment: "Comment",
    share: "Share",
    postApp: "Post App",
    
    // Navigation
    home: "Home",
    explore: "Explore",
    notifications: "Notifications",
    messages: "Messages",
    settings: "Settings",
    help: "Help",
    about: "About",
    
    // Tasks
    tasks: "Tasks",
    pending: "Pending",
    inProgress: "In Progress",
    completed: "Completed",
    
    // File Actions
    reading: "Reading",
    editing: "Editing",
    edited: "Edited",
    creating: "Creating",
    created: "Created",
    
    // AI Status
    thinking: "Thinking...",
    thoughtFor: "Thought for",
    seconds: "seconds",
    processing: "Processing...",
    analyzing: "Analyzing...",
    
    // Forms
    username: "Username",
    displayName: "Display Name",
    bio: "Bio",
    avatar: "Avatar",
    update: "Update",
    submit: "Submit",
    confirm: "Confirm",
    
    // Errors
    errorOccurred: "An error occurred",
    notFound: "Not found",
    unauthorized: "Unauthorized",
    forbidden: "Forbidden",
    serverError: "Server error",
    networkError: "Network error",
    
    // Success
    success: "Success",
    saved: "Saved",
    updated: "Updated",
    deleted: "Deleted",
    copied: "Copied",
    
    // Time
    justNow: "Just now",
    minutesAgo: "minutes ago",
    hoursAgo: "hours ago",
    daysAgo: "days ago",
    
    // Actions
    edit: "Edit",
    view: "View",
    download: "Download",
    upload: "Upload",
    refresh: "Refresh",
    search: "Search",
    filter: "Filter",
    sort: "Sort",
    
    // Pricing
    pricing: "Pricing",
    free: "Free",
    pro: "Pro",
    enterprise: "Enterprise",
    subscribe: "Subscribe",
    upgrade: "Upgrade",
    
    // Privacy & Terms
    privacy: "Privacy",
    terms: "Terms",
    refund: "Refund",
    
    // Misc Extended
    welcome: "Welcome",
    getStarted: "Get Started",
    learnMore: "Learn More",
    seeMore: "See More",
    showLess: "Show Less",
    hideDetails: "Hide",
    showDetails: "Show",
    noResults: "No results",
    empty: "Empty",
    
    // Connection
    connected: "Connected",
    disconnected: "Disconnected",
    connecting: "Connecting...",
    connectDB: "Connect DB",
    
    // Sandbox
    sandbox: "Sandbox",
    sandboxReady: "Sandbox ready",
    sandboxExpired: "Sandbox expired",
    creatingSandbox: "Creating sandbox...",
    
    // Post Components
    shareWhatBuilding: "Share what you're building...",
    showcaseApp: "Showcase App",
    post: "Post",
    addContentOrMedia: "Please add some content or media",
    failedUploadMedia: "Failed to upload media",
    failedCreatePost: "Failed to create post",
    postCreated: "Post created!",
    selectProjectToShowcase: "Select a project to showcase",
    selectImageOrVideo: "Please select an image or video file",
    alreadyShared: "You've already shared this post",
    postShared: "Post shared!",
    postDeleted: "Post deleted",
    writeComment: "Write a comment...",
    appShowcase: "App Showcase",
    remix: "Remix",
    
    // Builder Page Extended
    createManageApps: "Create and manage your AI-powered applications",
    noProjectsYet: "No projects yet",
    generateFirstToStart: "Generate your first app to get started",
    
    // Visual Editor
    visualEdit: "Visual Edit",
    selectElement: "Select an element to edit",
    applyChanges: "Apply Changes",
    cancelEdit: "Cancel Edit",
    
    // AI Tools
    imageGeneration: "Image Generation",
    webSearchTool: "Web Search",
    documentParsing: "Document Parsing",
    codeExecution: "Code Execution",
  },
  dz: {
    // Auth
    welcomeBack: "مرحبا بيك خويا",
    createAccount: "دير كونت جديد",
    email: "الإيميل",
    password: "الباسوورد",
    signIn: "ادخل",
    signUp: "سجل",
    noAccount: "ماعندكش كونت؟ سجل هنا",
    hasAccount: "عندك كونت؟ ادخل هنا",
    fillFields: "عمّر كلش يا صاحبي",
    passwordMinLength: "الباسوورد لازم 6 حروف على الأقل",
    welcomeBackToast: "مرحبا بيك!",
    accountCreated: "تم الإنشاء! دابا تقدر تبني اللي تحب",
    emailRegistered: "هذا الإيميل مسجل من قبل. جرب تدخل",
    aiPlatform: "منصة ذكاء اصطناعي للبرمجة",
    buildWithAI: "ابني تطبيقات جميلة بالذكاء الاصطناعي",
    
    // Sidebar
    projects: "التطبيقات",
    noProjects: "ما كاين حتى تطبيق",
    newProject: "تطبيق جديد",
    rename: "بدّل الإسم",
    delete: "امسح",
    signOut: "اخرج",
    
    // Dashboard
    selectProject: "اختار تطبيق",
    selectProjectDesc: "اختار تطبيق من الجنب ولا دير واحد جديد",
    projectCreated: "تم إنشاء التطبيق!",
    projectDeleted: "تم مسح التطبيق",
    signedOut: "خرجت",
    
    // Editor/Chat
    howCanIHelp: "كيفاش نعاونك؟",
    tellMeWhatToBuild: "قولي واش تحب نديرلك وأنا نخدمهولك",
    buildTodoApp: "دير تطبيق مهام",
    createLandingPage: "دير صفحة ويب",
    makeDashboard: "دير داشبورد",
    whatToBuild: "واش تحب نديرلك؟",
    continueConvo: "كمّل الهضرة...",
    askAnything: "سقسيني على أي حاجة ولا قولي واش تحب نبنيلك...",
    building: "راني نخدم على التطبيق...",
    aiDisclaimer: "Vipe يخدم بالذكاء الاصطناعي. راجع المعلومات المهمة.",
    you: "أنت",
    copy: "نسخ",
    good: "مليح",
    bad: "مشي مليح",
    regenerate: "عاود",
    preview: "شوف",
    code: "الكود",
    sharedImage: "صورة",
    uploadPreview: "معاينة الصورة",
    imageTooLarge: "الصورة كبيرة بزاف، لازم تكون أقل من 10MB",
    attachImage: "زيد صورة",
    webSearch: "بحث في النت",
    
    // Tabs
    chat: "الشات",
    data: "البيانات",
    history: "التاريخ",
    publish: "انشر",
    
    // Version History
    versionHistory: "تاريخ النسخ",
    restore: "رجّع",
    restoredTo: "رجعنا للنسخة",
    
    // Data Panel
    storage: "التخزين",
    tables: "الجداول",
    noData: "ما كاين والو",
    
    // Preview
    desktop: "كومبيوتر",
    tablet: "تابلات",
    mobile: "تيليفون",
    openInNewTab: "افتح في تاب جديد",
    
    // Misc
    loading: "صبر شوية...",
    error: "كاين مشكل",
    tryAgain: "عاود حاول",
    cancel: "الغي",
    save: "سجل",
    close: "سكّر",
    done: "خلصنا! التطبيق جاهز 🚀",
    oops: "أوه كاين مشكل! عاود حاول 😅",
    buildStopped: "وقفنا البناء",
    
    // Builder Page
    builder: "البناء",
    generateNewApp: "ولّد تطبيق جديد",
    createAndManage: "دير وتحكم في تطبيقاتك بالذكاء الاصطناعي",
    noAppsYet: "ما كاين حتى تطبيق",
    generateFirst: "ولّد أول تطبيق تاعك",
    generateFirstApp: "ولّد أول تطبيق",
    createWithAI: "ابني بالذكاء الاصطناعي",
    published: "منشور",
    
    // Generation Page
    enterUrl: "دخّل URL ولا وصف واش تحب تبني...",
    pasteUrl: "حط URL، وصف التطبيق، ولا زيد سكرينشوت",
    creatingEnvironment: "راني ندير البيئة...",
    analyzingUrl: "راني نحلل الموقع...",
    generatingCode: "راني نكتب الكود...",
    applyingChanges: "راني نطبق التغييرات...",
    
    // Mobile tabs
    chatTab: "الشات",
    previewTab: "المعاينة",
    
    // Video
    skip: "تخطى",
    
    // Profile
    profile: "البروفايل",
    editProfile: "عدّل البروفايل",
    myApps: "تطبيقاتي",
    posts: "المنشورات",
    followers: "المتابعين",
    following: "نتابع",
    joined: "انضم في",
    publishedProjects: "المشاريع المنشورة",
    noPublishedProjects: "ما كاين حتى مشروع منشور",
    
    // Social
    like: "عجبني",
    comment: "تعليق",
    share: "شارك",
    postApp: "انشر التطبيق",
    
    // Navigation
    home: "الرئيسية",
    explore: "استكشف",
    notifications: "الإشعارات",
    messages: "الرسائل",
    settings: "الإعدادات",
    help: "المساعدة",
    about: "حول",
    
    // Tasks
    tasks: "المهام",
    pending: "في الانتظار",
    inProgress: "قيد التنفيذ",
    completed: "مكتمل",
    
    // File Actions
    reading: "راني نقرأ",
    editing: "راني نعدّل",
    edited: "تم التعديل",
    creating: "راني ندير",
    created: "تم الإنشاء",
    
    // AI Status
    thinking: "راني نفكر...",
    thoughtFor: "فكرت لمدة",
    seconds: "ثواني",
    processing: "راني نخدم...",
    analyzing: "راني نحلل...",
    
    // Forms
    username: "اسم المستخدم",
    displayName: "الإسم الظاهر",
    bio: "السيرة",
    avatar: "الصورة الشخصية",
    update: "حدّث",
    submit: "أرسل",
    confirm: "أكّد",
    
    // Errors
    errorOccurred: "كاين مشكل",
    notFound: "ما لقيناهش",
    unauthorized: "ما عندكش الصلاحية",
    forbidden: "ممنوع",
    serverError: "مشكل في السيرفر",
    networkError: "مشكل في الاتصال",
    
    // Success
    success: "نجاح",
    saved: "تم الحفظ",
    updated: "تم التحديث",
    deleted: "تم المسح",
    copied: "تم النسخ",
    
    // Time
    justNow: "دابا",
    minutesAgo: "دقائق من قبل",
    hoursAgo: "ساعات من قبل",
    daysAgo: "أيام من قبل",
    
    // Actions
    edit: "عدّل",
    view: "شوف",
    download: "حمّل",
    upload: "رفع",
    refresh: "حدّث",
    search: "ابحث",
    filter: "فلتر",
    sort: "رتّب",
    
    // Pricing
    pricing: "الأسعار",
    free: "مجاني",
    pro: "برو",
    enterprise: "مؤسسات",
    subscribe: "اشترك",
    upgrade: "ترقية",
    
    // Privacy & Terms
    privacy: "الخصوصية",
    terms: "الشروط",
    refund: "استرجاع",
    
    // Misc Extended
    welcome: "مرحبا",
    getStarted: "ابدأ",
    learnMore: "تعلم أكثر",
    seeMore: "شوف أكثر",
    showLess: "شوف أقل",
    hideDetails: "خبّي",
    showDetails: "بيّن",
    noResults: "ما كاين نتائج",
    empty: "فارغ",
    
    // Connection
    connected: "متصل",
    disconnected: "منفصل",
    connecting: "راني نتصل...",
    connectDB: "اتصل بالقاعدة",
    
    // Sandbox
    sandbox: "ساندبوكس",
    sandboxReady: "الساندبوكس جاهز",
    sandboxExpired: "انتهت صلاحية الساندبوكس",
    creatingSandbox: "راني ندير ساندبوكس...",
    
    // Post Components
    shareWhatBuilding: "شارك واش راك تبني...",
    showcaseApp: "عرض التطبيق",
    post: "انشر",
    addContentOrMedia: "زيد شي حاجة ولا صورة",
    failedUploadMedia: "ما قدرناش نرفعو الميديا",
    failedCreatePost: "ما قدرناش ننشرو",
    postCreated: "تم النشر!",
    selectProjectToShowcase: "اختار مشروع للعرض",
    selectImageOrVideo: "اختار صورة ولا فيديو",
    alreadyShared: "سبق لك شاركتي هذا البوست",
    postShared: "تم المشاركة!",
    postDeleted: "تم المسح",
    writeComment: "كتب تعليق...",
    appShowcase: "عرض التطبيق",
    remix: "ريميكس",
    
    // Builder Page Extended
    createManageApps: "دير وتحكم في تطبيقاتك بالذكاء الاصطناعي",
    noProjectsYet: "ما كاين حتى مشروع",
    generateFirstToStart: "ولّد أول تطبيق تاعك باش تبدأ",
    
    // Visual Editor
    visualEdit: "تعديل مرئي",
    selectElement: "اختار عنصر للتعديل",
    applyChanges: "طبق التغييرات",
    cancelEdit: "الغي التعديل",
    
    // AI Tools
    imageGeneration: "توليد الصور",
    webSearchTool: "بحث في الويب",
    documentParsing: "قراءة المستندات",
    codeExecution: "تنفيذ الكود",
  },
};

type TranslationKey = keyof typeof translations.en;

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  isRTL: boolean;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem("vipe-language");
    return (saved as Language) || "en";
  });

  useEffect(() => {
    localStorage.setItem("vipe-language", language);
    document.documentElement.dir = language === "dz" ? "rtl" : "ltr";
    document.documentElement.lang = language === "dz" ? "ar-DZ" : "en";
  }, [language]);

  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations.en[key] || key;
  };

  const isRTL = language === "dz";

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}

// Language toggle component
export function LanguageToggle({ className }: { className?: string }) {
  const { language, setLanguage } = useI18n();
  
  return (
    <button
      onClick={() => setLanguage(language === "en" ? "dz" : "en")}
      className={`px-3 py-1.5 text-sm font-medium rounded-lg bg-secondary hover:bg-secondary/80 transition-colors ${className || ""}`}
    >
      {language === "en" ? "🇩🇿 DZ" : "🇬🇧 EN"}
    </button>
  );
}
