import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CreditCard, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStripeSubscription } from '@/hooks/useStripeSubscription';

interface PaymentOverdueBlockerProps {
  paymentFailedAt?: string;
}

export function PaymentOverdueBlocker({ paymentFailedAt }: PaymentOverdueBlockerProps) {
  const navigate = useNavigate();
  const { openCustomerPortal, isLoading } = useStripeSubscription();

  const failedDate = paymentFailedAt ? new Date(paymentFailedAt) : null;
  const daysSinceFailure = failedDate
    ? Math.floor((Date.now() - failedDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center p-4 pt-safe pb-safe">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            Pagamento em atraso
          </h1>
          <p className="text-muted-foreground text-sm">
            O pagamento da sua subscrição falhou há {daysSinceFailure} {daysSinceFailure === 1 ? 'dia' : 'dias'}. 
            Regularize o pagamento para continuar a utilizar o sistema.
          </p>
        </div>

        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <div className="flex items-center justify-center gap-2 text-destructive">
            <CreditCard className="h-4 w-4" />
            <span className="text-sm font-semibold">
              Acesso suspenso por pagamento em atraso
            </span>
          </div>
          {failedDate && (
            <p className="text-xs text-muted-foreground mt-2">
              Falha de pagamento desde {failedDate.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <Button
            size="lg"
            className="w-full gap-2"
            onClick={() => openCustomerPortal()}
            disabled={isLoading}
          >
            <CreditCard className="h-4 w-4" />
            Regularizar Pagamento
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full gap-2"
            onClick={() => navigate('/settings?tab=billing')}
          >
            <Settings className="h-4 w-4" />
            Ver Planos
          </Button>
        </div>
      </div>
    </div>
  );
}
