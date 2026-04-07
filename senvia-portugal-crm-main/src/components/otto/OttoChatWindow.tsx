import { useState, useRef, useEffect } from "react";
import { X, Send, Trash2, LifeBuoy, Paperclip, FileText, Image as ImageIcon } from "lucide-react";
const ottoMascot = "/otto-mascot.svg";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOttoChat } from "@/hooks/useOttoChat";
import { OttoMessageComponent } from "./OttoMessage";
import { OttoQuickActions } from "./OttoQuickActions";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOttoStore } from "@/stores/useOttoStore";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface OttoChatWindowProps {
  onClose: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export function OttoChatWindow({ onClose }: OttoChatWindowProps) {
  const { messages, isLoading, sendMessage, clearMessages } = useOttoChat();
  const { pendingAttachments, addAttachment, removeAttachment, clearAttachments } = useOttoStore();
  const [input, setInput] = useState("");
  const isMobile = useIsMobile();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    );
    if (viewport) {
      setTimeout(() => {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
      }, 50);
    }
  }, [messages, isLoading]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    sendMessage(text);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  const handleQuickAction = (text: string) => {
    if (isLoading) return;
    sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(`Tipo não suportado: ${file.name}. Usa JPG, PNG, WebP ou PDF.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`Ficheiro demasiado grande: ${file.name}. Máximo 10MB.`);
        continue;
      }
      if (pendingAttachments.length >= 5) {
        toast.error("Máximo de 5 anexos por vez.");
        break;
      }
      addAttachment(file);
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const getFileIcon = (file: File) => {
    if (file.type === "application/pdf") return <FileText className="w-3.5 h-3.5" />;
    return <ImageIcon className="w-3.5 h-3.5" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      style={{ pointerEvents: 'auto' }}
      className={
        isMobile
          ? "fixed inset-0 z-[9999] bg-background flex flex-col"
          : "fixed bottom-20 right-4 z-[9999] w-[380px] h-[520px] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      }
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30" style={isMobile ? { paddingTop: 'calc(clamp(20px, env(safe-area-inset-top, 0px), 50px) + 0.75rem)' } : undefined}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full overflow-hidden">
            <img src={ottoMascot} alt="Otto" className="w-full h-full object-cover" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Otto</h3>
            <p className="text-[10px] text-muted-foreground">Assistente Senvia OS</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button variant="ghost" size="icon-sm" onClick={clearMessages} title="Limpar conversa">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1">
        <div className="p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex gap-2.5">
              <div className="flex-shrink-0 w-7 h-7 rounded-full overflow-hidden">
                <img src={ottoMascot} alt="Otto" className="w-full h-full object-cover" />
              </div>
              <div className="max-w-[85%]">
                <OttoQuickActions onSelect={handleQuickAction} />
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <OttoMessageComponent
              key={i}
              message={msg}
              onButtonClick={handleQuickAction}
              onLinkClick={onClose}
              isStreaming={isLoading && i === messages.length - 1 && msg.role === "assistant"}
            />
          ))}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-2.5">
              <div className="flex-shrink-0 w-7 h-7 rounded-full overflow-hidden">
                <img src={ottoMascot} alt="Otto" className="w-full h-full object-cover" />
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-md px-3.5 py-2.5">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-border bg-muted/20" style={isMobile ? { paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' } : undefined}>
        {!messages.some(m => m.role === "assistant" && /ticket|assunto|suporte/i.test(m.content)) && (
          <Button
            variant="outline"
            size="sm"
            className="w-full rounded-full gap-2 text-xs mb-2"
            onClick={() => handleQuickAction("Preciso de abrir um ticket de suporte")}
            disabled={isLoading}
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            Abrir Ticket de Suporte
          </Button>
        )}

        {/* Attachment previews */}
        {pendingAttachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {pendingAttachments.map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 bg-muted rounded-lg px-2 py-1 text-xs max-w-[160px]"
              >
                {getFileIcon(file)}
                <span className="truncate flex-1">{file.name}</span>
                <button
                  onClick={() => removeAttachment(i)}
                  className="text-muted-foreground hover:text-foreground flex-shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl flex-shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            title="Anexar ficheiro"
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escreve aqui..."
            disabled={isLoading}
            className="flex-1 h-10 px-3 rounded-xl bg-background border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <Button
            size="icon"
            className="h-10 w-10 rounded-xl"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
