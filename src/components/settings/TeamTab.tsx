import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTeamMembers, usePendingInvites, useCancelInvite, useResendInvite, useCreateTeamMember, PendingInvite, TeamMember } from '@/hooks/useTeam';
import { useManageTeamMember } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizationProfiles } from '@/hooks/useOrganizationProfiles';
import { useOrganization } from '@/hooks/useOrganization';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Users, UserPlus, Copy, X, Check, Clock, Loader2, RefreshCw, Eye, EyeOff, MoreHorizontal, Key, UserCog, Ban, CheckCircle, Mail, Pencil, Phone, Trash2, Bell } from 'lucide-react';

import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import { getBaseUrl } from '@/lib/constants';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  viewer: 'Visualizador',
  salesperson: 'Comercial',
  super_admin: 'Super Admin',
};

const ROLE_VARIANTS: Record<string, 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  viewer: 'secondary',
  salesperson: 'secondary',
  super_admin: 'default',
};

export function TeamTab() {
  const { user, organization, isSuperAdmin } = useAuth();
  const { data: orgData } = useOrganization();
  const queryClient = useQueryClient();
  const { data: allMembers, isLoading: loadingMembers } = useTeamMembers();
  // Super admins só visíveis para outros super admins
  const members = isSuperAdmin ? allMembers : allMembers?.filter(m => m.role !== 'super_admin');
  const { data: invites, isLoading: loadingInvites } = usePendingInvites();
  const { profiles } = useOrganizationProfiles();
  const cancelInvite = useCancelInvite();
  const resendInvite = useResendInvite();
  const createTeamMember = useCreateTeamMember();
  const manageTeamMember = useManageTeamMember();
  const { toast } = useToast();

  const salesSettings = (orgData?.sales_settings as any) || {};
  const commissionsEnabled = !!salesSettings.commissions_enabled;
  const globalRate = salesSettings.commission_percentage;
  const showIndividualCommission = commissionsEnabled && (!globalRate || globalRate <= 0);

  // Modal state - Add member
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [accessSystem, setAccessSystem] = useState<'p2g' | 'total_link'>('p2g');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('salesperson');
  const [showPassword, setShowPassword] = useState(false);
  const [newNotificationEmail, setNewNotificationEmail] = useState('');
  const [newNotifPrefs, setNewNotifPrefs] = useState({ calendar: true, email: true, fidelization: true });

  // Filter profiles by selected system
  const filteredProfiles = profiles.filter(p => (p.systems || ['p2g']).includes(accessSystem));
  
  // Success state
  const [createdMember, setCreatedMember] = useState<{ email: string; password: string; fullName: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  
  // Invite list state
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  // Change password modal state
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [memberNewPassword, setMemberNewPassword] = useState('');
  const [memberConfirmPassword, setMemberConfirmPassword] = useState('');
  const [showMemberPassword, setShowMemberPassword] = useState(false);

  // Change role modal state
  const [changeRoleOpen, setChangeRoleOpen] = useState(false);
  const [newRole, setNewRole] = useState('salesperson');
  const [editSystem, setEditSystem] = useState<'p2g' | 'total_link'>('p2g');

  // Edit profile modal state
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCommissionRate, setEditCommissionRate] = useState('');
  const [editNotificationEmail, setEditNotificationEmail] = useState('');
  const [editNotifPrefs, setEditNotifPrefs] = useState({ calendar: true, email: true, fidelization: true });

  // Send access email modal state
  const [sendAccessOpen, setSendAccessOpen] = useState(false);
  const [sendingAccessEmail, setSendingAccessEmail] = useState(false);

  // Delete member confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);

  const handleCreateMember = async () => {
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: 'As palavras-passe não coincidem', variant: 'destructive' });
      return;
    }

    if (password.length < 6) {
      toast({ title: 'A palavra-passe deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }

    const selectedProfile = profiles.find(p => p.id === role);
    const resolvedRole = selectedProfile?.base_role || role;
    createTeamMember.mutate(
      { email, password, fullName, role: resolvedRole as 'admin' | 'viewer' | 'salesperson', profileId: selectedProfile?.id },
      {
        onSuccess: async (data) => {
          // Save notification preferences on the new member record
          if (organization?.id && data?.user_id) {
            await supabase
              .from('organization_members')
              .update({
                notification_email: newNotificationEmail.trim() || null,
                notification_preferences: newNotifPrefs,
              } as any)
              .eq('user_id', data.user_id)
              .eq('organization_id', organization.id);
          }
          setCreatedMember({ email, password, fullName });
        },
      }
    );
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast({ title: 'Copiado!', description: `${field} copiado para a área de transferência.` });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyInviteLink = (invite: PendingInvite) => {
    const link = `${getBaseUrl()}/invite/${invite.token}`;
    navigator.clipboard.writeText(link);
    setCopiedInviteId(invite.id);
    toast({ title: 'Link copiado!', description: 'Link de convite copiado para a área de transferência.' });
    setTimeout(() => setCopiedInviteId(null), 2000);
  };

  const handleResendInvite = (invite: PendingInvite) => {
    resendInvite.mutate(invite.id);
  };

  const handleCloseDialog = () => {
    setIsAddOpen(false);
    setAccessSystem('p2g');
    setFullName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setRole('salesperson');
    setShowPassword(false);
    setCreatedMember(null);
    setCopiedField(null);
    setSendingEmail(false);
    setEmailSent(false);
    setNewNotificationEmail('');
    setNewNotifPrefs({ calendar: true, email: true, fidelization: true });
  };

  const handleSendAccessEmail = async () => {
    if (!createdMember || !organization) return;
    
    setSendingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-access-email', {
        body: {
          organizationId: organization.id,
          recipientEmail: createdMember.email,
          recipientName: createdMember.fullName,
          loginUrl,
          password: createdMember.password,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setEmailSent(true);
      toast({ title: 'Email enviado!', description: `Credenciais enviadas para ${createdMember.email}.` });
    } catch (err: any) {
      toast({ 
        title: 'Erro ao enviar email', 
        description: err.message || 'Verifique se a integração Brevo está configurada.', 
        variant: 'destructive' 
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCancelInvite = (invite: PendingInvite) => {
    cancelInvite.mutate(invite.id);
  };

  // Member management handlers
  const openChangePasswordModal = (member: TeamMember) => {
    setSelectedMember(member);
    setMemberNewPassword('');
    setMemberConfirmPassword('');
    setShowMemberPassword(false);
    setChangePasswordOpen(true);
  };

  const editSystemProfiles = profiles.filter(p => (p.systems || ['p2g']).includes(editSystem));

  const openChangeRoleModal = (member: TeamMember) => {
    setSelectedMember(member);
    // Pre-select current profile by profile_id or fallback to role
    const currentProfileId = member.profile_id;
    const matchedProfile = currentProfileId
      ? profiles.find(p => p.id === currentProfileId)
      : profiles.find(p => p.base_role === member.role);
    // Detect current system from profile
    const memberSystems = matchedProfile?.systems || ['p2g'];
    setEditSystem(memberSystems.includes('total_link') && !memberSystems.includes('p2g') ? 'total_link' : 'p2g');
    setNewRole(matchedProfile?.id || member.role);
    setChangeRoleOpen(true);
  };

  const handleChangePassword = () => {
    if (!selectedMember) return;
    
    if (!memberNewPassword || !memberConfirmPassword) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }

    if (memberNewPassword.length < 6) {
      toast({ title: 'A palavra-passe deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }

    if (memberNewPassword !== memberConfirmPassword) {
      toast({ title: 'As palavras-passe não coincidem', variant: 'destructive' });
      return;
    }

    manageTeamMember.mutate(
      { action: 'change_password', user_id: selectedMember.user_id, new_password: memberNewPassword },
      {
        onSuccess: () => {
          setChangePasswordOpen(false);
          setSelectedMember(null);
          setMemberNewPassword('');
          setMemberConfirmPassword('');
        },
      }
    );
  };

  const handleChangeRole = () => {
    if (!selectedMember) return;

    const selectedProfile = profiles.find(p => p.id === newRole);
    const resolvedRole = selectedProfile?.base_role || newRole;
    manageTeamMember.mutate(
      { action: 'change_role', user_id: selectedMember.user_id, new_role: resolvedRole as 'admin' | 'viewer' | 'salesperson', profile_id: selectedProfile?.id, profile_name: selectedProfile?.name },
      {
        onSuccess: () => {
          setChangeRoleOpen(false);
          setSelectedMember(null);
        },
      }
    );
  };

  const handleToggleStatus = (member: TeamMember) => {
    manageTeamMember.mutate({ action: 'toggle_status', user_id: member.user_id });
  };

  const handleDeleteMember = (member: TeamMember) => {
    setMemberToDelete(member);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteMember = () => {
    if (!memberToDelete) return;
    manageTeamMember.mutate(
      { action: 'delete_member', user_id: memberToDelete.user_id },
      {
        onSuccess: () => {
          setDeleteConfirmOpen(false);
          setMemberToDelete(null);
        },
      }
    );
  };

  const openEditProfileModal = async (member: TeamMember) => {
    setSelectedMember(member);
    setEditFullName(member.full_name || '');
    setEditEmail(member.email || '');
    setEditPhone(member.phone || '');
    setEditCommissionRate('');
    setEditNotificationEmail('');
    setEditNotifPrefs({ calendar: true, email: true, fidelization: true });

    if (organization?.id) {
      const { data } = await supabase
        .from('organization_members')
        .select('commission_rate, notification_email, notification_preferences')
        .eq('user_id', member.user_id)
        .eq('organization_id', organization.id)
        .single();
      if (data) {
        if (showIndividualCommission) {
          setEditCommissionRate(data.commission_rate ? String(data.commission_rate) : '');
        }
        setEditNotificationEmail((data as any).notification_email || '');
        const prefs = (data as any).notification_preferences;
        if (prefs) {
          setEditNotifPrefs({
            calendar: prefs.calendar ?? true,
            email: prefs.email ?? true,
            fidelization: prefs.fidelization ?? true,
          });
        }
      }
    }
    setEditProfileOpen(true);
  };

  const handleEditProfile = async () => {
    if (!selectedMember) return;
    if (!editFullName.trim()) {
      toast({ title: 'O nome é obrigatório', variant: 'destructive' });
      return;
    }
    // Save member-level fields (commission, notifications)
    if (organization?.id) {
      const memberUpdate: Record<string, unknown> = {
        notification_email: editNotificationEmail.trim() || null,
        notification_preferences: editNotifPrefs,
      };
      if (showIndividualCommission) {
        memberUpdate.commission_rate = editCommissionRate ? parseFloat(editCommissionRate) : null;
      }
      await supabase
        .from('organization_members')
        .update(memberUpdate as any)
        .eq('user_id', selectedMember.user_id)
        .eq('organization_id', organization.id);
      if (showIndividualCommission) {
        queryClient.invalidateQueries({ queryKey: ['sales-commissions'] });
      }
    }
    manageTeamMember.mutate(
      { action: 'update_profile', user_id: selectedMember.user_id, full_name: editFullName.trim(), email: editEmail.trim(), phone: editPhone.trim() },
      {
        onSuccess: () => {
          setEditProfileOpen(false);
          setSelectedMember(null);
        },
      }
    );
  };

  const openSendAccessModal = (member: TeamMember) => {
    setSelectedMember(member);
    setSendAccessOpen(true);
  };

  const handleSendAccessEmailToMember = async () => {
    if (!selectedMember || !organization) return;

    setSendingAccessEmail(true);
    try {
      // First change the password
      await new Promise<void>((resolve, reject) => {
        manageTeamMember.mutate(
          { action: 'change_password', user_id: selectedMember.user_id, new_password: memberNewPassword },
          { onSuccess: () => resolve(), onError: (e) => reject(e) }
        );
      });

      // Then send the email with the new password
      const { data, error } = await supabase.functions.invoke('send-access-email', {
        body: {
          organizationId: organization.id,
          recipientEmail: selectedMember.email,
          recipientName: selectedMember.full_name,
          loginUrl,
          password: memberNewPassword,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Email enviado!', description: `Dados de acesso enviados para ${selectedMember.email}.` });
      setSendAccessOpen(false);
      setSelectedMember(null);
      setMemberNewPassword('');
    } catch (err: any) {
      toast({
        title: 'Erro ao enviar email',
        description: err.message || 'Verifique se a integração Brevo está configurada.',
        variant: 'destructive',
      });
    } finally {
      setSendingAccessEmail(false);
    }
  };

  const handleSendRecoveryEmail = async (member: TeamMember) => {
    if (!member.email) {
      toast({ title: 'Sem email', description: 'Este membro não tem email configurado.', variant: 'destructive' });
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('send-recovery-email', {
        body: {
          organizationId: organization?.id,
          recipientEmail: member.email,
          recipientName: member.full_name,
          recipientUserId: member.user_id,
          redirectTo: `${getBaseUrl()}/reset-password`,
        },
      });
      // On non-2xx, real error message is in data.error; error is generic FunctionsHttpError
      const errorMsg = data?.error || error?.message;
      if (errorMsg) throw new Error(errorMsg);
      toast({ title: 'Email enviado!', description: `Email de recuperação enviado para ${member.email}.` });
    } catch (err: any) {
      toast({ title: 'Erro ao enviar email', description: err.message || 'Tente novamente.', variant: 'destructive' });
    }
  };

  const loginUrl = `${getBaseUrl()}/`;

  // Check if member is current user
  const isCurrentUser = (member: TeamMember) => member.user_id === user?.id;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Acessos
            </CardTitle>
            <CardDescription>
              Gerencie os utilizadores e permissões da sua organização.
            </CardDescription>
          </div>
          <Dialog open={isAddOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsAddOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Adicionar Acesso
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              {!createdMember ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Adicionar Novo Acesso</DialogTitle>
                    <DialogDescription>
                      Crie credenciais de acesso para um novo colaborador.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Sistema de Acesso</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => { setAccessSystem('p2g'); setRole('salesperson'); }}
                          className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 text-sm transition-colors ${accessSystem === 'p2g' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'}`}
                        >
                          <span className="font-medium">Perfect2Gether</span>
                          <span className="text-xs text-muted-foreground">CRM & Gestão</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAccessSystem('total_link'); setRole('viewer'); }}
                          className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 text-sm transition-colors ${accessSystem === 'total_link' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'}`}
                        >
                          <span className="font-medium">Total Link</span>
                          <span className="text-xs text-muted-foreground">Portal</span>
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="full-name">Nome Completo</Label>
                      <Input
                        id="full-name"
                        placeholder="João Silva"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="joao@exemplo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Palavra-passe</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Mínimo 6 caracteres"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirmar Palavra-passe</Label>
                      <Input
                        id="confirm-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Repetir palavra-passe"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-3">
                      <Label>Perfil</Label>
                      <Select value={role} onValueChange={(v) => setRole(v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar perfil..." />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredProfiles.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                              <span className="text-muted-foreground text-xs ml-2">
                                ({ROLE_LABELS[p.base_role] || p.base_role})
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Notification preferences */}
                    <div className="space-y-3 pt-2 border-t">
                      <Label className="flex items-center gap-2 text-sm font-semibold">
                        <Bell className="h-4 w-4" />
                        Notificações
                      </Label>
                      <div className="space-y-2">
                        <Label htmlFor="new-notif-email">Email para notificações</Label>
                        <Input
                          id="new-notif-email"
                          type="email"
                          placeholder="Usar email de contacto se vazio"
                          value={newNotificationEmail}
                          onChange={(e) => setNewNotificationEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="new-notif-calendar" className="text-sm font-normal">Lembretes de Calendário</Label>
                          <Switch
                            id="new-notif-calendar"
                            checked={newNotifPrefs.calendar}
                            onCheckedChange={(v) => setNewNotifPrefs(p => ({ ...p, calendar: v }))}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="new-notif-email-toggle" className="text-sm font-normal">Alertas por Email</Label>
                          <Switch
                            id="new-notif-email-toggle"
                            checked={newNotifPrefs.email}
                            onCheckedChange={(v) => setNewNotifPrefs(p => ({ ...p, email: v }))}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="new-notif-fidelization" className="text-sm font-normal">Alertas de Fidelização (CPE/CUI)</Label>
                          <Switch
                            id="new-notif-fidelization"
                            checked={newNotifPrefs.fidelization}
                            onCheckedChange={(v) => setNewNotifPrefs(p => ({ ...p, fidelization: v }))}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={handleCloseDialog}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleCreateMember}
                      disabled={!fullName.trim() || !email.trim() || !password || !confirmPassword || !filteredProfiles.some(p => p.id === role) || createTeamMember.isPending}
                    >
                      {createTeamMember.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Criar Acesso
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-green-600">
                      <Check className="h-5 w-5" />
                      Acesso Criado com Sucesso!
                    </DialogTitle>
                    <DialogDescription>
                      Envie estas informações ao colaborador por WhatsApp ou email.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Link de Acesso</Label>
                      <div className="flex gap-2">
                        <Input value={loginUrl} readOnly className="font-mono text-sm" />
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={() => copyToClipboard(loginUrl, 'Link')}
                        >
                          {copiedField === 'Link' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Email</Label>
                      <div className="flex gap-2">
                        <Input value={createdMember.email} readOnly className="font-mono text-sm" />
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={() => copyToClipboard(createdMember.email, 'Email')}
                        >
                          {copiedField === 'Email' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Palavra-passe</Label>
                      <div className="flex gap-2">
                        <Input 
                          value={showPassword ? createdMember.password : '••••••••'} 
                          readOnly 
                          className="font-mono text-sm" 
                        />
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={() => copyToClipboard(createdMember.password, 'Palavra-passe')}
                        >
                          {copiedField === 'Palavra-passe' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                      <Clock className="h-4 w-4 mt-0.5 shrink-0" />
                      <p>Guarde estas informações - a palavra-passe não poderá ser recuperada por si.</p>
                    </div>
                  </div>
                  <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      onClick={handleSendAccessEmail}
                      disabled={sendingEmail || emailSent}
                      className="w-full sm:w-auto"
                    >
                      {sendingEmail ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : emailSent ? (
                        <Check className="mr-2 h-4 w-4" />
                      ) : (
                        <Mail className="mr-2 h-4 w-4" />
                      )}
                      {emailSent ? 'Email Enviado' : 'Enviar Acesso por Email'}
                    </Button>
                    <Button onClick={handleCloseDialog}>Fechar</Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loadingMembers ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members?.map((member) => (
                  <TableRow key={member.id} className={member.is_banned ? 'opacity-50' : ''}>
                    <TableCell>
                      <div>
                        <span className="font-medium">
                          {member.full_name}
                          {isCurrentUser(member) && (
                            <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                          )}
                        </span>
                        {(member.email || member.phone) && (
                          <div className="flex flex-col gap-0.5 mt-0.5">
                            {member.email && (
                              <span className="text-xs text-muted-foreground">{member.email}</span>
                            )}
                            {member.phone && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {member.phone}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={ROLE_VARIANTS[member.role] || 'secondary'}>
                        {member.profile_name || ROLE_LABELS[member.role] || member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {member.is_banned ? (
                        <Badge variant="outline" className="text-destructive border-destructive">
                          Inativo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-success border-success">
                          Ativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditProfileModal(member)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar Dados
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openChangePasswordModal(member)}>
                            <Key className="mr-2 h-4 w-4" />
                            Redefinir Palavra-passe
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openSendAccessModal(member)}>
                            <Mail className="mr-2 h-4 w-4" />
                            Enviar Email de Acesso
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSendRecoveryEmail(member)}>
                            <Key className="mr-2 h-4 w-4" />
                            Enviar Email de Recuperação
                          </DropdownMenuItem>
                          {!isCurrentUser(member) && member.role !== 'super_admin' && (
                            <>
                              <DropdownMenuItem onClick={() => openChangeRoleModal(member)}>
                                <UserCog className="mr-2 h-4 w-4" />
                                Alterar Perfil
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleToggleStatus(member)}
                                className={member.is_banned ? '' : 'text-destructive focus:text-destructive'}
                                disabled={manageTeamMember.isPending}
                              >
                                {member.is_banned ? (
                                  <>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Reativar Acesso
                                  </>
                                ) : (
                                  <>
                                    <Ban className="mr-2 h-4 w-4" />
                                    Desativar Acesso
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteMember(member)}
                                className="text-destructive focus:text-destructive"
                                disabled={manageTeamMember.isPending}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar Acesso
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {(!members || members.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Nenhum colaborador encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Change Password Modal */}
      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Redefinir Palavra-passe
            </DialogTitle>
            <DialogDescription>
              Defina uma nova palavra-passe para {selectedMember?.full_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="member-new-password">Nova Palavra-passe</Label>
              <div className="relative">
                <Input
                  id="member-new-password"
                  type={showMemberPassword ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={memberNewPassword}
                  onChange={(e) => setMemberNewPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowMemberPassword(!showMemberPassword)}
                >
                  {showMemberPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-confirm-password">Confirmar Palavra-passe</Label>
              <Input
                id="member-confirm-password"
                type={showMemberPassword ? 'text' : 'password'}
                placeholder="Repetir palavra-passe"
                value={memberConfirmPassword}
                onChange={(e) => setMemberConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePasswordOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={!memberNewPassword || !memberConfirmPassword || manageTeamMember.isPending}
            >
              {manageTeamMember.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Access Email Modal */}
      <Dialog open={sendAccessOpen} onOpenChange={(open) => { setSendAccessOpen(open); if (!open) { setMemberNewPassword(''); setShowMemberPassword(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Enviar Email de Acesso
            </DialogTitle>
            <DialogDescription>
              Define uma nova palavra-passe para <strong>{selectedMember?.full_name}</strong>. Será redefinida e enviada no email.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="access-email-password">Nova Palavra-passe</Label>
              <div className="relative">
                <Input
                  id="access-email-password"
                  type={showMemberPassword ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={memberNewPassword}
                  onChange={(e) => setMemberNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowMemberPassword(!showMemberPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showMemberPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendAccessOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSendAccessEmailToMember}
              disabled={sendingAccessEmail || !memberNewPassword || memberNewPassword.length < 6}
            >
              {sendingAccessEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Redefinir e Enviar Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Editar Dados
            </DialogTitle>
            <DialogDescription>
              Edite os dados de contacto de {selectedMember?.full_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-full-name">Nome Completo</Label>
              <Input
                id="edit-full-name"
                placeholder="Nome completo"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email de Contacto</Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="email@exemplo.com"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Telefone</Label>
              <Input
                id="edit-phone"
                type="tel"
                placeholder="+351 912 345 678"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
              />
            </div>
            {showIndividualCommission && (
              <div className="space-y-2">
                <Label htmlFor="edit-commission-rate">Comissão (%)</Label>
                <Input
                  id="edit-commission-rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  placeholder="Ex: 10"
                  value={editCommissionRate}
                  onChange={(e) => setEditCommissionRate(e.target.value)}
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">
                  Percentagem de comissão individual sobre o valor total das vendas.
                </p>
              </div>
            )}

            {/* Notification preferences */}
            <div className="space-y-3 pt-2 border-t">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Bell className="h-4 w-4" />
                Notificações
              </Label>
              <div className="space-y-2">
                <Label htmlFor="edit-notif-email">Email para notificações</Label>
                <Input
                  id="edit-notif-email"
                  type="email"
                  placeholder="Usar email de contacto se vazio"
                  value={editNotificationEmail}
                  onChange={(e) => setEditNotificationEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Email onde este colaborador recebe alertas. Se vazio, usa o email de contacto.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="notif-calendar" className="text-sm font-normal">Lembretes de Calendário</Label>
                  <Switch
                    id="notif-calendar"
                    checked={editNotifPrefs.calendar}
                    onCheckedChange={(v) => setEditNotifPrefs(p => ({ ...p, calendar: v }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="notif-email" className="text-sm font-normal">Alertas por Email</Label>
                  <Switch
                    id="notif-email"
                    checked={editNotifPrefs.email}
                    onCheckedChange={(v) => setEditNotifPrefs(p => ({ ...p, email: v }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="notif-fidelization" className="text-sm font-normal">Alertas de Fidelização (CPE/CUI)</Label>
                  <Switch
                    id="notif-fidelization"
                    checked={editNotifPrefs.fidelization}
                    onCheckedChange={(v) => setEditNotifPrefs(p => ({ ...p, fidelization: v }))}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProfileOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleEditProfile}
              disabled={!editFullName.trim() || manageTeamMember.isPending}
            >
              {manageTeamMember.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Modal */}
      <Dialog open={changeRoleOpen} onOpenChange={setChangeRoleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              Alterar Perfil
            </DialogTitle>
            <DialogDescription>
              Altere o perfil de {selectedMember?.full_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2 mb-4">
              <Label className="text-muted-foreground">Perfil Atual</Label>
              <Badge variant={selectedMember ? ROLE_VARIANTS[selectedMember.role] : 'secondary'}>
                {selectedMember?.profile_name || (selectedMember ? ROLE_LABELS[selectedMember.role] : '')}
              </Badge>
            </div>
            <div className="space-y-2 mb-4">
              <Label>Sistema</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setEditSystem('p2g'); setNewRole('salesperson'); }}
                  className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2.5 text-sm transition-colors ${editSystem === 'p2g' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'}`}
                >
                  <span className="font-medium">Perfect2Gether</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setEditSystem('total_link'); setNewRole('viewer'); }}
                  className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2.5 text-sm transition-colors ${editSystem === 'total_link' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'}`}
                >
                  <span className="font-medium">Total Link</span>
                </button>
              </div>
            </div>
            {editSystemProfiles.length > 0 ? (
              <div className="space-y-2">
                <Label>Novo Perfil</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar perfil..." />
                  </SelectTrigger>
                  <SelectContent>
                    {editSystemProfiles.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        <span className="text-muted-foreground text-xs ml-2">
                          ({ROLE_LABELS[p.base_role] || p.base_role})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <RadioGroup value={newRole} onValueChange={(v) => setNewRole(v as 'admin' | 'viewer' | 'salesperson')}>
                <div className="flex items-start space-x-3 rounded-lg border p-3">
                  <RadioGroupItem value="admin" id="new-role-admin" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="new-role-admin" className="font-medium cursor-pointer">Administrador</Label>
                    <p className="text-sm text-muted-foreground">Acesso total.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 rounded-lg border p-3">
                  <RadioGroupItem value="salesperson" id="new-role-salesperson" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="new-role-salesperson" className="font-medium cursor-pointer">Comercial</Label>
                    <p className="text-sm text-muted-foreground">Vê leads atribuídos.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 rounded-lg border p-3">
                  <RadioGroupItem value="viewer" id="new-role-viewer" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="new-role-viewer" className="font-medium cursor-pointer">Visualizador</Label>
                    <p className="text-sm text-muted-foreground">Apenas visualização.</p>
                  </div>
                </div>
              </RadioGroup>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeRoleOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleChangeRole}
              disabled={manageTeamMember.isPending}
            >
              {manageTeamMember.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pending Invites - legacy */}
      {(invites && invites.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Convites Pendentes ({invites.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingInvites ? (
              <Skeleton className="h-12 w-full" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Expira</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.map((invite) => (
                    <TableRow key={invite.id}>
                      <TableCell className="font-medium">{invite.email}</TableCell>
                      <TableCell>
                        <Badge variant={ROLE_VARIANTS[invite.role] || 'secondary'}>
                          {ROLE_LABELS[invite.role] || invite.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDistanceToNow(new Date(invite.expires_at), { 
                          addSuffix: true, 
                          locale: pt 
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => copyInviteLink(invite)}
                            title="Copiar link de convite"
                          >
                            {copiedInviteId === invite.id ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleResendInvite(invite)}
                            disabled={resendInvite.isPending}
                            title="Reenviar convite (renova expiração)"
                          >
                            <RefreshCw className={`h-4 w-4 ${resendInvite.isPending ? 'animate-spin' : ''}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleCancelInvite(invite)}
                            disabled={cancelInvite.isPending}
                            title="Cancelar convite"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
      {/* Delete member confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar acesso</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que deseja eliminar o acesso de <strong>{memberToDelete?.full_name}</strong>? 
              Esta ação é irreversível. O colaborador será removido da organização e não poderá mais iniciar sessão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {manageTeamMember.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
