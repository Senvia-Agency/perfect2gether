import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, AlertCircle, CheckCircle2, Building, LogOut } from 'lucide-react';
import { getRoleLabel } from '@/lib/roles';

const p2gLogo = "/logo-p2gether.png";

interface InviteData {
  id: string;
  email: string;
  role: string;
  organization_id: string;
  organization_name?: string;
  token: string;
}

export default function InviteRegister() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [currentSession, setCurrentSession] = useState<boolean | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Handle redirect with proper cleanup
  useEffect(() => {
    if (shouldRedirect) {
      const timer = setTimeout(() => navigate('/dashboard'), 2000);
      return () => clearTimeout(timer);
    }
  }, [shouldRedirect, navigate]);

  // Check for existing session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentSession(!!session);
    });
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    setCurrentSession(false);
    setLoggingOut(false);
    toast({
      title: 'Sessão terminada',
      description: 'Pode agora criar uma nova conta.',
    });
  };

  useEffect(() => {
    async function validateInvite() {
      if (!token) {
        setError('Link de convite inválido.');
        setLoading(false);
        return;
      }

      try {
        // Fetch invite data
        const { data: inviteData, error: inviteError } = await supabase
          .from('organization_invites')
          .select('id, email, role, organization_id, token')
          .eq('token', token)
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString())
          .single();

        if (inviteError || !inviteData) {
          setError('Este convite é inválido ou já expirou.');
          setLoading(false);
          return;
        }

        // Get organization name using RPC function (bypasses RLS)
        const { data: orgName } = await supabase.rpc('get_org_name_by_invite_token', {
          _token: token
        });

        setInvite({
          ...inviteData,
          organization_name: orgName || 'Organização',
        });
      } catch {
        setError('Ocorreu um erro ao validar o convite.');
      }

      setLoading(false);
    }

    validateInvite();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!invite || !fullName.trim() || !password) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos.',
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

    if (password.length < 6) {
      toast({
        title: 'Palavra-passe muito curta',
        description: 'A palavra-passe deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Não foi possível criar a conta.');

      // Accept invite
      const { data: accepted, error: acceptError } = await supabase.rpc('accept_invite', {
        _token: invite.token,
        _user_id: authData.user.id,
      });

      if (acceptError) throw acceptError;
      if (!accepted) throw new Error('Não foi possível aceitar o convite.');

      setSuccess(true);
      toast({
        title: 'Conta criada com sucesso!',
        description: 'A redirecionar para o dashboard...',
      });

      setShouldRedirect(true);
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Ocorreu um erro ao criar a conta.',
        variant: 'destructive',
      });
    }

    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.05)_0%,transparent_50%)]" />
        <Card className="max-w-md w-full relative z-10 border-border bg-card/80 backdrop-blur shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-foreground">Convite Inválido</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild className="w-full">
              <Link to="/">Ir para Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentSession === true) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.05)_0%,transparent_50%)]" />
        <Card className="max-w-md w-full relative z-10 border-border bg-card/80 backdrop-blur shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
              <LogOut className="h-6 w-6 text-amber-500" />
            </div>
            <CardTitle className="text-foreground">Já está autenticado</CardTitle>
            <CardDescription>
              Para aceitar este convite e criar uma nova conta, precisa primeiro terminar a sessão atual.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-muted border border-border">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{invite?.organization_name}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Convite para: {invite?.email}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button 
                onClick={handleLogout} 
                disabled={loggingOut}
                className="w-full bg-primary"
              >
                {loggingOut && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Terminar Sessão e Continuar
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link to="/dashboard">Voltar ao Dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.05)_0%,transparent_50%)]" />
        <Card className="max-w-md w-full relative z-10 border-border bg-card/80 backdrop-blur shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <CardTitle className="text-foreground">Conta Criada!</CardTitle>
            <CardDescription>
              A sua conta foi criada e já está associada à organização.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground mt-4">A redirecionar...</p>
          </CardContent>
        </Card>
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
              <UserPlus className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-foreground text-2xl font-bold">Criar Conta</CardTitle>
            <CardDescription>
              Foi convidado para se juntar à organização
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 p-4 rounded-lg bg-muted border border-border space-y-2">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{invite?.organization_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Perfil:</span>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                  {invite?.role ? getRoleLabel({ role: invite.role }) : ''}
                </Badge>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={invite?.email || ''}
                  disabled
                  className="bg-muted border-border text-muted-foreground opacity-70"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-foreground font-medium">Nome Completo</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="O seu nome"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="bg-background border-border"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground font-medium">Palavra-passe</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-background border-border"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-foreground font-medium">Confirmar Palavra-passe</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repita a palavra-passe"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-background border-border"
                  required
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6 text-lg mt-4" 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    A criar conta...
                  </>
                ) : (
                  'Criar Conta'
                )}
              </Button>
            </form>

            <p className="text-xs text-muted-foreground text-center mt-6">
              Já tem conta?{' '}
              <Link to="/" className="text-primary font-medium hover:underline">
                Faça login
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
