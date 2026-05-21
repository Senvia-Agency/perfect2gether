import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck } from 'lucide-react';

const p2gLogo = '/Logo-P2G.png';

interface ChallengeMFAProps {
  onSuccess: () => void;
  onCancel?: () => void;
}

export function ChallengeMFA({ onSuccess, onCancel }: ChallengeMFAProps) {
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerify = async () => {
    if (code.length !== 6) return;

    setIsVerifying(true);
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp?.[0];

      if (!totpFactor) {
        throw new Error('Nenhum fator TOTP encontrado');
      }

      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challengeData.id,
        code,
      });

      if (verifyError) throw verifyError;

      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Código inválido',
        description: 'O código inserido não é válido. Tente novamente.',
        variant: 'destructive',
      });
      setCode('');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    onCancel?.();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.05)_0%,transparent_50%)]" />
      <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_70%_80%,hsl(var(--secondary)/0.05)_0%,transparent_50%)]" />
      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={p2gLogo} alt="Perfect2Gether" className="h-12 w-48 object-contain mx-auto" />
        </div>

        <Card className="border-border bg-card/80 backdrop-blur shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-foreground">Verificação de Dois Fatores</CardTitle>
            <CardDescription className="text-muted-foreground">
              Abra a sua app de autenticação e insira o código de 6 dígitos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); handleVerify(); }} className="space-y-6">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={setCode}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                type="submit"
                disabled={isVerifying || code.length !== 6}
                className="w-full"
              >
                {isVerifying ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />A verificar...</>
                ) : (
                  'Verificar'
                )}
              </Button>

              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  Não consegue aceder?{' '}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="text-primary hover:underline"
                  >
                    Terminar sessão
                  </button>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
