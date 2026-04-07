import { useEffect, useState } from 'react';
import { Check, Crown, Loader2, ExternalLink, Sparkles, Users, FileText, MessageSquare, BarChart3, Puzzle, Zap, Package, CreditCard, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useStripeSubscription } from '@/hooks/useStripeSubscription';
import { STRIPE_PLANS, type StripePlan } from '@/lib/stripe-plans';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

const INTEGRATION_ICONS: Record<string, React.ElementType> = {
  WhatsApp: MessageSquare,
  'Meta Pixels': BarChart3,
  'Faturação (KeyInvoice, InvoiceXpress)': FileText,
  'Pagamentos (Stripe)': CreditCard,
};

export function BillingTab() {
  const { organization } = useAuth();
  const { isLoading, subscriptionStatus, checkSubscription, createCheckout, openCustomerPortal } = useStripeSubscription();
  const [checkingPlan, setCheckingPlan] = useState<string | null>(null);
  const [hasChecked, setHasChecked] = useState(false);

  const isOnTrial = subscriptionStatus?.on_trial === true;
  const hasActiveSubscription = subscriptionStatus?.subscribed === true;
  // Only use plan_id as "current" if user has an active paid subscription (not trial)
  const currentPlanId = hasActiveSubscription ? (subscriptionStatus?.plan_id || 'starter') : null;
  const currentIndex = currentPlanId ? STRIPE_PLANS.findIndex(p => p.id === currentPlanId) : -1;
  const hasNoSubscription = !hasChecked || !hasActiveSubscription;

  useEffect(() => {
    if (!hasChecked) {
      checkSubscription().then(() => setHasChecked(true));
    }
  }, [checkSubscription, hasChecked]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('billing') === 'success') {
      // Fire Meta Pixel Purchase event
      if (typeof window.fbq === 'function') {
        window.fbq('track', 'Purchase', {
          content_name: 'Senvia OS Subscription',
          content_category: 'subscription',
          currency: 'EUR',
          value: 0,
        });
      }
      setTimeout(() => checkSubscription(), 2000);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [checkSubscription]);

  const handleSelectPlan = async (plan: StripePlan) => {
    if (plan.id === currentPlanId) return;
    setCheckingPlan(plan.id);
    await createCheckout(plan.priceId);
    setCheckingPlan(null);
  };

  return (
    <div className="space-y-6">
      {/* Billing Exempt Status */}
      {subscriptionStatus?.billing_exempt && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 md:p-5">
          <div className="flex items-center gap-2 mb-1">
            <Crown className="h-4 w-4 text-emerald-500" />
            <span className="font-semibold text-sm">Plano Vitalício</span>
            <Badge className="bg-emerald-500 text-white text-[10px] px-2.5 py-1">
              <Sparkles className="h-3 w-3 mr-1" />
              Isento
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            A sua organização tem acesso vitalício ao plano Elite sem necessidade de pagamento.
          </p>
        </div>
      )}

      {/* Trial Status */}
      {isOnTrial && subscriptionStatus?.days_remaining !== undefined && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 md:p-5">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="font-semibold text-sm">Período de Teste</span>
            <Badge className="bg-amber-500 text-white text-[10px] px-2.5 py-1">
              {subscriptionStatus.days_remaining} {subscriptionStatus.days_remaining === 1 ? 'dia restante' : 'dias restantes'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Tem acesso total a todos os módulos. Escolha um plano antes do fim do período de teste.
          </p>
        </div>
      )}

      {/* Current Plan Status - only when subscribed */}
      {!subscriptionStatus?.billing_exempt && subscriptionStatus?.subscribed && subscriptionStatus.subscription_end && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 md:p-5">
          <div className="flex items-center gap-2 mb-1">
            <Crown className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Subscrição Ativa</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Próxima renovação: {format(new Date(subscriptionStatus.subscription_end), "d 'de' MMMM 'de' yyyy", { locale: pt })}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 gap-2"
            onClick={openCustomerPortal}
            disabled={isLoading}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Gerir Subscrição
          </Button>
        </div>
      )}

      {/* Plans - Full Width Vertical Sections */}
      <div className="space-y-5">
        {STRIPE_PLANS.map((plan) => {
          const isCurrent = !hasNoSubscription && plan.id === currentPlanId;
          const isHighlighted = plan.highlighted;
          const planIndex = STRIPE_PLANS.findIndex(p => p.id === plan.id);
          const isUpgrade = !hasNoSubscription && planIndex > currentIndex;
          const isDowngrade = !hasNoSubscription && planIndex < currentIndex;

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border-2 overflow-hidden transition-all ${
                isCurrent
                  ? 'border-primary ring-2 ring-primary/20 shadow-lg'
                  : isHighlighted
                  ? 'border-primary/50 shadow-md'
                  : 'border-border shadow-sm'
              }`}
            >
              {/* Header - horizontal on desktop */}
              <div className={`p-5 md:p-6 ${
                isCurrent
                  ? 'bg-gradient-to-r from-primary/10 via-primary/5 to-transparent'
                  : isHighlighted
                  ? 'bg-gradient-to-r from-primary/8 via-transparent to-transparent'
                  : 'bg-gradient-to-r from-muted/50 to-transparent'
              }`}>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-xl font-bold tracking-tight">{plan.name}</h3>
                        {isCurrent && (
                          <Badge className="bg-primary text-primary-foreground text-[10px] px-2.5 py-1">
                            <Crown className="h-3 w-3 mr-1" />
                            Atual
                          </Badge>
                        )}
                        {isHighlighted && !isCurrent && (
                          <Badge variant="secondary" className="text-[10px] px-2.5 py-1">
                            <Sparkles className="h-3 w-3 mr-1" />
                            Popular
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold tracking-tight">{plan.priceMonthly}€</span>
                      <span className="text-muted-foreground text-sm font-medium">/mês</span>
                    </div>
                    {!subscriptionStatus?.billing_exempt && (
                      <Button
                        size="lg"
                        variant={isCurrent ? 'outline' : hasNoSubscription ? (isHighlighted ? 'default' : 'secondary') : isDowngrade ? 'secondary' : isHighlighted ? 'default' : 'secondary'}
                        disabled={isCurrent || isLoading || checkingPlan === plan.id}
                        onClick={() => {
                          if (hasNoSubscription) {
                            handleSelectPlan(plan);
                          } else if (isDowngrade) {
                            openCustomerPortal();
                          } else {
                            handleSelectPlan(plan);
                          }
                        }}
                        className="min-w-[160px]"
                      >
                        {checkingPlan === plan.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isCurrent ? (
                          'Plano Atual'
                        ) : hasNoSubscription ? (
                          'Selecionar'
                        ) : isUpgrade ? (
                          'Fazer Upgrade'
                        ) : (
                          'Fazer Downgrade'
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Content - 3 columns on desktop */}
              <div className="p-5 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Modules */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Módulos Incluídos</span>
                  </div>
                  <ul className="space-y-2">
                    {plan.modules.map((mod, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{mod}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Integrations */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Puzzle className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Integrações</span>
                  </div>
                  {plan.integrations.length > 0 ? (
                    <ul className="space-y-2">
                      {plan.integrations.map((integ, i) => {
                        const Icon = INTEGRATION_ICONS[integ] || Zap;
                        return (
                          <li key={i} className="flex items-center gap-2.5 text-sm">
                            <Icon className="h-4 w-4 text-primary shrink-0" />
                            <span>{integ}</span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Nenhuma integração incluída</p>
                  )}
                </div>

                {/* Limits */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Limites</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span><span className="font-medium">{plan.limits.users}</span> utilizadores</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span><span className="font-medium">{plan.limits.forms}</span></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
