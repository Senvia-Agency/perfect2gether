import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OttoChatWindow } from "./OttoChatWindow";
import { useIsMobile } from "@/hooks/use-mobile";
import { AnimatePresence, motion } from "framer-motion";
import { useOttoStore } from "@/stores/useOttoStore";
const ottoMascot = "/otto-mascot.svg";

const OTTO_BUBBLE_KEY = "otto-bubble-dismissed";

export function OttoFAB() {
  const { isOpen, setOpen } = useOttoStore();
  const isMobile = useIsMobile();
  const { pathname } = useLocation();
  const [showBubble, setShowBubble] = useState(false);

  const isOperationalRoute = pathname.startsWith("/prospects");
  const shouldShowBubble = !isOperationalRoute;
  const fabPositionClass = isMobile
    ? "bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4"
    : isOperationalRoute
      ? "bottom-4 right-4"
      : "bottom-6 right-6";
  const fabSizeClass = isMobile
    ? "h-12 w-12"
    : isOperationalRoute
      ? "h-11 w-11"
      : "h-12 w-12";

  useEffect(() => {
    if (!shouldShowBubble) {
      setShowBubble(false);
      return;
    }

    const dismissed = localStorage.getItem(OTTO_BUBBLE_KEY);
    if (!dismissed) {
      const timer = setTimeout(() => setShowBubble(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [shouldShowBubble]);

  const dismissBubble = () => {
    setShowBubble(false);
    localStorage.setItem(OTTO_BUBBLE_KEY, "true");
  };

  const handleOpen = () => {
    setOpen(true);
    if (showBubble) dismissBubble();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      <div className="pointer-events-auto">
        <AnimatePresence>{isOpen && <OttoChatWindow onClose={() => setOpen(false)} />}</AnimatePresence>
      </div>

      {!isOpen && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          style={{ pointerEvents: "auto" }}
          data-otto-fab
          className={`fixed z-[9999] ${fabPositionClass}`}
        >
          <AnimatePresence>
            {showBubble && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.25 }}
                className="absolute bottom-[calc(100%+10px)] right-0 w-[180px]"
              >
                <div className="relative rounded-xl border border-border bg-card px-3 py-2 shadow-lg">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dismissBubble();
                    }}
                    className="absolute right-1.5 top-1.5 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <p className="pr-3 text-xs leading-relaxed text-foreground">
                    Precisa de ajuda? Pergunte-me sobre o Senvia OS! 🚀
                  </p>
                  <div className="absolute -bottom-[6px] right-5 h-3 w-3 rotate-45 border-b border-r border-border bg-card" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            onClick={handleOpen}
            className={`${fabSizeClass} overflow-hidden rounded-full p-0 shadow-md transition-shadow hover:shadow-lg`}
            size="icon"
          >
            <img src={ottoMascot} alt="Otto" className="h-full w-full object-cover" />
          </Button>
        </motion.div>
      )}
    </div>,
    document.body
  );
}
