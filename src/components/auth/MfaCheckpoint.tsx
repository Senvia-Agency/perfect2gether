import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { AccountLoading } from './AccountLoading';
import { ChallengeMFA } from './ChallengeMFA';
import { EnrollMFA } from './EnrollMFA';

export function useMfaCheckpoint() {
  const { mfaStatus, completeMfaChallenge, retryMfaCheck, signOut } = useAuth();

  if (mfaStatus === 'checking') return <AccountLoading />;
  if (mfaStatus === 'pending') return <ChallengeMFA onSuccess={completeMfaChallenge} />;
  if (mfaStatus === 'needs_enrollment') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            Para continuar, ative a autenticação de dois fatores na sua própria conta.
          </p>
          <EnrollMFA onSuccess={completeMfaChallenge} onCancel={() => { void signOut(); }} />
        </div>
      </div>
    );
  }
  if (mfaStatus === 'error') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-4 text-center">
        <p>Não foi possível confirmar a proteção da conta. Tente novamente.</p>
        <Button onClick={retryMfaCheck}>Tentar novamente</Button>
        <Button variant="outline" onClick={() => { void signOut(); }}>Terminar sessão</Button>
      </div>
    );
  }
  return null;
}
