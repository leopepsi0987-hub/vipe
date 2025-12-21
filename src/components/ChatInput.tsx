import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp, Loader2, Paperclip, X, Globe, StopCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string, imageUrl?: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  placeholder?: string;
  placeholderAr?: string;
  currentPath?: string;
  onVisualEdit?: () => void;
  isArabic?: boolean;
}

export function ChatInput({ 
  onSend, 
  onStop,
  disabled, 
  placeholder, 
  placeholderAr,
  currentPath = "/", 
  onVisualEdit,
  isArabic = false
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [message]);

  const handleSubmit = () => {
    if ((message.trim() || imagePreview) && !disabled) {
      onSend(message.trim(), imagePreview || undefined);
      setMessage("");
      setImagePreview(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert(isArabic ? "يجب أن تكون الصورة أقل من 10 ميجابايت" : "Image must be less than 10MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const defaultPlaceholder = isArabic 
    ? (placeholderAr || "اسأل أي شيء أو صف التطبيق الذي تريد بناءه...")
    : (placeholder || "Ask anything or describe the app you want to build...");

  return (
    <div className="w-full max-w-3xl mx-auto px-4" dir={isArabic ? "rtl" : "ltr"}>
      {/* Image Preview */}
      {imagePreview && (
        <div className="relative inline-block mb-3">
          <img 
            src={imagePreview} 
            alt={isArabic ? "معاينة الصورة" : "Upload preview"}
            className="h-24 w-auto rounded-xl border border-border shadow-sm"
          />
          <button
            onClick={removeImage}
            className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/80 transition-colors shadow-md"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      
      {/* ChatGPT-style Input Container */}
      <div 
        className={cn(
          "relative flex flex-col bg-secondary border border-border rounded-2xl transition-all duration-200",
          isFocused && "border-primary/50 shadow-lg shadow-primary/5"
        )}
      >
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={defaultPlaceholder}
          disabled={disabled}
          rows={1}
          className={cn(
            "w-full resize-none bg-transparent px-4 py-4 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none min-h-[56px] max-h-[200px]",
            isArabic && "text-right font-arabic"
          )}
          dir={isArabic ? "rtl" : "ltr"}
        />

        {/* Bottom Actions Bar */}
        <div className={cn(
          "flex items-center justify-between px-3 pb-3",
          isArabic && "flex-row-reverse"
        )}>
          {/* Left Actions */}
          <div className={cn(
            "flex items-center gap-1",
            isArabic && "flex-row-reverse"
          )}>
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            
            {/* Attach button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
              title={isArabic ? "إرفاق صورة" : "Attach image"}
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* Web search indicator */}
            <button
              type="button"
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title={isArabic ? "بحث الويب" : "Web search"}
            >
              <Globe className="w-5 h-5" />
            </button>
          </div>

          {/* Send/Stop Button */}
          {disabled ? (
            <Button
              onClick={onStop}
              size="icon"
              className="w-9 h-9 rounded-xl bg-destructive hover:bg-destructive/90"
            >
              <StopCircle className="w-5 h-5" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!message.trim() && !imagePreview}
              size="icon"
              className={cn(
                "w-9 h-9 rounded-xl transition-all",
                message.trim() || imagePreview
                  ? "bg-foreground text-background hover:bg-foreground/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              <ArrowUp className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Footer Text */}
      <p className={cn(
        "text-xs text-muted-foreground text-center mt-3",
        isArabic && "font-arabic"
      )}>
        {isArabic 
          ? "Vipe يستخدم الذكاء الاصطناعي. تحقق من المعلومات المهمة."
          : "Vipe uses AI. Check important info."
        }
      </p>
    </div>
  );
}
