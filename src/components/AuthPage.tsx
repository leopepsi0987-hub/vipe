import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, ArrowRight, Loader2, Zap, Star } from "lucide-react";
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
      
      {/* Video Background */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="video-bg"
        poster="https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=1920&q=80"
      >
        <source 
          src="https://cdn.pixabay.com/video/2020/05/25/40130-424930032_large.mp4" 
          type="video/mp4" 
        />
      </video>
      
      {/* Video overlay */}
      <div className="video-overlay" />
      
      {/* Animated orbs on top */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-[1]">
        {/* Purple orb - morphing */}
        <div 
          className="orb orb-purple w-[500px] h-[500px] -top-32 -left-32 animate-morph animate-float-slow opacity-60"
          style={{ animationDelay: '0s' }}
        />
        {/* Gold orb */}
        <div 
          className="orb orb-gold w-[400px] h-[400px] -top-20 -right-20 animate-float opacity-50 md:w-[500px] md:h-[500px]"
          style={{ animationDelay: '2s' }}
        />
        {/* Pink orb */}
        <div 
          className="orb orb-pink w-[400px] h-[400px] -bottom-32 left-1/4 animate-morph opacity-40"
          style={{ animationDelay: '1s' }}
        />
        {/* Small floating orbs */}
        <div 
          className="orb orb-purple w-24 h-24 top-1/4 right-1/4 animate-float animate-color-shift opacity-40 hidden md:block"
          style={{ animationDelay: '3s' }}
        />
        <div 
          className="orb orb-gold w-16 h-16 bottom-1/3 left-16 animate-bounce-soft opacity-50 hidden md:block"
          style={{ animationDelay: '4s' }}
        />
        <div 
          className="orb orb-cyan w-20 h-20 top-1/3 left-1/4 animate-float opacity-30 hidden lg:block"
          style={{ animationDelay: '5s' }}
        />
      </div>

      {/* Floating sparkles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-[2]">
        <Star className="absolute top-20 left-[20%] w-3 h-3 text-accent/40 animate-ping-slow hidden md:block" style={{ animationDelay: '0s' }} />
        <Star className="absolute top-40 right-[30%] w-2 h-2 text-primary/40 animate-ping-slow hidden md:block" style={{ animationDelay: '0.5s' }} />
        <Star className="absolute bottom-32 left-[40%] w-2 h-2 text-accent/30 animate-ping-slow hidden md:block" style={{ animationDelay: '1s' }} />
        <Star className="absolute top-[60%] right-[20%] w-3 h-3 text-primary/30 animate-ping-slow hidden lg:block" style={{ animationDelay: '1.5s' }} />
      </div>

      {/* Language Toggle */}
      <div className="absolute top-4 right-4 md:top-6 md:right-6 z-30 animate-slide-down opacity-0" style={{ animationDelay: '0.5s', animationFillMode: 'forwards' }}>
        <div className="glass-button rounded-xl px-3 py-2 hover-scale cursor-pointer hover-glow transition-all">
          <LanguageToggle />
        </div>
      </div>

      <div className="w-full max-w-md relative z-10 px-4 md:px-0">
        {/* Logo Section */}
        <div className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center justify-center mb-4 md:mb-6 relative animate-scale-in opacity-0" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
            {/* Glow behind logo */}
            <div className="absolute w-24 h-24 md:w-32 md:h-32 bg-gradient-primary rounded-3xl blur-3xl opacity-50 animate-pulse-glow" />
            
            {/* Ripple effect */}
            <div className="absolute w-20 h-20 md:w-24 md:h-24 rounded-2xl border-2 border-primary/30 animate-ripple" />
            <div className="absolute w-20 h-20 md:w-24 md:h-24 rounded-2xl border-2 border-accent/20 animate-ripple" style={{ animationDelay: '0.5s' }} />
            
            {/* Logo */}
            <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow hover-scale cursor-pointer overflow-hidden animate-energy-pulse group">
              {/* Shimmer */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
              <Zap className="w-8 h-8 md:w-10 md:h-10 text-white relative z-10 drop-shadow-lg group-hover:animate-wiggle" />
            </div>
          </div>
          
          {/* Title with glitch effect on hover */}
          <h1 
            className="text-5xl md:text-7xl font-extrabold text-gradient glow-text-neon mb-2 tracking-tight animate-slide-up opacity-0 hover:animate-glitch cursor-default"
            style={{ animationDelay: '0.15s', animationFillMode: 'forwards' }}
          >
            Vipe DZ
          </h1>
          
          {/* Subtitle with typewriter feel */}
          <p className="text-muted-foreground text-base md:text-lg font-light animate-slide-up opacity-0" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
            {t("aiPlatform")}
          </p>
          
          {/* Animated underline */}
          <div className="flex justify-center mt-3 gap-1 animate-slide-up opacity-0" style={{ animationDelay: '0.25s', animationFillMode: 'forwards' }}>
            <div className="w-8 h-1 bg-primary rounded-full animate-pulse-glow" />
            <div className="w-4 h-1 bg-accent rounded-full animate-pulse-glow" style={{ animationDelay: '0.2s' }} />
            <div className="w-2 h-1 bg-primary/50 rounded-full animate-pulse-glow" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>

        {/* Glass Auth Card */}
        <div 
          className="glass-card rounded-2xl md:rounded-3xl p-6 md:p-8 relative overflow-hidden animate-scale-in opacity-0"
          style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}
        >
          {/* Inner glow effect */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-60 h-40 bg-gradient-to-b from-primary/20 to-transparent blur-3xl pointer-events-none animate-pulse-glow" />
          
          {/* Gold accent glow */}
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-accent/20 rounded-full blur-3xl pointer-events-none animate-float" />
          
          {/* Sparkle decorations */}
          <Sparkles className="absolute top-4 right-4 md:top-6 md:right-6 w-4 h-4 md:w-5 md:h-5 text-accent/60 animate-heartbeat" />
          <Star className="absolute top-6 right-12 md:top-8 md:right-16 w-2 h-2 md:w-3 md:h-3 text-primary/40 animate-ping-slow" style={{ animationDelay: '1s' }} />
          
          <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2 relative animate-text-reveal">
            {isLogin ? t("welcomeBack") : t("createAccount")}
          </h2>
          <div className="w-16 h-1 bg-gradient-primary rounded-full mb-6 md:mb-8 animate-slide-up opacity-0" style={{ animationDelay: '0.35s', animationFillMode: 'forwards' }} />

          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
            <div className="space-y-2 animate-slide-up opacity-0" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
              <Label htmlFor="email" className="text-foreground/80 font-medium text-sm">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 md:h-12 glass-input rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all focus:animate-pulse text-base"
                dir="ltr"
              />
            </div>

            <div className="space-y-2 animate-slide-up opacity-0" style={{ animationDelay: '0.45s', animationFillMode: 'forwards' }}>
              <Label htmlFor="password" className="text-foreground/80 font-medium text-sm">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 md:h-12 glass-input rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base"
                dir="ltr"
              />
            </div>

            <div className="pt-2 animate-slide-up opacity-0" style={{ animationDelay: '0.5s', animationFillMode: 'forwards' }}>
              <Button
                type="submit"
                className="w-full h-11 md:h-12 rounded-xl bg-gradient-primary text-white font-bold text-base hover:opacity-90 transition-all shadow-glow hover:shadow-glow-gold hover-lift group relative overflow-hidden"
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
                      "w-5 h-5 group-hover:translate-x-1 transition-transform group-hover:animate-bounce-soft",
                      isRTL && "rotate-180 group-hover:-translate-x-1"
                    )} />
                  </span>
                )}
              </Button>
            </div>
          </form>

          <div className="mt-6 md:mt-8 text-center animate-slide-up opacity-0" style={{ animationDelay: '0.55s', animationFillMode: 'forwards' }}>
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
          className="text-center mt-6 md:mt-10 animate-slide-up opacity-0" 
          style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}
        >
          <p className="text-muted-foreground/70 text-sm flex items-center justify-center gap-2 md:gap-3 font-light flex-wrap">
            <Sparkles className="w-4 h-4 text-primary animate-spin-slow" />
            <span className="animate-color-shift">{t("buildWithAI")}</span>
            <Sparkles className="w-4 h-4 text-accent animate-spin-slow" style={{ animationDirection: 'reverse' }} />
          </p>
          
          {/* Animated dots */}
          <div className="flex justify-center gap-1 mt-4">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce-soft" />
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce-soft" style={{ animationDelay: '0.1s' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce-soft" style={{ animationDelay: '0.2s' }} />
          </div>
        </div>
      </div>
    </div>
  );
}