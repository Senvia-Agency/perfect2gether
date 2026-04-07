import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, Check, Share, MoreVertical, PlusSquare } from "lucide-react";
import senviaLogo from "@/assets/senvia-logo.png";
import { Link } from "react-router-dom";
import { usePWAInstall } from "@/hooks/usePWAInstall";

export default function Install() {
  const { isInstalled, isIOS, isAndroid, hasNativePrompt, promptInstall } = usePWAInstall();

  const handleInstallClick = async () => {
    await promptInstall();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Logo */}
        <div className="text-center">
          <img src={senviaLogo} alt="Senvia OS" className="h-20 w-20 mx-auto rounded-2xl shadow-lg" />
          <h1 className="mt-4 text-2xl font-bold text-foreground">Instalar Senvia OS</h1>
          <p className="mt-2 text-muted-foreground">
            Aceda rapidamente à aplicação diretamente do seu telemóvel
          </p>
        </div>

        {isInstalled ? (
          <Card className="border-green-500/50 bg-green-500/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-green-500">
                <Check className="h-6 w-6" />
                <div>
                  <p className="font-medium">App já instalada!</p>
                  <p className="text-sm text-green-500/80">
                    O Senvia OS já está no seu dispositivo.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Android / Chrome Install Button */}
            {hasNativePrompt && (
              <Button onClick={handleInstallClick} size="lg" className="w-full h-14 text-base">
                <Download className="mr-2 h-5 w-5" />
                Instalar Aplicação
              </Button>
            )}

            {/* iOS Instructions */}
            {isIOS && !hasNativePrompt && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    Instruções para iPhone/iPad
                  </CardTitle>
                  <CardDescription>
                    Siga os passos para instalar o Senvia OS
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                      1
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Toque no botão Partilhar</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Share className="h-4 w-4" /> na barra inferior do Safari
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                      2
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Selecione "Adicionar ao Ecrã Inicial"</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <PlusSquare className="h-4 w-4" /> no menu de opções
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                      3
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Confirme tocando "Adicionar"</p>
                      <p className="text-sm text-muted-foreground">
                        O ícone aparecerá no seu ecrã inicial
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Android Instructions (fallback) */}
            {isAndroid && !hasNativePrompt && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    Instruções para Android
                  </CardTitle>
                  <CardDescription>
                    Siga os passos para instalar o Senvia OS
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                      1
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Toque no menu do browser</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MoreVertical className="h-4 w-4" /> (3 pontos no canto superior)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                      2
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Selecione "Instalar app" ou "Adicionar ao ecrã inicial"</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                      3
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Confirme a instalação</p>
                      <p className="text-sm text-muted-foreground">
                        O ícone aparecerá no seu ecrã inicial
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Desktop fallback */}
            {!isIOS && !isAndroid && !hasNativePrompt && (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    Abra esta página no seu telemóvel para instalar a aplicação.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Benefits */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground text-center">
            Vantagens da App
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 rounded-xl bg-muted/30">
              <p className="text-sm font-medium">Acesso Rápido</p>
              <p className="text-xs text-muted-foreground">1 toque para abrir</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-muted/30">
              <p className="text-sm font-medium">Ecrã Completo</p>
              <p className="text-xs text-muted-foreground">Sem barra do browser</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-muted/30">
              <p className="text-sm font-medium">Sempre Atualizada</p>
              <p className="text-xs text-muted-foreground">Atualizações automáticas</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-muted/30">
              <p className="text-sm font-medium">Modo Offline</p>
              <p className="text-xs text-muted-foreground">Funciona sem internet</p>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link to="/" className="text-sm text-primary hover:underline">
            Continuar para o Login →
          </Link>
        </div>
      </div>
    </div>
  );
}
