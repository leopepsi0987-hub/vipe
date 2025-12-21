import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Zap, ArrowRight, Loader2 } from "lucide-react";
import { useI18n, LanguageToggle } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { t, isRTL } = useI18n();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error(t("fillFields"));
      return;
    }

    if (password.length < 6) {
      toast.error(t("passwordMinLength"));
      return;
    }

    setLoading(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(t("welcomeBackToast"));
      }
    } else {
      const { error } = await signUp(email, password);
      if (error) {
        if (error.message.includes("already registered")) {
          toast.error(t("emailRegistered"));
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success(t("accountCreated"));
      }
    }

    setLoading(false);
  };

  return (
    <div className={cn(
      "min-h-screen flex items-center justify-center bg-background p-4",
      isRTL && "font-arabic"
    )} dir={isRTL ? "rtl" : "ltr"}>
      {/* Language Toggle - Fixed Position */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageToggle />
      </div>

      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Zap className="w-7 h-7 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gradient">Vipe</h1>
          <p className="text-muted-foreground mt-2">
            {t("aiPlatform")}
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-xl backdrop-blur-sm">
          <h2 className="text-2xl font-semibold text-foreground mb-6">
            {isLogin ? t("welcomeBack") : t("createAccount")}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground"
                dir="ltr"
              />
            </div>

            <Button
              type="submit"
              variant="glow"
              className="w-full mt-2"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {isLogin ? t("signIn") : t("signUp")}
                  <ArrowRight className={cn("w-4 h-4", isRTL ? "mr-2 rotate-180" : "ml-2")} />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-muted-foreground hover:text-primary transition-colors text-sm"
            >
              {isLogin ? t("noAccount") : t("hasAccount")}
            </button>
          </div>
        </div>

        <p className="text-center text-muted-foreground text-sm mt-6">
          {t("buildWithAI")}
        </p>
      </div>
    </div>
  );
}
