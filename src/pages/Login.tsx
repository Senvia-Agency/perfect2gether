import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

const p2gLogo = "/logo-p2gether.png";

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'A palavra-passe deve ter pelo menos 6 caracteres'),
});

export default function Login() {
  const navigate = useNavigate();
  const { signIn, user, session, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // MFA state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState('');
  const [mfaCode, setMfaCode] = useState('');

  useEffect(() => {
    if (user && session) {
      navigate('/dashboard');
    }
  }, [user, session, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = loginSchema.safeParse({
      email: loginEmail,
      password: loginPassword,
    });

    if (!result.success) {
      toast({
        title: 'Erro de validação',
        description: result.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error: authError } = await signIn(loginEmail, loginPassword);

      if (authError) {
        toast({
          title: 'Erro ao iniciar sessão',
          description: authError.message === 'Invalid login credentials'
            ? 'Email ou palavra-passe incorretos'
            : authError.message,
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      // Check if user has MFA factors
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const totpFactor = factorsData?.totp?.find(f => f.status === 'verified');

      if (totpFactor) {
        // MFA is required — show verification step
        setMfaFactorId(totpFactor.id);
        setMfaRequired(true);
        setIsLoading(false);
        return;
      }

      toast({
        title: 'Bem-vindo!',
        description: `Sessão iniciada com sucesso`,
      });

      window.location.href = '/dashboard';

    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaFactorId || mfaCode.length !== 6) return;
    setIsLoading(true);

    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challengeData.id,
        code: mfaCode,
      });
      if (verifyError) throw verifyError;

      toast({
        title: 'Bem-vindo!',
        description: 'Sessão iniciada com sucesso.',
      });

      window.location.href = '/dashboard';
    } catch (error: any) {
      toast({
        title: 'Código inválido',
        description: error.message || 'Verifique o código e tente novamente.',
        variant: 'destructive',
      });
      setMfaCode('');
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.05)_0%,transparent_50%)]" />
      <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_70%_80%,hsl(var(--secondary)/0.05)_0%,transparent_50%)]" />
      
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <img src={p2gLogo} alt="Perfect2Gether" className="h-12 w-48 object-contain mx-auto" width={192} height={48} fetchPriority="high" loading="eager" decoding="async" />
        </div>

        <Card className="border-border bg-card/80 backdrop-blur shadow-xl">
          {!mfaRequired ? (
            <>
              <CardHeader className="text-center">
                <CardTitle className="text-foreground text-2xl font-bold">
                  Aceder à Plataforma
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Introduza as suas credenciais para continuar
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-foreground font-medium">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="bg-background border-border text-foreground"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-foreground font-medium">Palavra-passe</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="bg-background border-border text-foreground"
                      required
                    />
                  </div>
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => {
                        if (!loginEmail) {
                          toast({
                            title: 'Email necessário',
                            description: 'Insira o seu email para recuperar a palavra-passe.',
                            variant: 'destructive',
                          });
                          return;
                        }
                        supabase.auth.resetPasswordForEmail(loginEmail, {
                          redirectTo: `${window.location.origin}/reset-password`,
                        }).then(({ error }) => {
                          if (error) {
                            toast({
                              title: 'Erro',
                              description: error.message,
                              variant: 'destructive',
                            });
                          } else {
                            toast({
                              title: 'Email enviado',
                              description: 'Verifique a sua caixa de entrada para repor a palavra-passe.',
                            });
                          }
                        });
                      }}
                      className="text-xs text-primary hover:underline"
                    >
                      Esqueceu-se da palavra-passe?
                    </button>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6 text-lg"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        A entrar...
                      </>
                    ) : (
                      'Entrar'
                    )}
                  </Button>
                </form>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-foreground text-2xl font-bold">
                  Verificação de Segurança
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Introduza o código de 6 dígitos da sua aplicação de autenticação
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleMfaVerify} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="mfa-code" className="text-foreground font-medium">Código de verificação</Label>
                    <Input
                      id="mfa-code"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="bg-background border-border text-foreground text-center text-2xl tracking-[0.5em] font-mono"
                      autoFocus
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6 text-lg"
                    disabled={isLoading || mfaCode.length !== 6}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        A verificar...
                      </>
                    ) : (
                      'Verificar'
                    )}
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setMfaRequired(false);
                      setMfaCode('');
                      setMfaFactorId('');
                      supabase.auth.signOut();
                    }}
                    className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Voltar ao login
                  </button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}