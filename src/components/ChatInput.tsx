import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Image, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string, imageUrl?: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
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
        alert("Image must be less than 10MB");
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

  return (
    <div className="space-y-2">
      {/* Image Preview */}
      {imagePreview && (
        <div className="relative inline-block">
          <img 
            src={imagePreview} 
            alt="Upload preview" 
            className="h-20 w-auto rounded-lg border border-border"
          />
          <button
            onClick={removeImage}
            className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/80 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      
      <div className="relative flex items-end gap-2">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
        
        {/* Image upload button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <Image className="w-5 h-5" />
        </Button>

        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || "Chat with Vipe..."}
            disabled={disabled}
            rows={1}
            className="w-full resize-none bg-secondary border border-border rounded-xl px-4 py-3 pr-14 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
          <Button
            onClick={handleSubmit}
            disabled={disabled || (!message.trim() && !imagePreview)}
            size="icon"
            variant="glow"
            className="absolute right-2 bottom-2"
          >
            {disabled ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
