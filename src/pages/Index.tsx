import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { AuthPage } from "@/components/AuthPage";
import { ProfileSetup } from "@/components/ProfileSetup";
import { VideoIntro } from "@/components/VideoIntro";
import { Loader2 } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const [showIntro, setShowIntro] = useState(true);
  const [introComplete, setIntroComplete] = useState(false);

  useEffect(() => {
    const hasSeenIntro = sessionStorage.getItem("hasSeenIntro");
    if (hasSeenIntro) {
      setShowIntro(false);
      setIntroComplete(true);
    }
  }, []);

  useEffect(() => {
    // Redirect to builder if user has profile
    if (user && profile && !authLoading && !profileLoading) {
      navigate("/builder");
    }
  }, [user, profile, authLoading, profileLoading, navigate]);

  const handleIntroComplete = () => {
    sessionStorage.setItem("hasSeenIntro", "true");
    setShowIntro(false);
    setIntroComplete(true);
  };

  if (showIntro && !introComplete) {
    return <VideoIntro onComplete={handleIntroComplete} />;
  }

  if (authLoading || (user && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  // User exists but no profile - show setup
  if (!profile) {
    return <ProfileSetup onComplete={() => navigate("/builder")} />;
  }

  return null;
};

export default Index;
