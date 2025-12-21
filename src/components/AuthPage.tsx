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
      "min-h-screen flex items-center justify-center p-4 relative overflow-hidden",
      isRTL && "font-arabic"
    )} dir={isRTL ? "rtl" : "ltr"} style={{ background: 'hsl(260 30% 4%)' }}>
      
      {/* Animated orbs background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Large purple orb - top left */}
        <div 
          className="orb orb-purple w-[700px] h-[700px] -top-48 -left-48 animate-float-slow opacity-80"
          style={{ animationDelay: '0s' }}
        />
        {/* Gold orb - top right */}
        <div 
          className="orb orb-gold w-[500px] h-[500px] -top-20 -right-32 animate-float opacity-70"
          style={{ animationDelay: '2s' }}
        />
        {/* Pink orb - bottom */}
        <div 
          className="orb orb-pink w-[600px] h-[600px] -bottom-48 left-1/4 animate-float-slow opacity-60"
          style={{ animationDelay: '1s' }}
        />
        {/* Small purple orb */}
        <div 
          className="orb orb-purple w-48 h-48 top-1/4 right-1/3 animate-float opacity-50"
          style={{ animationDelay: '3s' }}
        />
        {/* Small gold orb */}
        <div 
          className="orb orb-gold w-32 h-32 bottom-1/3 left-20 animate-float opacity-60"
          style={{ animationDelay: '4s' }}
        />
      </div>

      {/* Language Toggle */}
      <div className="absolute top-6 right-6 z-30 animate-slide-down opacity-0" style={{ animationDelay: '0.5s', animationFillMode: 'forwards' }}>
        <div className="glass-button rounded-xl px-3 py-2 hover-scale cursor-pointer">
          <LanguageToggle />
        </div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo Section */}
        <div className="text-center mb-12 animate-slide-up opacity-0" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
          <div className="inline-flex items-center justify-center mb-6 relative">
            {/* Glow behind logo */}
            <div className="absolute w-28 h-28 bg-gradient-primary rounded-3xl blur-3xl opacity-50 animate-pulse-glow" />
            
            {/* Logo */}
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow hover-scale cursor-pointer overflow-hidden animate-energy-pulse">
              {/* Shimmer */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
              <Zap className="w-10 h-10 text-white relative z-10 drop-shadow-lg" />
            </div>
          </div>
          
          <h1 className="text-6xl font-bold text-gradient glow-text mb-4 tracking-tight">
            Vipe
          </h1>
          <p className="text-muted-foreground text-lg font-light">
            {t("aiPlatform")}
          </p>
        </div>

        {/* Glass Auth Card */}
        <div 
          className="glass-card rounded-3xl p-8 relative overflow-hidden animate-scale-in opacity-0"
          style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}
        >
          {/* Inner glow effect */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-60 h-40 bg-gradient-to-b from-primary/20 to-transparent blur-3xl pointer-events-none" />
          
          {/* Gold accent glow */}
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-accent/20 rounded-full blur-3xl pointer-events-none" />
          
          {/* Sparkle decoration */}
          <Sparkles className="absolute top-6 right-6 w-5 h-5 text-accent/60 animate-pulse-glow" />
          
          <h2 className="text-2xl font-semibold text-foreground mb-2 relative">
            {isLogin ? t("welcomeBack") : t("createAccount")}
          </h2>
          <div className="w-16 h-1 bg-gradient-primary rounded-full mb-8" />

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2 animate-slide-up opacity-0" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
              <Label htmlFor="email" className="text-foreground/80 font-medium text-sm">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 glass-input rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                dir="ltr"
              />
            </div>

            <div className="space-y-2 animate-slide-up opacity-0" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
              <Label htmlFor="password" className="text-foreground/80 font-medium text-sm">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 glass-input rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                dir="ltr"
              />
            </div>

            <div className="pt-2 animate-slide-up opacity-0" style={{ animationDelay: '0.5s', animationFillMode: 'forwards' }}>
              <Button
                type="submit"
                className="w-full h-12 rounded-xl bg-gradient-primary text-white font-semibold text-base hover:opacity-90 transition-all shadow-glow hover:shadow-glow-gold hover-lift group relative overflow-hidden"
                disabled={loading}
              >
                {/* Shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                
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
              className="text-muted-foreground hover:text-primary transition-all text-sm relative group"
            >
              {isLogin ? t("noAccount") : t("hasAccount")}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-primary transition-all group-hover:w-full rounded-full" />
            </button>
          </div>
        </div>

        {/* Bottom tagline */}
        <div 
          className="text-center mt-10 animate-slide-up opacity-0" 
          style={{ animationDelay: '0.7s', animationFillMode: 'forwards' }}
        >
          <p className="text-muted-foreground/70 text-sm flex items-center justify-center gap-3 font-light">
            <Sparkles className="w-4 h-4 text-primary animate-pulse-glow" />
            <span>{t("buildWithAI")}</span>
            <Sparkles className="w-4 h-4 text-accent animate-pulse-glow" style={{ animationDelay: '1s' }} />
          </p>
        </div>
      </div>
    </div>
  );
}