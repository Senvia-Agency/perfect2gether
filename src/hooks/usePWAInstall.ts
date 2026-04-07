import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "pwa-install-dismissed";

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [wasDismissed, setWasDismissed] = useState(false);

  useEffect(() => {
    // Verificar se foi dispensado anteriormente
    if (localStorage.getItem(DISMISSED_KEY) === "true") {
      setWasDismissed(true);
    }

    // Verificar se já está instalado (modo standalone)
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Detectar plataforma
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua);
    const android = /Android/.test(ua);
    setIsIOS(ios);
    setIsAndroid(android);

    // iOS não suporta beforeinstallprompt mas pode instalar manualmente
    if (ios) {
      setCanInstall(true);
    }

    // Listener para o evento de instalação (Chrome/Android)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const promptInstall = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
      setCanInstall(false);
    }

    setDeferredPrompt(null);
    return outcome === "accepted";
  };

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setWasDismissed(true);
  };

  return {
    isInstalled,
    isIOS,
    isAndroid,
    canInstall,
    promptInstall,
    hasNativePrompt: !!deferredPrompt,
    wasDismissed,
    dismiss,
  };
}
