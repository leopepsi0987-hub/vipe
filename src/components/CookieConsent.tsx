import { useState, useEffect, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Cookie, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

const COOKIE_CONSENT_KEY = "vipedz_cookie_consent";

export const CookieConsent = forwardRef<HTMLDivElement>(function CookieConsent(_, ref) {
  const [show, setShow] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Delay showing the popup for better UX
      const timer = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setShow(false);
  };

  const handleDecline = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "declined");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div ref={ref} className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-slide-up">
      <div className="max-w-4xl mx-auto">
        <div className="bg-card/95 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-2xl">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Cookie className="w-6 h-6 text-primary" />
            </div>
            
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                We Value Your Privacy 🍪
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                We use cookies and similar technologies to enhance your browsing experience, 
                analyze site traffic, and personalize content. By clicking "Accept All", you consent 
                to our use of cookies as described in our{" "}
                <button 
                  onClick={() => navigate("/privacy")}
                  className="text-primary hover:underline"
                >
                  Privacy Policy
                </button>
                . You can manage your preferences at any time.
              </p>
              
              <div className="flex flex-wrap gap-3">
                <Button 
                  onClick={handleAccept}
                  className="bg-primary hover:bg-primary/90"
                >
                  Accept All Cookies
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleDecline}
                >
                  Essential Only
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate("/privacy")}
                  className="text-muted-foreground"
                >
                  Learn More
                </Button>
              </div>
            </div>
            
            <button 
              onClick={handleDecline}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
