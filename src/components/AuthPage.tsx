import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, ArrowRight, Loader2, Zap } from "lucide-react";
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
      "min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden",
      isRTL && "font-arabic"
    )} dir={isRTL ? "rtl" : "ltr"}>
      
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Large primary orb */}
        <div 
          className="orb orb-primary w-[600px] h-[600px] -top-40 -left-40 animate-float-slow opacity-60"
          style={{ animationDelay: '0s' }}
        />
        {/* Accent orb */}
        <div 
          className="orb orb-accent w-[500px] h-[500px] top-1/3 -right-40 animate-float opacity-50"
          style={{ animationDelay: '2s' }}
        />
        {/* Secondary orb */}
        <div 
          className="orb orb-secondary w-[400px] h-[400px] -bottom-32 left-1/4 animate-float-slow opacity-40"
          style={{ animationDelay: '4s' }}
        />
        {/* Small floating orbs */}
        <div 
          className="orb orb-primary w-32 h-32 top-20 right-1/4 animate-float opacity-30"
          style={{ animationDelay: '1s' }}
        />
        <div 
          className="orb orb-accent w-24 h-24 bottom-1/4 left-20 animate-float-reverse opacity-40"
          style={{ animationDelay: '3s' }}
        />
        
        {/* Gradient mesh overlay */}
        <div className="absolute inset-0 bg-gradient-mesh opacity-80" />
        
        {/* Noise texture */}
        <div className="absolute inset-0 noise-overlay opacity-50" />
      </div>

      {/* Language Toggle */}
      <div className="absolute top-6 right-6 z-20 animate-slide-down" style={{ animationDelay: '0.3s' }}>
        <LanguageToggle />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo Section */}
        <div className="text-center mb-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="inline-flex items-center justify-center mb-6 relative">
            {/* Glow ring behind logo */}
            <div className="absolute inset-0 w-20 h-20 rounded-2xl bg-gradient-primary blur-xl opacity-60 animate-pulse-glow" />
            
            {/* Logo container */}
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow hover-scale cursor-pointer group overflow-hidden">
              {/* Shimmer effect */}
              <div className="absolute inset-0 animate-shimmer opacity-30" />
              <Zap className="w-10 h-10 text-background relative z-10 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          
          <h1 className="text-5xl font-bold text-gradient glow-text mb-3">
            Vipe
          </h1>
          <p className="text-muted-foreground text-lg">
            {t("aiPlatform")}
          </p>
        </div>

        {/* Auth Card with Glass Effect */}
        <div 
          className="glass-strong rounded-3xl p-8 shadow-float animate-scale-pop relative overflow-hidden"
          style={{ animationDelay: '0.2s' }}
        >
          {/* Card shimmer border */}
          <div className="absolute inset-0 rounded-3xl gradient-border opacity-50" />
          
          {/* Floating sparkles */}
          <Sparkles className="absolute top-4 right-4 w-5 h-5 text-primary/40 animate-pulse-glow" />
          
          <h2 className="text-2xl font-semibold text-foreground mb-8 relative">
            {isLogin ? t("welcomeBack") : t("createAccount")}
            <span className="absolute -bottom-2 left-0 w-12 h-1 bg-gradient-primary rounded-full" />
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2 animate-slide-up opacity-0" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
              <Label htmlFor="email" className="text-foreground font-medium">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 bg-secondary/50 border-border/50 text-foreground placeholder:text-muted-foreground rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                dir="ltr"
              />
            </div>

            <div className="space-y-2 animate-slide-up opacity-0" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
              <Label htmlFor="password" className="text-foreground font-medium">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 bg-secondary/50 border-border/50 text-foreground placeholder:text-muted-foreground rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                dir="ltr"
              />
            </div>

            <div className="animate-slide-up opacity-0" style={{ animationDelay: '0.5s', animationFillMode: 'forwards' }}>
              <Button
                type="submit"
                className="w-full h-12 rounded-xl bg-gradient-primary text-background font-semibold text-base hover:opacity-90 transition-all shadow-glow hover:shadow-glow-accent hover-lift group relative overflow-hidden"
                disabled={loading}
              >
                {/* Button shimmer */}
                <div className="absolute inset-0 animate-shimmer opacity-20" />
                
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span className="flex items-center justify-center gap-2 relative z-10">
                    {isLogin ? t("signIn") : t("signUp")}
                    <ArrowRight className={cn(
                      "w-5 h-5 group-hover:translate-x-1 transition-transform",
                      isRTL && "rotate-180 group-hover:-translate-x-1"
                    )} />
                  </span>
                )}
              </Button>
            </div>
          </form>

          <div className="mt-8 text-center animate-slide-up opacity-0" style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}>
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-muted-foreground hover:text-primary transition-colors text-sm relative group"
            >
              {isLogin ? t("noAccount") : t("hasAccount")}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full" />
            </button>
          </div>
        </div>

        {/* Bottom tagline */}
        <div 
          className="text-center mt-8 animate-slide-up opacity-0" 
          style={{ animationDelay: '0.7s', animationFillMode: 'forwards' }}
        >
          <p className="text-muted-foreground text-sm flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-primary animate-pulse-glow" />
            {t("buildWithAI")}
            <Sparkles className="w-4 h-4 text-accent animate-pulse-glow" style={{ animationDelay: '0.5s' }} />
          </p>
        </div>
      </div>
    </div>
  );
}