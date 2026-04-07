import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAuth } from "@/contexts/AuthContext";
import { useUpdateOrganization } from '@/hooks/useOrganization';
import { SecuritySettings } from '@/components/settings/SecuritySettings';
import { useUpdateProfile, useChangePassword } from '@/hooks/useProfile';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { ArrowLeft } from "lucide-react";
import { PipelineEditor } from '@/components/settings/PipelineEditor';
import { ProductsTab } from '@/components/settings/ProductsTab';
import { ModulesTab } from '@/components/settings/ModulesTab';
import { supabase } from '@/integrations/supabase/client';
import { TeamTab } from '@/components/settings/TeamTab';
import { TeamsSection } from '@/components/settings/TeamsSection';
import { FormsManager } from '@/components/settings/FormsManager';
import { GeneralContent } from '@/components/settings/GeneralContent';
import { IntegrationsContent } from '@/components/settings/IntegrationsContent';
import { FieldsManagerTabs } from '@/components/settings/FieldsManagerTabs';
import { FidelizationAlertsSettings } from '@/components/settings/FidelizationAlertsSettings';
import { CalendarAlertsSettings } from '@/components/settings/CalendarAlertsSettings';
import { NotificationEmailSettings } from '@/components/settings/NotificationEmailSettings';
import { ExpenseCategoriesTab } from '@/components/settings/ExpenseCategoriesTab';
import { FiscalSettingsTab } from '@/components/settings/FiscalSettingsTab';
import { SalesSettingsTab } from '@/components/settings/SalesSettingsTab';
import { CommissionMatrixTab } from '@/components/settings/CommissionMatrixTab';
import { PushNotificationsCard } from '@/components/settings/PushNotificationsCard';
import { BillingTab } from '@/components/settings/BillingTab';
import { SupportTicketsTab } from '@/components/settings/SupportTicketsTab';

import { ProfilesTab } from '@/components/settings/ProfilesTab';
import { 
  MobileSettingsNav, 
  MobileSubSectionNav, 
  SettingsSection, 
  SettingsSubSection,
  subSectionsMap,
  directContentGroups,
  sectionTitles 
} from '@/components/settings/MobileSettingsNav';

export default function Settings() {
  const { profile, organization } = useAuth();
  const { toast } = useToast();
  const updateOrganization = useUpdateOrganization();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const { canManageTeam, canManageIntegrations, isAdmin } = usePermissions();
  const pushNotifications = usePushNotifications();

  // Unified navigation state (3 levels) for both mobile and desktop
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeGroup, setActiveGroup] = useState<SettingsSection | null>(null);
  const [activeSub, setActiveSub] = useState<SettingsSubSection | null>(null);

  // Auto-navigate to billing tab if ?tab=billing is present
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'billing') {
      setActiveGroup('billing');
      setActiveSub('billing');
      setSearchParams({}, { replace: true });
    }
  }, []);

  
  const [isLoadingIntegrations, setIsLoadingIntegrations] = useState(true);
  
  // WhatsApp Business state
  const [whatsappBaseUrl, setWhatsappBaseUrl] = useState('');
  const [whatsappInstance, setWhatsappInstance] = useState('');
  const [whatsappApiKey, setWhatsappApiKey] = useState('');
  const [showWhatsappApiKey, setShowWhatsappApiKey] = useState(false);
  
  // Brevo Email state
  const [brevoApiKey, setBrevoApiKey] = useState('');
  const [brevoSenderEmail, setBrevoSenderEmail] = useState('');
  const [showBrevoApiKey, setShowBrevoApiKey] = useState(false);
  
  // InvoiceXpress state
  const [invoiceXpressAccountName, setInvoiceXpressAccountName] = useState('');
  const [invoiceXpressApiKey, setInvoiceXpressApiKey] = useState('');
  const [showInvoiceXpressApiKey, setShowInvoiceXpressApiKey] = useState(false);
  const [taxRate, setTaxRate] = useState('23');
  const [taxExemptionReason, setTaxExemptionReason] = useState('');
  

  // KeyInvoice state
  const [keyinvoiceApiKey, setKeyinvoiceApiKey] = useState('');
  const [keyinvoiceApiUrl, setKeyinvoiceApiUrl] = useState('');
  const [showKeyinvoiceApiKey, setShowKeyinvoiceApiKey] = useState(false);

  // Integrations enabled state
  const [integrationsEnabled, setIntegrationsEnabled] = useState<Record<string, boolean>>({
    webhook: true, whatsapp: true, brevo: true, invoicexpress: true, keyinvoice: false,
  });

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Organization edit state
  const [orgName, setOrgName] = useState('');
  
  // Profile edit state
  const [fullName, setFullName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [emailSignature, setEmailSignature] = useState('');
  const [profileBrevoSenderEmail, setProfileBrevoSenderEmail] = useState('');

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);


  // Initialize editable fields
  useEffect(() => {
    if (organization?.name) setOrgName(organization.name);
  }, [organization?.name]);

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
    setProfileEmail((profile as any)?.email || '');
    setProfilePhone((profile as any)?.phone || '');
    setEmailSignature((profile as any)?.email_signature || '');
    setProfileBrevoSenderEmail((profile as any)?.brevo_sender_email || '');
  }, [profile?.full_name, (profile as any)?.email, (profile as any)?.phone, (profile as any)?.email_signature, (profile as any)?.brevo_sender_email]);

  // Fetch current integrations data
  useEffect(() => {
    async function fetchIntegrations() {
      if (!organization?.id) return;
      
      setIsLoadingIntegrations(true);
      const { data, error } = await supabase
        .from('organizations')
        .select('webhook_url, whatsapp_base_url, whatsapp_instance, whatsapp_api_key, form_settings, brevo_api_key, brevo_sender_email, invoicexpress_account_name, invoicexpress_api_key, integrations_enabled, tax_config, billing_provider, keyinvoice_username, keyinvoice_password, keyinvoice_company_code, keyinvoice_api_url')
        .eq('id', organization.id)
        .single();
      
      if (!error && data) {
        setWhatsappBaseUrl(data.whatsapp_base_url || '');
        setWhatsappInstance(data.whatsapp_instance || '');
        setWhatsappApiKey(data.whatsapp_api_key || '');
        setBrevoApiKey(data.brevo_api_key || '');
        setBrevoSenderEmail(data.brevo_sender_email || '');
        setInvoiceXpressAccountName((data as any).invoicexpress_account_name || '');
        setInvoiceXpressApiKey((data as any).invoicexpress_api_key || '');
        setKeyinvoiceApiKey((data as any).keyinvoice_password || '');
        setKeyinvoiceApiUrl((data as any).keyinvoice_api_url || '');

        const tc = (data as any).tax_config;
        if (tc) {
          setTaxRate(String(tc.tax_value ?? 23));
          setTaxExemptionReason(tc.tax_exemption_reason || '');
        }

        if ((data as any).integrations_enabled) {
          setIntegrationsEnabled({
            webhook: true, whatsapp: true, brevo: true, invoicexpress: true, keyinvoice: false,
            ...((data as any).integrations_enabled as Record<string, boolean>),
          });
        }
        
      }
      setIsLoadingIntegrations(false);
    }

    fetchIntegrations();
  }, [organization?.id, refreshTrigger]);

  const handleToggleIntegration = async (key: string, enabled: boolean) => {
    let newState = { ...integrationsEnabled, [key]: enabled };
    if (enabled && key === 'invoicexpress') newState.keyinvoice = false;
    else if (enabled && key === 'keyinvoice') newState.invoicexpress = false;
    setIntegrationsEnabled(newState);
    
    let billingProviderValue: string | undefined;
    if (key === 'invoicexpress' || key === 'keyinvoice') {
      if (newState.invoicexpress) billingProviderValue = 'invoicexpress';
      else if (newState.keyinvoice) billingProviderValue = 'keyinvoice';
    }
    
    if (organization?.id) {
      const updateData: Record<string, any> = { integrations_enabled: newState };
      if (billingProviderValue !== undefined) updateData.billing_provider = billingProviderValue;
      await supabase.from('organizations').update(updateData).eq('id', organization.id);
    }
  };


  const handleSaveWhatsApp = () => {
    updateOrganization.mutate({
      whatsapp_base_url: whatsappBaseUrl.trim() || null,
      whatsapp_instance: whatsappInstance.trim() || null,
      whatsapp_api_key: whatsappApiKey.trim() || null,
    });
  };

  const handleSaveBrevo = () => {
    updateOrganization.mutate({
      brevo_api_key: brevoApiKey.trim() || null,
      brevo_sender_email: brevoSenderEmail.trim() || null,
    });
  };

  const handleSaveInvoiceXpress = () => {
    updateOrganization.mutate({
      invoicexpress_account_name: invoiceXpressAccountName.trim() || null,
      invoicexpress_api_key: invoiceXpressApiKey.trim() || null,
    });
  };

  const handleSaveKeyInvoice = () => {
    updateOrganization.mutate({
      keyinvoice_password: keyinvoiceApiKey.trim() || null,
      keyinvoice_api_url: keyinvoiceApiUrl.trim() || null,
    });
  };

  const handleSaveFiscal = () => {
    const taxValue = Number(taxRate);
    const taxName = taxValue === 0 ? 'Isento' : `IVA${taxValue}`;
    updateOrganization.mutate({
      tax_config: { tax_name: taxName, tax_value: taxValue, tax_exemption_reason: taxValue === 0 ? taxExemptionReason : null },
    });
  };

  const handleSaveOrgName = () => {
    if (!orgName.trim()) {
      toast({ title: 'Nome inválido', description: 'O nome da organização não pode estar vazio.', variant: 'destructive' });
      return;
    }
    updateOrganization.mutate({ name: orgName.trim() });
  };

  const handleSaveProfile = () => {
    if (!fullName.trim()) {
      toast({ title: 'Nome inválido', description: 'O nome não pode estar vazio.', variant: 'destructive' });
      return;
    }
    updateProfile.mutate({ full_name: fullName.trim(), email: profileEmail, phone: profilePhone, email_signature: emailSignature, brevo_sender_email: profileBrevoSenderEmail });
  };

  const handleChangePassword = () => {
    if (!newPassword || !confirmPassword) {
      toast({ title: 'Campos em falta', description: 'Preencha ambos os campos de password.', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: 'Password muito curta', description: 'A password deve ter pelo menos 6 caracteres.', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Passwords não coincidem', description: 'As passwords introduzidas não são iguais.', variant: 'destructive' });
      return;
    }
    changePassword.mutate({ newPassword }, {
      onSuccess: () => { setNewPassword(''); setConfirmPassword(''); setShowPassword(false); }
    });
  };

  // Shared props
  const generalContentProps = {
    organization, profile, isAdmin, orgName, setOrgName, fullName, setFullName,
    profileEmail, setProfileEmail, profilePhone, setProfilePhone,
    emailSignature, setEmailSignature,
    brevoSenderEmail: profileBrevoSenderEmail, setBrevoSenderEmail: setProfileBrevoSenderEmail,
    handleSaveOrgName, handleSaveProfile,
    updateOrganizationIsPending: updateOrganization.isPending,
    updateProfileIsPending: updateProfile.isPending,
  };

  const integrationsContentProps = {
    isLoadingIntegrations,
    updateOrganizationIsPending: updateOrganization.isPending,
    whatsappBaseUrl, setWhatsappBaseUrl, whatsappInstance, setWhatsappInstance,
    whatsappApiKey, setWhatsappApiKey, showWhatsappApiKey, setShowWhatsappApiKey,
    handleSaveWhatsApp, brevoApiKey, setBrevoApiKey, brevoSenderEmail, setBrevoSenderEmail,
    showBrevoApiKey, setShowBrevoApiKey, handleSaveBrevo,
    invoiceXpressAccountName, setInvoiceXpressAccountName,
    invoiceXpressApiKey, setInvoiceXpressApiKey,
    showInvoiceXpressApiKey, setShowInvoiceXpressApiKey,
    handleSaveInvoiceXpress,
    integrationsEnabled, onToggleIntegration: handleToggleIntegration,
    handleSaveKeyInvoice, keyinvoiceApiKey, setKeyinvoiceApiKey,
    showKeyinvoiceApiKey, setShowKeyinvoiceApiKey, keyinvoiceApiUrl, setKeyinvoiceApiUrl,
  };

  // Render individual sub-section content
  const renderSubContent = (sub: SettingsSubSection) => {
    switch (sub) {
      case "org-general": return <GeneralContent {...generalContentProps} />;
      case "org-pipeline": return <PipelineEditor />;
      case "org-modules": return <ModulesTab />;
      case "org-forms": return <FormsManager />;
      case "org-fields": return <FieldsManagerTabs />;
      case "org-sales": return <SalesSettingsTab />;
      case "org-matrix": return <CommissionMatrixTab />;
      case "security": return (
        <SecuritySettings
          newPassword={newPassword} setNewPassword={setNewPassword}
          confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
          showPassword={showPassword} setShowPassword={setShowPassword}
          handleChangePassword={handleChangePassword}
          changePasswordIsPending={changePassword.isPending}
        />
      );
      case "team-access": return <TeamTab />;
      case "team-profiles": return <ProfilesTab />;
      case "team-teams": return <TeamsSection />;
      case "products": return <ProductsTab />;
      case "finance-expenses": return <ExpenseCategoriesTab />;
      case "finance-fiscal": return (
        <FiscalSettingsTab
          taxRate={taxRate}
          setTaxRate={setTaxRate}
          taxExemptionReason={taxExemptionReason}
          setTaxExemptionReason={setTaxExemptionReason}
          onSave={handleSaveFiscal}
          isPending={updateOrganization.isPending}
        />
      );
      case "notif-push": return <PushNotificationsCard organizationId={organization?.id} pushNotifications={pushNotifications} />;
      case "notif-calendar": return <CalendarAlertsSettings />;
      case "notif-email": return <NotificationEmailSettings />;
      case "notif-alerts": return <FidelizationAlertsSettings />;
      case "integrations": return <IntegrationsContent {...integrationsContentProps} />;
      case "billing": return <BillingTab />;
      case "support-tickets": return <SupportTicketsTab />;
      default: return null;
    }
  };

  // Get the direct sub-section for groups with no sub-nav
  const getDirectSub = (group: SettingsSection): SettingsSubSection => {
    switch (group) {
      case "security": return "security";
      case "products": return "products";
      case "integrations": return "integrations";
      case "billing": return "billing";
      case "support": return "support-tickets";
      default: return "security"; // fallback
    }
  };

  // Handle group selection (direct or drill-down)
  const handleGroupSelect = (group: SettingsSection) => {
    setActiveGroup(group);
    if (directContentGroups.includes(group)) {
      setActiveSub(getDirectSub(group));
    } else {
      setActiveSub(null);
    }
  };

  // Back navigation
  const handleBack = () => {
    if (activeSub !== null && !directContentGroups.includes(activeGroup!)) {
      setActiveSub(null);
    } else {
      setActiveGroup(null);
      setActiveSub(null);
    }
  };

  // Breadcrumb title
  const getTitle = () => {
    if (!activeGroup) return "Definições";
    const groupTitle = sectionTitles[activeGroup];
    if (activeSub && !directContentGroups.includes(activeGroup)) {
      const subItems = subSectionsMap[activeGroup];
      const subItem = subItems.find(s => s.id === activeSub);
      return subItem?.label || groupTitle;
    }
    return groupTitle;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
        {activeGroup === null ? (
          // Level 1: Group cards grid
          <>
            <div className="mb-6 sm:mb-8">
              <h1 className="text-2xl font-bold text-foreground">Definições</h1>
              <p className="text-muted-foreground">Configure a sua organização e integrações.</p>
            </div>
            <MobileSettingsNav
              activeSection={null}
              onSelectSection={handleGroupSelect}
              canManageTeam={canManageTeam}
              canManageIntegrations={canManageIntegrations}
              isTelecom={organization?.niche === 'telecom'}
            />
          </>
        ) : activeSub === null ? (
          // Level 2: Sub-section cards grid
          <>
            <div className="flex items-center gap-3 mb-6">
              <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">{sectionTitles[activeGroup]}</h1>
            </div>
            <MobileSubSectionNav
              group={activeGroup}
              onSelectSubSection={(sub) => setActiveSub(sub)}
              isTelecom={organization?.niche === 'telecom'}
            />
          </>
        ) : (
          // Level 3: Content
          <>
            <div className="flex items-center gap-3 mb-6">
              <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">{getTitle()}</h1>
            </div>
            <div className="max-w-4xl">
              {renderSubContent(activeSub)}
            </div>
          </>
        )}
    </div>
  );
}