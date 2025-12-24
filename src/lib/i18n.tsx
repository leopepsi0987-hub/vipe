import { createContext, useContext, useState, useEffect, ReactNode, forwardRef } from "react";

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
    projects: "Projects",
    noProjects: "No projects yet",
    newProject: "New Project",
    rename: "Rename",
    delete: "Delete",
    signOut: "Sign Out",
    
    // Dashboard
    selectProject: "Select a project",
    selectProjectDesc: "Choose a project from the sidebar or create a new one",
    projectCreated: "Project created!",
    projectDeleted: "Project deleted",
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
    projects: "البروجيات",
    noProjects: "ما كاين حتى بروجي",
    newProject: "بروجي جديد",
    rename: "بدّل الإسم",
    delete: "امسح",
    signOut: "اخرج",
    
    // Dashboard
    selectProject: "اختار بروجي",
    selectProjectDesc: "اختار بروجي من الجنب ولا دير واحد جديد",
    projectCreated: "تم إنشاء البروجي!",
    projectDeleted: "تم مسح البروجي",
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

export const I18nProvider = forwardRef<HTMLDivElement, { children: ReactNode }>(
  function I18nProvider({ children }, ref) {
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
        <div ref={ref}>{children}</div>
      </I18nContext.Provider>
    );
  }
);

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
