import { useState, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface VideoIntroProps {
  onComplete: () => void;
}

export const VideoIntro = ({ onComplete }: VideoIntroProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Set a timeout - if video doesn't load in 3 seconds, skip it
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.log("Video took too long to load, skipping...");
        setIsVisible(false);
        onComplete();
      }
    }, 3000);

    const handleCanPlay = () => {
      setIsLoading(false);
      clearTimeout(timeout);
      video.play().catch(() => {
        // Autoplay blocked: skip intro
        setIsVisible(false);
        onComplete();
      });
    };

    const handleError = () => {
      // Video failed to load, skip
      clearTimeout(timeout);
      setIsVisible(false);
      onComplete();
    };

    video.addEventListener("canplaythrough", handleCanPlay);
    video.addEventListener("error", handleError);

    // Start loading video
    video.load();

    return () => {
      clearTimeout(timeout);
      video.removeEventListener("canplaythrough", handleCanPlay);
      video.removeEventListener("error", handleError);
    };
  }, [onComplete, isLoading]);

  const handleVideoEnd = () => {
    setIsVisible(false);
    setTimeout(onComplete, 300);
  };

  const handleSkip = () => {
    setIsVisible(false);
    setTimeout(onComplete, 300);
  };

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 bg-background flex items-center justify-center transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}
      <video
        ref={videoRef}
        src="/videos/intro.mp4"
        className={`w-full h-full object-contain ${isLoading ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}
        onEnded={handleVideoEnd}
        playsInline
        muted
        preload="auto"
      />
      <button
        onClick={handleSkip}
        className="absolute bottom-8 right-8 px-6 py-2 bg-secondary/60 hover:bg-secondary/80 text-secondary-foreground rounded-lg backdrop-blur-sm transition-colors text-sm font-medium"
      >
        Skip
      </button>
    </div>
  );
};
