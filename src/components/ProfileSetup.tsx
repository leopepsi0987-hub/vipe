import { useState, useRef } from "react";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Camera, User, AtSign, Check, X, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface ProfileSetupProps {
  onComplete: () => void;
}

export function ProfileSetup({ onComplete }: ProfileSetupProps) {
  const { createProfile, checkUsernameAvailable, uploadAvatar } = useProfile();
  const { t, isRTL } = useI18n();
  
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const usernameTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleUsernameChange = (value: string) => {
    // Only allow alphanumeric and underscores
    const sanitized = value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setUsername(sanitized);
    setUsernameAvailable(null);

    if (usernameTimeoutRef.current) {
      clearTimeout(usernameTimeoutRef.current);
    }

    if (sanitized.length >= 3) {
      setCheckingUsername(true);
      usernameTimeoutRef.current = setTimeout(async () => {
        const available = await checkUsernameAvailable(sanitized);
        setUsernameAvailable(available);
        setCheckingUsername(false);
      }, 500);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be less than 5MB");
        return;
      }
      
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!displayName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    if (username.length < 3) {
      toast.error("Username must be at least 3 characters");
      return;
    }

    if (usernameAvailable === false) {
      toast.error("Username is already taken");
      return;
    }

    setLoading(true);

    let avatarUrl: string | undefined;

    if (avatarFile) {
      const { url, error } = await uploadAvatar(avatarFile);
      if (error) {
        toast.error("Failed to upload avatar");
        setLoading(false);
        return;
      }
      avatarUrl = url;
    }

    const { error } = await createProfile(displayName.trim(), username, avatarUrl);

    if (error) {
      if (error.message.includes("duplicate key") || error.message.includes("unique")) {
        toast.error("Username is already taken");
      } else {
        toast.error(error.message);
      }
      setLoading(false);
      return;
    }

    toast.success("Profile created!");
    onComplete();
  };

  return (
    <div className={cn(
      "min-h-screen flex items-center justify-center p-4 relative overflow-hidden",
      isRTL && "font-arabic"
    )} dir={isRTL ? "rtl" : "ltr"} style={{ background: 'hsl(260 30% 4%)' }}>
      
      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="orb orb-purple w-[500px] h-[500px] -top-32 -left-32 animate-float-slow opacity-40" />
        <div className="orb orb-gold w-[400px] h-[400px] -bottom-20 -right-20 animate-float opacity-30" />
        <div className="orb orb-pink w-[300px] h-[300px] top-1/2 left-1/4 animate-float opacity-20" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-6 relative animate-scale-in">
            <div className="absolute w-20 h-20 bg-gradient-primary rounded-2xl blur-2xl opacity-50 animate-pulse-glow" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Zap className="w-8 h-8 text-white" />
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-foreground mb-2 animate-slide-up">
            Complete Your Profile
          </h1>
          <p className="text-muted-foreground animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Tell us a bit about yourself
          </p>
        </div>

        {/* Form Card */}
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden animate-scale-in" style={{ animationDelay: '0.2s' }}>
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-60 h-40 bg-gradient-to-b from-primary/20 to-transparent blur-3xl pointer-events-none" />
          <Sparkles className="absolute top-4 right-4 w-5 h-5 text-accent/60 animate-heartbeat" />

          <form onSubmit={handleSubmit} className="space-y-6 relative">
            {/* Avatar Upload */}
            <div className="flex justify-center">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-24 h-24 rounded-full bg-muted/30 border-2 border-dashed border-border hover:border-primary/50 transition-colors flex items-center justify-center overflow-hidden group"
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-muted-foreground group-hover:text-primary transition-colors" />
                  )}
                </button>
                
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-glow cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <Camera className="w-4 h-4 text-white" />
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
            </div>

            {/* Display Name */}
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-foreground/80 font-medium flex items-center gap-2">
                <User className="w-4 h-4" />
                Display Name
              </Label>
              <Input
                id="displayName"
                type="text"
                placeholder="John Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-12 glass-input rounded-xl"
                maxLength={50}
              />
            </div>

            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-foreground/80 font-medium flex items-center gap-2">
                <AtSign className="w-4 h-4" />
                Username
              </Label>
              <div className="relative">
                <Input
                  id="username"
                  type="text"
                  placeholder="johndoe"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  className="h-12 glass-input rounded-xl pr-10"
                  maxLength={30}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {checkingUsername && (
                    <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                  )}
                  {!checkingUsername && usernameAvailable === true && (
                    <Check className="w-5 h-5 text-green-500" />
                  )}
                  {!checkingUsername && usernameAvailable === false && (
                    <X className="w-5 h-5 text-red-500" />
                  )}
                </div>
              </div>
              {username.length > 0 && username.length < 3 && (
                <p className="text-xs text-muted-foreground">At least 3 characters</p>
              )}
              {!checkingUsername && usernameAvailable === false && (
                <p className="text-xs text-red-400">Username is already taken</p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-12 rounded-xl bg-gradient-primary text-white font-bold hover:opacity-90 transition-all shadow-glow"
              disabled={loading || username.length < 3 || usernameAvailable === false}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Complete Setup"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
