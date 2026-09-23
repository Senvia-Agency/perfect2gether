import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowUpRight, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import "@/styles/total-link.css";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "A palavra-passe deve ter pelo menos 6 caracteres"),
});

export default function TotalLinkLogin() {
  const navigate = useNavigate();
  const { signIn, user, session, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaCode, setMfaCode] = useState("");

  useEffect(() => {
    if (user && session) navigate("/portal-total-link/home", { replace: true });
  }, [user, session, navigate]);

  const handlePasswordReset = async () => {
    if (!email) {
      toast({ title: "Email necessário", description: "Indique o email para recuperar a palavra-passe.", variant: "destructive" });
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    toast(error
      ? { title: "Erro", description: error.message, variant: "destructive" }
      : { title: "Email enviado", description: "Verifique a sua caixa de entrada para repor a palavra-passe." });
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      toast({ title: "Erro de validação", description: result.error.errors[0].message, variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        toast({
          title: "Erro ao iniciar sessão",
          description: error.message === "Invalid login credentials" ? "Email ou palavra-passe incorretos" : error.message,
          variant: "destructive",
        });
        return;
      }

      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const factor = factorsData?.totp?.find((item) => item.status === "verified");
      if (factor) {
        setMfaFactorId(factor.id);
        setMfaRequired(true);
        return;
      }

      window.location.assign("/portal-total-link/home");
    } catch (error) {
      toast({ title: "Erro", description: error instanceof Error ? error.message : "Ocorreu um erro inesperado.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMfaVerification = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!mfaFactorId || mfaCode.length !== 6) return;
    setIsSubmitting(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (challengeError) throw challengeError;
      const { error: verificationError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.id,
        code: mfaCode,
      });
      if (verificationError) throw verificationError;
      window.location.assign("/portal-total-link/home");
    } catch (error) {
      toast({ title: "Código inválido", description: error instanceof Error ? error.message : "Verifique o código e tente novamente.", variant: "destructive" });
      setMfaCode("");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return <div className="total-link-shell flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#1659c9]" /></div>;
  }

  return (
    <main className="total-link-shell total-link-login min-h-screen px-4 py-5 sm:p-8">
      <Helmet>
        <title>Total Link | Área operacional</title>
        <meta name="theme-color" content="#1746ae" />
      </Helmet>
      <div className="total-link-login__grid mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-6xl overflow-hidden rounded-[32px] border border-[#d8e4f5] bg-white shadow-[0_24px_70px_rgba(18,62,175,0.12)] lg:grid-cols-[1.08fr_0.92fr]">
        <section className="total-link-login__intro relative hidden overflow-hidden p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="relative z-10">
            <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">Operações</span>
            <h1 className="mt-8 max-w-md text-4xl font-semibold leading-[1.05] tracking-[-0.045em]">O ponto de ligação para cada processo.</h1>
            <p className="mt-5 max-w-sm text-sm leading-6 text-blue-100">Contratos, identificadores e pendências numa área de trabalho feita para acompanhar o que importa.</p>
          </div>
          <div className="relative z-10 flex items-end justify-between border-t border-white/15 pt-5 text-sm text-blue-100">
            <span>Área operacional Total Link</span>
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
          </div>
          <span className="total-link-login__lane total-link-login__lane--one" aria-hidden="true" />
          <span className="total-link-login__lane total-link-login__lane--two" aria-hidden="true" />
          <span className="total-link-login__node total-link-login__node--one" aria-hidden="true" />
          <span className="total-link-login__node total-link-login__node--two" aria-hidden="true" />
        </section>

        <section className="flex flex-col justify-between p-6 sm:p-10">
          <div className="flex items-start justify-between gap-5">
            <img src="/total-link-logo.png" alt="Total Link" className="h-20 w-44 object-contain object-left sm:h-24 sm:w-52" width={208} height={96} fetchPriority="high" />
            <Link to="/" className="group inline-flex items-center gap-1 text-xs font-semibold text-[#315994] transition-colors hover:text-[#123eaf]">
              Perfect2Gether <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="my-12 w-full max-w-sm">
            {!mfaRequired ? (
              <>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2473da]">Acesso seguro</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#122033]">Entrar na área operacional</h2>
                <p className="mt-3 text-sm leading-6 text-[#62718a]">Use as suas credenciais para continuar.</p>
                <form className="mt-8 space-y-5" onSubmit={handleLogin}>
                  <div className="space-y-2">
                    <Label htmlFor="total-link-email" className="text-[#243552]">Email</Label>
                    <Input id="total-link-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@empresa.pt" className="total-link-input h-12" autoComplete="email" required />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3"><Label htmlFor="total-link-password" className="text-[#243552]">Palavra-passe</Label><button type="button" onClick={handlePasswordReset} className="text-xs font-semibold text-[#1965ce] hover:underline">Recuperar acesso</button></div>
                    <Input id="total-link-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" className="total-link-input h-12" autoComplete="current-password" required />
                  </div>
                  <Button type="submit" disabled={isSubmitting} className="total-link-button h-12 w-full text-sm font-semibold">
                    {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />A validar acesso...</> : "Entrar"}
                  </Button>
                </form>
              </>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e6f0ff] text-[#1659c9]"><ShieldCheck className="h-6 w-6" /></div>
                <p className="mt-7 text-xs font-bold uppercase tracking-[0.2em] text-[#2473da]">Verificação adicional</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#122033]">Confirme a sua identidade</h2>
                <p className="mt-3 text-sm leading-6 text-[#62718a]">Introduza o código de seis dígitos da aplicação de autenticação.</p>
                <form className="mt-8 space-y-5" onSubmit={handleMfaVerification}>
                  <Input id="total-link-mfa" inputMode="numeric" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" className="total-link-input h-14 text-center font-mono text-2xl tracking-[0.45em]" autoFocus required />
                  <Button type="submit" disabled={isSubmitting || mfaCode.length !== 6} className="total-link-button h-12 w-full text-sm font-semibold">{isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />A verificar...</> : "Verificar e entrar"}</Button>
                  <button type="button" onClick={() => { setMfaRequired(false); setMfaCode(""); setMfaFactorId(""); void supabase.auth.signOut(); }} className="w-full text-center text-xs font-medium text-[#62718a] hover:text-[#123eaf]">Voltar ao login</button>
                </form>
              </>
            )}
          </div>
          <p className="text-xs leading-5 text-[#8490a3]">Acesso reservado a utilizadores autorizados da Total Link.</p>
        </section>
      </div>
    </main>
  );
}
