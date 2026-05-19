import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';

const p2gLogo = "/Logo-P2G.png";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidSession, setIsValidSession] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let validSessionFound = false;

    // Set up listener FIRST — before checking session — so we don't miss the
    // PASSWORD_RECOVERY event that Supabase fires when it processes the URL token.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        validSessionFound = true;
        setIsValidSession(true);
        setError(null);
        setLoading(false);
      }
    });

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        validSessionFound = true;
        setIsValidSession(true);
        setLoading(false);
      } else {
        // Don't show the error immediately: the PASSWORD_RECOVERY event may
        // arrive shortly after if Supabase is still exchanging the URL token.
        setTimeout(() => {
          if (!validSessionFound) {
            setError('Link de recuperação inválido ou expirado. Por favor, solicite um novo link.');
            setLoading(false);
          }
        }, 3000);
      }
    };

    checkSession();

    return () => subscription.unsubscribe();
  }, []);

  const getPasswordStrength = (pass: string): { label: string; color: string; width: string } => {
    if (!pass) return { label: '', color: 'bg-muted', width: '0%' };

    let score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 8) score++;
    if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score++;
    if (/\d/.test(pass)) score++;
    if (/[^a-zA-Z0-9]/.test(pass)) score++;

    if (score <= 2) return { label: 'Fraca', color: 'bg-destructive', width: '33%' };
    if (score <= 3) return { label: 'Média', color: 'bg-yellow-500', width: '66%' };
    return { label: 'Forte', color: 'bg-green-500', width: '100%' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({
        title: 'Palavra-passe muito curta',
        description: 'A palavra-passe deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Palavras-passe não coincidem',
        description: 'Verifique se as palavras-passe são iguais.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) throw updateError;

      setSuccess(true);
      toast({
        title: 'Palavra-passe alterada!',
        description: 'A sua palavra-passe foi alterada com sucesso.',
      });

      // Redirect to login after success
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Ocorreu um erro ao alterar a palavra-passe.';
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
    }

    setIsSubmitting(false);
  };

  const passwordStrength = getPasswordStrength(password);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.05)_0%,transparent_50%)]" />
        <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_70%_80%,hsl(var(--secondary)/0.05)_0%,transparent_50%)]" />
        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <img src={p2gLogo} alt="Perfect2Gether" className="h-12 w-48 object-contain mx-auto" width={192} height={48} />
          </div>
          <Card className="border-border bg-card/80 backdrop-blur shadow-xl">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-foreground">Link Inválido</CardTitle>
              <CardDescription className="text-muted-foreground">{error}</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button onClick={() => navigate('/')} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                Voltar ao Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.05)_0%,transparent_50%)]" />
        <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_70%_80%,hsl(var(--secondary)/0.05)_0%,transparent_50%)]" />
        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <img src={p2gLogo} alt="Perfect2Gether" className="h-12 w-48 object-contain mx-auto" width={192} height={48} />
          </div>
          <Card className="border-border bg-card/80 backdrop-blur shadow-xl">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <CardTitle className="text-foreground">Palavra-passe Alterada!</CardTitle>
              <CardDescription className="text-muted-foreground">
                A sua palavra-passe foi alterada com sucesso. A redirecionar para o login...
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.05)_0%,transparent_50%)]" />
      <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_70%_80%,hsl(var(--secondary)/0.05)_0%,transparent_50%)]" />
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <img src={p2gLogo} alt="Perfect2Gether" className="h-12 w-48 object-contain mx-auto" width={192} height={48} />
        </div>
        <Card className="border-border bg-card/80 backdrop-blur shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <KeyRound className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-foreground text-2xl font-bold">Nova Palavra-passe</CardTitle>
            <CardDescription className="text-muted-foreground">
              Introduza a sua nova palavra-passe.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground font-medium">Nova Palavra-passe</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-background border-border text-foreground"
                  required
                />
                {password && (
                  <div className="space-y-1">
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                        style={{ width: passwordStrength.width }}
                      />
                    </div>
                    <p className={`text-xs ${
                      passwordStrength.label === 'Fraca' ? 'text-destructive' :
                      passwordStrength.label === 'Média' ? 'text-yellow-500' : 'text-green-500'
                    }`}>
                      Força: {passwordStrength.label}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-foreground font-medium">Confirmar Palavra-passe</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repita a palavra-passe"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-background border-border text-foreground"
                  required
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-destructive">As palavras-passe não coincidem</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6 text-lg"
                disabled={isSubmitting || !isValidSession}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    A alterar...
                  </>
                ) : (
                  'Alterar Palavra-passe'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
