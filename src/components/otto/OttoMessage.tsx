import ReactMarkdown from "react-markdown";
import { User, ExternalLink, MessageCircle } from "lucide-react";
const ottoMascot = "/otto-mascot.svg";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import type { OttoMessage as OttoMessageType } from "@/hooks/useOttoChat";

interface OttoMessageProps {
  message: OttoMessageType;
  onButtonClick?: (text: string) => void;
  onLinkClick?: () => void;
  isStreaming?: boolean;
}

function parseButtons(content: string) {
  const buttonRegex = /\[botao:(.+?)\]/g;
  const buttons: string[] = [];
  let match;
  while ((match = buttonRegex.exec(content)) !== null) {
    buttons.push(match[1]);
  }
  const cleanContent = content.replace(buttonRegex, "").trim();
  return { cleanContent, buttons };
}

function parseLinks(content: string) {
  const linkRegex = /\[link:(.+?)\|(.+?)\]/g;
  const links: { label: string; path: string }[] = [];
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    links.push({ label: match[1], path: match[2] });
  }
  const cleanContent = content.replace(linkRegex, "").trim();
  return { cleanContent, links };
}

function parseWhatsAppLinks(content: string) {
  const regex = /\[whatsapp:(.+?)\|(.+?)\]/g;
  const waLinks: { label: string; url: string }[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    waLinks.push({ label: match[1], url: match[2] });
  }
  const cleanContent = content.replace(regex, "").trim();
  return { cleanContent, waLinks };
}

export function OttoMessageComponent({ message, onButtonClick, onLinkClick, isStreaming }: OttoMessageProps) {
  const isUser = message.role === "user";
  const navigate = useNavigate();
  
  const parsed = isUser
    ? { cleanContent: message.content, buttons: [], links: [], waLinks: [] }
    : (() => {
        const { cleanContent: c1, buttons } = parseButtons(message.content);
        const { cleanContent: c2, links } = parseLinks(c1);
        const { cleanContent: c3, waLinks } = parseWhatsAppLinks(c2);
        return { cleanContent: c3, buttons, links, waLinks };
      })();
  
  const { cleanContent, buttons, links, waLinks } = parsed;

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center overflow-hidden ${
          isUser ? "bg-primary text-primary-foreground" : ""
        }`}
      >
        {isUser ? <User className="w-3.5 h-3.5" /> : <img src={ottoMascot} alt="Otto" className="w-full h-full object-cover" />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[85%] space-y-2`}>
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-md"
              : "bg-muted text-foreground rounded-tl-md"
          }`}
        >
          {isUser ? (
            <p>{cleanContent}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1 [&_ol]:my-1 [&_ul]:my-1">
              <ReactMarkdown>{cleanContent}</ReactMarkdown>
            </div>
          )}
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-foreground/60 animate-pulse ml-0.5 rounded-sm" />
          )}
        </div>

        {/* Action buttons */}
        {buttons.length > 0 && !isStreaming && (
          <div className="flex flex-wrap gap-1.5">
            {buttons.map((btn, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                className="h-auto py-1.5 px-3 text-xs rounded-full whitespace-normal text-left"
                onClick={() => onButtonClick?.(btn)}
              >
                {btn}
              </Button>
            ))}
          </div>
        )}

        {/* Navigation links */}
        {links.length > 0 && !isStreaming && (
          <div className="flex flex-wrap gap-1.5">
            {links.map((link, i) => (
              <Button
                key={i}
                variant="default"
                size="sm"
                className="h-auto py-1.5 px-3 text-xs rounded-full whitespace-normal text-left gap-1.5"
                onClick={() => {
                  navigate(link.path);
                  onLinkClick?.();
                }}
              >
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                {link.label}
              </Button>
            ))}
          </div>
        )}

        {/* WhatsApp links */}
        {waLinks.length > 0 && !isStreaming && (
          <div className="flex flex-col gap-2 w-full">
            {waLinks.map((wa, i) => (
              <a
                key={i}
                href={wa.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="w-full flex items-center gap-3 bg-[#25D366] hover:bg-[#1ebe5d] 
                  text-white rounded-xl p-3.5 transition-all duration-200 
                  hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-semibold text-sm">{wa.label}</p>
                  <p className="text-[11px] text-white/80">
                    Toca para abrir o WhatsApp e enviar
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-white/60 flex-shrink-0" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
