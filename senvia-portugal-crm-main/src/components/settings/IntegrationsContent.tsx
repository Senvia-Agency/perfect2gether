import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Webhook, Send, Loader2, Eye, EyeOff, MessageCircle, Mail, Receipt, ArrowLeft, ChevronRight, Plus, Trash2, Link2, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { useOrganizationWebhooks, useCreateWebhook, useToggleWebhook, useDeleteWebhook, OrganizationWebhook } from "@/hooks/useOrganizationWebhooks";
import { useTestWebhook } from "@/hooks/useOrganization";
import { useAuth } from "@/contexts/AuthContext";

interface IntegrationsContentProps {
  isLoadingIntegrations: boolean;
  whatsappBaseUrl: string;
  setWhatsappBaseUrl: (value: string) => void;
  whatsappInstance: string;
  setWhatsappInstance: (value: string) => void;
  whatsappApiKey: string;
  setWhatsappApiKey: (value: string) => void;
  showWhatsappApiKey: boolean;
  setShowWhatsappApiKey: (value: boolean) => void;
  handleSaveWhatsApp: () => void;
  brevoApiKey: string;
  setBrevoApiKey: (value: string) => void;
  brevoSenderEmail: string;
  setBrevoSenderEmail: (value: string) => void;
  showBrevoApiKey: boolean;
  setShowBrevoApiKey: (value: boolean) => void;
  handleSaveBrevo: () => void;
  invoiceXpressAccountName: string;
  setInvoiceXpressAccountName: (value: string) => void;
  invoiceXpressApiKey: string;
  setInvoiceXpressApiKey: (value: string) => void;
  showInvoiceXpressApiKey: boolean;
  setShowInvoiceXpressApiKey: (value: boolean) => void;
  handleSaveInvoiceXpress: () => void;
  integrationsEnabled: Record<string, boolean>;
  onToggleIntegration: (key: string, enabled: boolean) => void;
  updateOrganizationIsPending: boolean;
  keyinvoiceApiKey: string;
  setKeyinvoiceApiKey: (value: string) => void;
  keyinvoiceApiUrl: string;
  setKeyinvoiceApiUrl: (value: string) => void;
  showKeyinvoiceApiKey: boolean;
  setShowKeyinvoiceApiKey: (value: boolean) => void;
  handleSaveKeyInvoice: () => void;
}

type IntegrationKey = 'webhook' | 'webhook_inbound' | 'whatsapp' | 'brevo' | 'invoicexpress' | 'keyinvoice';

interface IntegrationDef {
  key: IntegrationKey;
  icon: LucideIcon;
  title: string;
  description: string;
  toggleKey: string;
  group: string;
}

const integrationGroups = ['Automações', 'Comunicações', 'Faturação'] as const;

const integrations: IntegrationDef[] = [
  { key: 'webhook', icon: Webhook, title: 'Webhooks', description: 'Notificações de novos leads', toggleKey: 'webhook', group: 'Automações' },
  { key: 'webhook_inbound', icon: Link2, title: 'Webhook de Entrada', description: 'Receber leads via Zapier/Make', toggleKey: 'webhook_inbound', group: 'Automações' },
  { key: 'whatsapp', icon: MessageCircle, title: 'WhatsApp Business', description: 'Integração com Evolution API', toggleKey: 'whatsapp', group: 'Comunicações' },
  { key: 'brevo', icon: Mail, title: 'Email (Brevo)', description: 'Envio de emails e propostas', toggleKey: 'brevo', group: 'Comunicações' },
  { key: 'invoicexpress', icon: Receipt, title: 'InvoiceXpress', description: 'Emissão de faturas automática', toggleKey: 'invoicexpress', group: 'Faturação' },
  { key: 'keyinvoice', icon: Receipt, title: 'KeyInvoice', description: 'Faturação via API 5.0', toggleKey: 'keyinvoice', group: 'Faturação' },
];

function IntegrationCard({ 
  icon: Icon, title, description, badge, onClick 
}: { 
  icon: LucideIcon; title: string; description: string; 
  badge: React.ReactNode; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-4 rounded-lg border bg-card",
        "hover:bg-accent/50 cursor-pointer transition-colors text-left"
      )}
    >
      <div className="rounded-md bg-primary/10 p-2 shrink-0">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge}
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  );
}

export const IntegrationsContent = (props: IntegrationsContentProps) => {
  const [active, setActive] = useState<IntegrationKey | null>(null);
  const { data: webhooks = [] } = useOrganizationWebhooks();

  const {
    isLoadingIntegrations,
    whatsappBaseUrl, setWhatsappBaseUrl, whatsappInstance, setWhatsappInstance,
    whatsappApiKey, setWhatsappApiKey, showWhatsappApiKey, setShowWhatsappApiKey, handleSaveWhatsApp,
    brevoApiKey, setBrevoApiKey, brevoSenderEmail, setBrevoSenderEmail,
    showBrevoApiKey, setShowBrevoApiKey, handleSaveBrevo,
    invoiceXpressAccountName, setInvoiceXpressAccountName, invoiceXpressApiKey, setInvoiceXpressApiKey,
    showInvoiceXpressApiKey, setShowInvoiceXpressApiKey, handleSaveInvoiceXpress,
    integrationsEnabled, onToggleIntegration, updateOrganizationIsPending,
    keyinvoiceApiKey, setKeyinvoiceApiKey, keyinvoiceApiUrl, setKeyinvoiceApiUrl,
    showKeyinvoiceApiKey, setShowKeyinvoiceApiKey, handleSaveKeyInvoice,
  } = props;

  const isConfigured = (key: IntegrationKey): boolean => {
    switch (key) {
      case 'webhook': return webhooks.length > 0;
      case 'webhook_inbound': return true; // Always configured (auto-generated token)
      case 'whatsapp': return !!(whatsappBaseUrl && whatsappInstance && whatsappApiKey);
      case 'brevo': return !!(brevoApiKey && brevoSenderEmail);
      case 'invoicexpress': return !!(invoiceXpressAccountName && invoiceXpressApiKey);
      case 'keyinvoice': return !!keyinvoiceApiKey;
    }
  };

  const getBadge = (key: string, configured: boolean) => {
    if (integrationsEnabled[key] === false) {
      return <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border text-[10px]">Desativado</Badge>;
    }
    if (configured) {
      return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px]">Configurado</Badge>;
    }
    return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px]">Não configurado</Badge>;
  };

  const activeIntegration = integrations.find(i => i.key === active);

  if (!active) {
    return (
      <div className="max-w-4xl">
        <div className="mb-4 p-4 rounded-lg bg-muted/50 border">
          <p className="text-sm text-muted-foreground">
            💡 <strong>Dica:</strong> Os modelos de mensagem, regras de IA e Meta Pixels são agora configurados individualmente em cada formulário.
          </p>
        </div>
        <div className="space-y-6">
          {integrationGroups.map((group) => {
            const items = integrations.filter(i => i.group === group);
            return (
              <div key={group}>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">{group}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((item) => (
                    <IntegrationCard
                      key={item.key}
                      icon={item.icon}
                      title={item.title}
                      description={item.description}
                      badge={getBadge(item.toggleKey, isConfigured(item.key))}
                      onClick={() => setActive(item.key)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <button
        onClick={() => setActive(null)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {activeIntegration && (
            <div className="rounded-md bg-primary/10 p-2">
              <activeIntegration.icon className="h-5 w-5 text-primary" />
            </div>
          )}
          <div>
            <h3 className="font-medium">{activeIntegration?.title}</h3>
            <p className="text-xs text-muted-foreground">{activeIntegration?.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getBadge(active, isConfigured(active))}
          <Switch
            checked={active === 'keyinvoice' ? integrationsEnabled.keyinvoice === true : integrationsEnabled[active] !== false}
            onCheckedChange={(checked) => onToggleIntegration(active, checked)}
          />
        </div>
      </div>

      {isLoadingIntegrations ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">A carregar...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {active === 'webhook' && <WebhooksManager />}
          {active === 'webhook_inbound' && <InboundWebhookSection />}
          {active === 'whatsapp' && <WhatsAppForm {...props} />}
          {active === 'brevo' && <BrevoForm {...props} />}
          {active === 'invoicexpress' && <InvoiceXpressForm {...props} />}
          {active === 'keyinvoice' && <KeyInvoiceForm {...props} />}
        </div>
      )}
    </div>
  );
};

// --- Webhooks Manager (replaces single URL input) ---

function WebhooksManager() {
  const { data: webhooks = [], isLoading } = useOrganizationWebhooks();
  const createWebhook = useCreateWebhook();
  const toggleWebhook = useToggleWebhook();
  const deleteWebhook = useDeleteWebhook();
  const testWebhook = useTestWebhook();

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);

  const isValidUrl = (url: string) => {
    if (!url) return false;
    try { new URL(url); return true; } catch { return false; }
  };

  const handleAdd = () => {
    if (!newName.trim() || !isValidUrl(newUrl)) return;
    createWebhook.mutate({ name: newName.trim(), url: newUrl.trim() }, {
      onSuccess: () => { setNewName(''); setNewUrl(''); setIsAdding(false); },
    });
  };

  const handleTest = (webhook: OrganizationWebhook) => {
    setTestingId(webhook.id);
    testWebhook.mutate(webhook.url, {
      onSettled: () => setTestingId(null),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">A carregar webhooks...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
        <h4 className="font-medium text-sm text-blue-900 dark:text-blue-300 mb-1">🔗 O que são Webhooks?</h4>
        <p className="text-sm text-blue-600 dark:text-blue-400">
          Webhooks permitem notificar automaticamente sistemas externos (como CRMs, ferramentas de automação ou o n8n) sempre que um novo lead é registado. Cada webhook configurado recebe um pedido HTTP POST com os dados do lead em tempo real, permitindo integrar o Senvia OS com qualquer plataforma.
        </p>
      </div>

      {/* Webhook list */}
      {webhooks.length > 0 && (
        <div className="space-y-2">
          {webhooks.map((wh) => (
            <div key={wh.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{wh.name}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">{wh.url}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleTest(wh)}
                  disabled={testingId === wh.id || !wh.is_active}
                  className="text-xs"
                >
                  {testingId === wh.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                </Button>
                <Switch
                  checked={wh.is_active}
                  onCheckedChange={(checked) => toggleWebhook.mutate({ id: wh.id, is_active: checked })}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteWebhook.mutate(wh.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {webhooks.length === 0 && !isAdding && (
        <div className="text-center py-8 text-muted-foreground">
          <Webhook className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum webhook configurado</p>
        </div>
      )}

      {/* Add form */}
      {isAdding ? (
        <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
          <div className="space-y-2">
            <Label htmlFor="wh-name">Nome</Label>
            <Input id="wh-name" placeholder="Ex: Notificação CRM" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wh-url">URL</Label>
            <Input id="wh-url" type="url" placeholder="https://..." value={newUrl} onChange={(e) => setNewUrl(e.target.value)} className={newUrl && !isValidUrl(newUrl) ? 'border-destructive' : ''} />
            {newUrl && !isValidUrl(newUrl) && <p className="text-xs text-destructive">URL inválido</p>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={!newName.trim() || !isValidUrl(newUrl) || createWebhook.isPending}>
              {createWebhook.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Guardar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setIsAdding(false); setNewName(''); setNewUrl(''); }}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setIsAdding(true)} className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Webhook
        </Button>
      )}
    </div>
  );
}

// --- Inbound Webhook (Zapier/Make) ---

function InboundWebhookSection() {
  const { organization } = useAuth();
  const [copied, setCopied] = useState(false);
  const [webhookToken, setWebhookToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch webhook_token from organization
  import('react').then(({ useEffect: _useEffect }) => {});
  
  // Using a proper pattern - fetch on mount
  const fetchToken = async () => {
    if (!organization?.id) return;
    const { supabase } = await import('@/integrations/supabase/client');
    const { data } = await supabase
      .from('organizations')
      .select('webhook_token')
      .eq('id', organization.id)
      .single();
    setWebhookToken((data as any)?.webhook_token || null);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useState(() => { fetchToken(); });

  const webhookUrl = webhookToken
    ? `https://zppcobirzgpfcrnxznwe.supabase.co/functions/v1/submit-lead?mode=webhook&token=${webhookToken}`
    : '';

  const handleCopy = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">A carregar...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
        <h4 className="font-medium text-sm mb-1">🔗 Receber leads de fontes externas</h4>
        <p className="text-sm text-muted-foreground">
          Use este URL para receber leads automaticamente do <strong>Zapier</strong>, <strong>Make (Integromat)</strong>, ou qualquer outra plataforma de automação. Ideal para integrar com <strong>Facebook Lead Ads</strong>, Google Forms, etc.
        </p>
      </div>

      <div className="space-y-2">
        <Label>URL do Webhook</Label>
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={webhookUrl}
            className="text-xs font-mono bg-muted"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="shrink-0"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Cole este URL como destino do webhook no Zapier ou Make.</p>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <h4 className="font-medium text-sm">📋 Como configurar no Zapier</h4>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>Crie um novo Zap com o trigger <strong>"Facebook Lead Ads → New Lead"</strong></li>
          <li>Adicione a ação <strong>"Webhooks by Zapier → POST"</strong></li>
          <li>Cole o URL acima no campo <strong>"URL"</strong></li>
          <li>Em <strong>"Payload Type"</strong>, selecione <strong>"JSON"</strong></li>
          <li>Mapeie os campos:
            <ul className="ml-4 mt-1 space-y-1 list-disc">
              <li><code className="bg-muted px-1 rounded text-xs">name</code> → Nome completo do lead</li>
              <li><code className="bg-muted px-1 rounded text-xs">email</code> → Email</li>
              <li><code className="bg-muted px-1 rounded text-xs">phone</code> → Telefone</li>
              <li><code className="bg-muted px-1 rounded text-xs">company</code> → Empresa (opcional)</li>
              <li><code className="bg-muted px-1 rounded text-xs">source</code> → Fonte (opcional, ex: "Facebook Ads")</li>
              <li><code className="bg-muted px-1 rounded text-xs">notes</code> → Notas (opcional)</li>
            </ul>
          </li>
          <li>Ative o Zap e teste!</li>
        </ol>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <h4 className="font-medium text-sm">📋 Como configurar no Make</h4>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>Crie um cenário com o módulo <strong>"Facebook Lead Ads → Watch Leads"</strong></li>
          <li>Adicione o módulo <strong>"HTTP → Make a request"</strong></li>
          <li>Método: <strong>POST</strong>, URL: cole o URL acima</li>
          <li>Body type: <strong>JSON</strong></li>
          <li>Mapeie os mesmos campos indicados acima</li>
        </ol>
      </div>

      <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
        <p className="text-sm text-amber-600 dark:text-amber-400">
          ⚠️ <strong>Importante:</strong> Não partilhe este URL publicamente. Ele contém um token de autenticação único da sua organização.
        </p>
      </div>
    </div>
  );
}

// --- Form sub-components ---

function WhatsAppForm({ whatsappBaseUrl, setWhatsappBaseUrl, whatsappInstance, setWhatsappInstance, whatsappApiKey, setWhatsappApiKey, showWhatsappApiKey, setShowWhatsappApiKey, handleSaveWhatsApp, updateOrganizationIsPending }: IntegrationsContentProps) {
  return (
    <>
      <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 space-y-2">
        <p className="text-sm text-blue-600 dark:text-blue-400">
          📩 Atualmente, a integração do WhatsApp Business tem como único propósito enviar uma mensagem de receção ao novo Lead que acabou de subscrever. Exemplo: <em>"Olá, seja bem-vindo! Recebemos os seus dados e em breve um agente vai entrar em contacto."</em>
        </p>
        <p className="text-sm text-blue-600 dark:text-blue-400">
          🚀 Em breve vamos adicionar novas funcionalidades a esta integração.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="whatsapp-base-url">URL do Servidor</Label>
        <Input id="whatsapp-base-url" type="url" placeholder="https://api.senvia.com" value={whatsappBaseUrl} onChange={(e) => setWhatsappBaseUrl(e.target.value)} />
        <p className="text-xs text-muted-foreground">Endereço do seu servidor Evolution API.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="whatsapp-instance">Nome da Instância</Label>
        <Input id="whatsapp-instance" placeholder="nome-da-instancia" value={whatsappInstance} onChange={(e) => setWhatsappInstance(e.target.value)} />
        <p className="text-xs text-muted-foreground">Nome da instância configurada na Evolution API.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="whatsapp-api-key">API Key da Instância</Label>
        <div className="relative">
          <Input id="whatsapp-api-key" type={showWhatsappApiKey ? 'text' : 'password'} placeholder="Chave de autenticação" value={whatsappApiKey} onChange={(e) => setWhatsappApiKey(e.target.value)} />
          <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowWhatsappApiKey(!showWhatsappApiKey)}>
            {showWhatsappApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Chave de autenticação da Evolution API.</p>
      </div>
      <Button onClick={handleSaveWhatsApp} disabled={updateOrganizationIsPending}>
        {updateOrganizationIsPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Guardar
      </Button>
    </>
  );
}

function BrevoForm({ brevoApiKey, setBrevoApiKey, brevoSenderEmail, setBrevoSenderEmail, showBrevoApiKey, setShowBrevoApiKey, handleSaveBrevo, updateOrganizationIsPending }: IntegrationsContentProps) {
  return (
    <>
      <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
        <p className="text-sm text-amber-600 dark:text-amber-400">O email remetente deve estar verificado na sua conta Brevo para o envio funcionar.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="brevo-sender-email">Email Remetente</Label>
        <Input id="brevo-sender-email" type="email" placeholder="comercial@minhaempresa.pt" value={brevoSenderEmail} onChange={(e) => setBrevoSenderEmail(e.target.value)} />
        <p className="text-xs text-muted-foreground">Email verificado no Brevo que aparecerá como remetente.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="brevo-api-key">API Key do Brevo</Label>
        <div className="relative">
          <Input id="brevo-api-key" type={showBrevoApiKey ? 'text' : 'password'} placeholder="xkeysib-..." value={brevoApiKey} onChange={(e) => setBrevoApiKey(e.target.value)} />
          <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowBrevoApiKey(!showBrevoApiKey)}>
            {showBrevoApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Encontre a sua API Key em Brevo → Definições → API Keys.</p>
      </div>
      <div className="space-y-2">
        <Label>Webhook URL (Tracking)</Label>
        <div className="flex items-center gap-2">
          <Input readOnly value="https://zppcobirzgpfcrnxznwe.supabase.co/functions/v1/brevo-webhook" className="text-xs font-mono bg-muted" />
          <Button type="button" variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText("https://zppcobirzgpfcrnxznwe.supabase.co/functions/v1/brevo-webhook"); }}>
            Copiar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Cole este URL no painel do Brevo → Definições → Webhooks para ativar tracking de entregas, aberturas e cliques.</p>
      </div>
      <Button onClick={handleSaveBrevo} disabled={updateOrganizationIsPending}>
        {updateOrganizationIsPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Guardar
      </Button>
    </>
  );
}

function InvoiceXpressForm({ invoiceXpressAccountName, setInvoiceXpressAccountName, invoiceXpressApiKey, setInvoiceXpressApiKey, showInvoiceXpressApiKey, setShowInvoiceXpressApiKey, handleSaveInvoiceXpress, updateOrganizationIsPending }: IntegrationsContentProps) {
  return (
    <>
      <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
        <p className="text-sm text-amber-600 dark:text-amber-400">Encontre estas credenciais em InvoiceXpress → Conta → Integrações → API.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ix-account-name">Account Name</Label>
        <Input id="ix-account-name" placeholder="minhaempresa" value={invoiceXpressAccountName} onChange={(e) => setInvoiceXpressAccountName(e.target.value)} />
        <p className="text-xs text-muted-foreground">Subdomínio da sua conta InvoiceXpress (ex: minhaempresa.app.invoicexpress.com).</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ix-api-key">API Key</Label>
        <div className="relative">
          <Input id="ix-api-key" type={showInvoiceXpressApiKey ? 'text' : 'password'} placeholder="Chave de autenticação" value={invoiceXpressApiKey} onChange={(e) => setInvoiceXpressApiKey(e.target.value)} />
          <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowInvoiceXpressApiKey(!showInvoiceXpressApiKey)}>
            {showInvoiceXpressApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Chave de autenticação da API InvoiceXpress.</p>
      </div>
      <Button onClick={handleSaveInvoiceXpress} disabled={updateOrganizationIsPending}>
        {updateOrganizationIsPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Guardar
      </Button>
    </>
  );
}

function KeyInvoiceForm({ keyinvoiceApiKey, setKeyinvoiceApiKey, keyinvoiceApiUrl, setKeyinvoiceApiUrl, showKeyinvoiceApiKey, setShowKeyinvoiceApiKey, handleSaveKeyInvoice, updateOrganizationIsPending }: IntegrationsContentProps) {
  return (
    <>
      <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
        <p className="text-sm text-blue-600 dark:text-blue-400">Introduza a Chave da API 5.0 do seu painel KeyInvoice.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ki-api-key">Chave da API</Label>
        <div className="relative">
          <Input id="ki-api-key" type={showKeyinvoiceApiKey ? 'text' : 'password'} placeholder="Chave da API KeyInvoice" value={keyinvoiceApiKey} onChange={(e) => setKeyinvoiceApiKey(e.target.value)} />
          <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowKeyinvoiceApiKey(!showKeyinvoiceApiKey)}>
            {showKeyinvoiceApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Encontre a sua Chave em KeyInvoice → Painel → API 5.0 REST.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ki-api-url">URL da API</Label>
        <Input id="ki-api-url" type="url" placeholder="https://login.keyinvoice.com/API5.php" value={keyinvoiceApiUrl} onChange={(e) => setKeyinvoiceApiUrl(e.target.value)} />
        <p className="text-xs text-muted-foreground">Endereço base da API KeyInvoice. Deixe em branco para usar o valor padrão.</p>
      </div>
      <Button onClick={handleSaveKeyInvoice} disabled={updateOrganizationIsPending}>
        {updateOrganizationIsPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Guardar
      </Button>
    </>
  );
}
