import { useNavigate, useLocation } from "react-router-dom";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useIsMobile } from "@/hooks/use-mobile";

export function PWAInstallButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { isInstalled, isIOS, canInstall, promptInstall, hasNativePrompt, wasDismissed, dismiss } = usePWAInstall();

  // Rotas públicas onde o botão NÃO deve aparecer
  const publicRoutes = ['/f/', '/c/', '/invite/', '/login', '/reset-password', '/privacy', '/terms', '/install'];
  const isPublicPage = publicRoutes.some(route => location.pathname.startsWith(route)) || location.pathname === '/';

  // Não mostrar se:
  // - Não é mobile
  // - Já está instalado
  // - Utilizador dispensou
  // - Não pode instalar
  // - Está numa página pública
  if (!isMobile || isInstalled || wasDismissed || !canInstall || isPublicPage) {
    return null;
  }

  const handleClick = async () => {
    if (hasNativePrompt) {
      // Android/Chrome: usar prompt nativo
      await promptInstall();
    } else if (isIOS) {
      // iOS: redirecionar para página com instruções
      navigate("/install");
    }
  };

  return (
    <div className="fixed bottom-24 right-4 z-50 flex items-center gap-2 animate-in slide-in-from-bottom-4 duration-500">
      {/* Botão de dispensar */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm shadow-lg border border-border"
        onClick={dismiss}
      >
        <X className="h-4 w-4" />
      </Button>

      {/* Botão principal */}
      <Button
        onClick={handleClick}
        variant="senvia"
        className="h-12 px-4 rounded-full shadow-lg hover:shadow-xl transition-all gap-2"
      >
        <Plus className="h-5 w-5" />
        <span className="font-medium">Adicionar Atalho</span>
      </Button>
    </div>
  );
}
