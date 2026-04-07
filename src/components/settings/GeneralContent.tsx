import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { User, Building, Loader2, Save, Copy, Check, Mail, Eye, EyeOff } from "lucide-react";
import { PLAN_LABELS, OrganizationPlan } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface GeneralContentProps {
  organization: {
    id: string;
    name: string;
    plan: string | null;
    slug?: string;
    trial_ends_at?: string;
    billing_exempt?: boolean;
  } | null;
  profile: {
    full_name: string;
    email?: string | null;
    phone?: string | null;
    brevo_sender_email?: string | null;
  } | null;
  isAdmin: boolean;
  orgName: string;
  setOrgName: (value: string) => void;
  fullName: string;
  setFullName: (value: string) => void;
  profileEmail: string;
  setProfileEmail: (value: string) => void;
  profilePhone: string;
  setProfilePhone: (value: string) => void;
  emailSignature: string;
  setEmailSignature: (value: string) => void;
  brevoSenderEmail: string;
  setBrevoSenderEmail: (value: string) => void;
  handleSaveOrgName: () => void;
  handleSaveProfile: () => void;
  updateOrganizationIsPending: boolean;
  updateProfileIsPending: boolean;
}

export const GeneralContent = ({
  organization,
  profile,
  isAdmin,
  orgName,
  setOrgName,
  fullName,
  setFullName,
  profileEmail,
  setProfileEmail,
  profilePhone,
  setProfilePhone,
  emailSignature,
  setEmailSignature,
  brevoSenderEmail,
  setBrevoSenderEmail,
  handleSaveOrgName,
  handleSaveProfile,
  updateOrganizationIsPending,
  updateProfileIsPending,
}: GeneralContentProps) => {
  const { toast } = useToast();
  const [copiedSlug, setCopiedSlug] = useState(false);
  const [showSignaturePreview, setShowSignaturePreview] = useState(false);

  const isOnTrial = (() => {
    if (!organization) return false;
    if (organization.billing_exempt) return false;
    if (!organization.trial_ends_at) return false;
    return new Date(organization.trial_ends_at).getTime() > Date.now();
  })();

  const handleCopySlug = async () => {
    if (!organization?.slug) return;
    try {
      await navigator.clipboard.writeText(organization.slug);
      setCopiedSlug(true);
      toast({ title: 'Copiado!', description: 'Código da empresa copiado para a área de transferência.' });
      setTimeout(() => setCopiedSlug(false), 2000);
    } catch (err) {
      toast({ title: 'Erro', description: 'Não foi possível copiar.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5" />Organização</CardTitle>
          <CardDescription>Informações da sua organização.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="org-name">Nome</Label>
              {isAdmin ? (
                <div className="flex gap-2">
                  <Input
                    id="org-name"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Nome da organização"
                  />
                  <Button
                    size="icon"
                    onClick={handleSaveOrgName}
                    disabled={updateOrganizationIsPending || orgName === organization?.name}
                  >
                    {updateOrganizationIsPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </Button>
                </div>
              ) : (
                <p className="text-foreground font-medium">{organization?.name || '-'}</p>
              )}
            </div>
            <div>
              <Label>Plano</Label>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={isOnTrial ? 'outline' : (organization?.plan === 'elite' || organization?.plan === 'pro' ? 'default' : 'secondary')}>
                  {isOnTrial ? 'Trial' : (organization?.plan ? PLAN_LABELS[organization.plan as OrganizationPlan] : 'Starter')}
                </Badge>
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <Label htmlFor="org-slug">Código da Empresa</Label>
            <div className="flex gap-2">
              <Input
                id="org-slug"
                value={organization?.slug || ''}
                readOnly
                className="bg-muted font-mono"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopySlug}
                disabled={!organization?.slug}
              >
                {copiedSlug ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Partilhe este código para convidar colaboradores para a sua empresa.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />A Minha Conta</CardTitle>
          <CardDescription>Edite as suas informações pessoais.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="full-name">Nome Completo</Label>
            <Input
              id="full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="O seu nome"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-email">Email de contacto</Label>
              <Input
                id="profile-email"
                type="email"
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-phone">Telefone</Label>
              <Input
                id="profile-phone"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                placeholder="+351 900 000 000"
              />
           </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="brevo-sender-email">Email de envio (Brevo)</Label>
            <Input
              id="brevo-sender-email"
              type="email"
              value={brevoSenderEmail}
              onChange={(e) => setBrevoSenderEmail(e.target.value)}
              placeholder="o-seu-email@dominio.com"
            />
            <p className="text-xs text-muted-foreground">
              Se configurado, os emails que enviar serão remetidos a partir deste endereço (deve estar verificado na Brevo). Caso contrário, será usado o email da organização.
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="email-signature" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Assinatura de Email
              </Label>
              {emailSignature && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSignaturePreview(!showSignaturePreview)}
                >
                  {showSignaturePreview ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                  {showSignaturePreview ? 'Editar' : 'Preview'}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Esta assinatura será automaticamente anexada a todos os emails que enviar (templates, marketing, leads).
            </p>
            {showSignaturePreview ? (
              <div
                className="border rounded-md p-4 bg-background min-h-[80px]"
                dangerouslySetInnerHTML={{ __html: emailSignature }}
              />
            ) : (
              <Textarea
                id="email-signature"
                value={emailSignature}
                onChange={(e) => setEmailSignature(e.target.value)}
                placeholder="Cole aqui a sua assinatura HTML (ex: nome, cargo, telefone, logo...)"
                rows={6}
                className="font-mono text-xs"
              />
            )}
          </div>

          <Button
            onClick={handleSaveProfile}
            disabled={updateProfileIsPending || (fullName === profile?.full_name && profileEmail === (profile?.email || '') && profilePhone === (profile?.phone || '') && emailSignature === ((profile as any)?.email_signature || '') && brevoSenderEmail === (profile?.brevo_sender_email || ''))}
            className="w-full sm:w-auto"
          >
            {updateProfileIsPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar perfil
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />GDPR</CardTitle>
          <CardDescription>Informações sobre proteção de dados.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Todos os leads registados nesta plataforma consentiram explicitamente o tratamento dos seus dados pessoais para fins comerciais, conforme exigido pelo RGPD. Os dados são armazenados de forma segura e podem ser eliminados a pedido do titular.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
