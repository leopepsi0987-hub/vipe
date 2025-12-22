import { useState, useRef, useEffect } from "react";

interface VideoIntroProps {
  onComplete: () => void;
}

export const VideoIntro = ({ onComplete }: VideoIntroProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.play().catch(() => {
      // Autoplay blocked: hide intro immediately and continue
      setIsVisible(false);
      onComplete();
    });
  }, [onComplete]);

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
      <video
        ref={videoRef}
        src="/videos/intro.mp4"
        className="w-full h-full object-contain"
        onEnded={handleVideoEnd}
        playsInline
        muted
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
