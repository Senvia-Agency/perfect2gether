import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Shield, ShieldCheck, ShieldOff, Loader2, Key, Eye, EyeOff } from 'lucide-react';
import { EnrollMFA } from '@/components/auth/EnrollMFA';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface SecuritySettingsProps {
  newPassword?: string;
  setNewPassword?: (value: string) => void;
  confirmPassword?: string;
  setConfirmPassword?: (value: string) => void;
  showPassword?: boolean;
  setShowPassword?: (value: boolean) => void;
  handleChangePassword?: () => void;
  changePasswordIsPending?: boolean;
}

export function SecuritySettings({
  newPassword = '',
  setNewPassword,
  confirmPassword = '',
  setConfirmPassword,
  showPassword = false,
  setShowPassword,
  handleChangePassword,
  changePasswordIsPending = false,
}: SecuritySettingsProps) {
  const { toast } = useToast();
  const [hasMFA, setHasMFA] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDisabling, setIsDisabling] = useState(false);
  const [showEnroll, setShowEnroll] = useState(false);

  const checkMFAStatus = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const verifiedFactors = data?.totp?.filter(f => f.status === 'verified') || [];
      setHasMFA(verifiedFactors.length > 0);
    } catch (error) {
      console.error('Error checking MFA status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkMFAStatus();
  }, []);

  const handleDisableMFA = async () => {
    setIsDisabling(true);
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const totpFactors = data?.totp || [];

      for (const factor of totpFactors) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }

      setHasMFA(false);
      toast({
        title: '2FA desativado',
        description: 'A autenticação de dois fatores foi desativada.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao desativar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsDisabling(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (showEnroll) {
    return (
      <EnrollMFA
        onSuccess={() => {
          setShowEnroll(false);
          checkMFAStatus();
        }}
        onCancel={() => setShowEnroll(false)}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Autenticação de Dois Fatores (2FA)</CardTitle>
              <CardDescription>
                Proteja a sua conta com um código adicional ao iniciar sessão.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Estado:</span>
              {hasMFA ? (
                <Badge variant="default" className="gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Ativo
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <ShieldOff className="h-3 w-3" />
                  Desativado
                </Badge>
              )}
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            {hasMFA
              ? 'A sua conta está protegida com autenticação de dois fatores. Será necessário um código do Microsoft Authenticator, Google Authenticator ou outra app TOTP para iniciar sessão.'
              : 'Ative a autenticação de dois fatores para adicionar uma camada extra de segurança à sua conta.'}
          </p>

          {hasMFA ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isDisabling}>
                  {isDisabling ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />A desativar...</>
                  ) : (
                    'Desativar 2FA'
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Desativar 2FA?</AlertDialogTitle>
                  <AlertDialogDescription>
                    A sua conta ficará menos segura sem a autenticação de dois fatores. Tem a certeza que deseja desativar?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDisableMFA}>
                    Sim, desativar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button onClick={() => setShowEnroll(true)} size="sm">
              Ativar 2FA
            </Button>
          )}
        </CardContent>
      </Card>

      {setNewPassword && setConfirmPassword && setShowPassword && handleChangePassword && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Alterar Palavra-passe
            </CardTitle>
            <CardDescription>
              Atualize a palavra-passe da sua conta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-sm text-muted-foreground">Nova Palavra-passe</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-sm text-muted-foreground">Confirmar Palavra-passe</Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repetir palavra-passe"
                />
              </div>
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={changePasswordIsPending || !newPassword || !confirmPassword}
            >
              {changePasswordIsPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Alterar Palavra-passe
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
