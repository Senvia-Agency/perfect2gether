import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { 
  ResizableHandle, 
  ResizablePanel, 
  ResizablePanelGroup 
} from "@/components/ui/resizable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ArrowLeft,
  Loader2, 
  Palette, 
  MessageSquare, 
  CheckCircle, 
  ExternalLink, 
  Save,
  Sparkles,
  ImageIcon,
  FileText,
  MessagesSquare,
  Copy,
  Check,
  Settings,
  Bot,
  Zap,
  Thermometer,
  Target,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  UserPlus
} from "lucide-react";
import { useUpdateForm } from '@/hooks/useForms';
import { usePipelineStages } from '@/hooks/usePipelineStages';
import { useTeamMembers } from '@/hooks/useTeam';
import { useAuth } from '@/contexts/AuthContext';
import { Form, FormSettings, FormMode, MetaPixel, migrateFormSettings } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { FormPreview } from './FormPreview';
import { ConversationalFormPreview } from './ConversationalFormPreview';
import { LogoUploader } from './LogoUploader';
import { CustomFieldsEditor } from './CustomFieldsEditor';
import { PRODUCTION_URL } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

const PRESET_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#F97316',
  '#EAB308', '#22C55E', '#06B6D4', '#6366F1', '#0EA5E9',
];

interface FormEditorProps {
  form: Form;
  onBack: () => void;
}

export function FormEditor({ form, onBack }: FormEditorProps) {
  const { organization } = useAuth();
  const { toast } = useToast();
  const updateForm = useUpdateForm();
  const isMobile = useIsMobile();

  const { data: teamMembers } = useTeamMembers();
  const { data: stages = [] } = usePipelineStages();
  
  const [name, setName] = useState(form.name);
  const [slug, setSlug] = useState(form.slug);
  const [settings, setSettings] = useState<FormSettings>(migrateFormSettings(form.form_settings));
  const [showSuccessPreview, setShowSuccessPreview] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  
  // Automation fields
  const [msgTemplateHot, setMsgTemplateHot] = useState(form.msg_template_hot || '');
  const [msgTemplateWarm, setMsgTemplateWarm] = useState(form.msg_template_warm || '');
  const [msgTemplateCold, setMsgTemplateCold] = useState(form.msg_template_cold || '');
  const [aiQualificationRules, setAiQualificationRules] = useState(form.ai_qualification_rules || '');
  
  // Meta Pixels
  const [metaPixels, setMetaPixels] = useState<MetaPixel[]>(form.meta_pixels || []);
  
  // Auto-assignment
  const [assignedTo, setAssignedTo] = useState<string | null>(form.assigned_to || null);
  
  // Target stage
  const [targetStage, setTargetStage] = useState<string | null>(form.target_stage || null);

  const getFormUrl = () => {
    if (!organization?.slug) return '';
    const prefix = settings.mode === 'conversational' ? '/c/' : '/f/';
    if (form.is_default) {
      return `${PRODUCTION_URL}${prefix}${organization.slug}`;
    }
    return `${PRODUCTION_URL}${prefix}${organization.slug}/${slug}`;
  };

  const handleSave = () => {
    updateForm.mutate(
      { 
        id: form.id, 
        name, 
        slug, 
        form_settings: settings,
        msg_template_hot: msgTemplateHot || null,
        msg_template_warm: msgTemplateWarm || null,
        msg_template_cold: msgTemplateCold || null,
        ai_qualification_rules: aiQualificationRules || null,
        meta_pixels: metaPixels,
        assigned_to: assignedTo,
        target_stage: targetStage,
      },
      {
        onSuccess: () => {
          toast({
            title: "Alterações guardadas",
            description: "O formulário foi atualizado com sucesso.",
          });
        }
      }
    );
  };

  // Meta Pixels handlers
  const handleAddPixel = () => {
    const newPixel: MetaPixel = {
      id: crypto.randomUUID(),
      name: '',
      pixel_id: '',
      enabled: true,
    };
    setMetaPixels(prev => [...prev, newPixel]);
  };

  const handleRemovePixel = (id: string) => {
    setMetaPixels(prev => prev.filter(p => p.id !== id));
  };

  const handleUpdatePixel = (id: string, field: keyof MetaPixel, value: string | boolean) => {
    setMetaPixels(prev => prev.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const isValidPixelId = (pixelId: string) => /^\d{15,16}$/.test(pixelId);

  const handlePreview = () => {
    window.open(getFormUrl(), '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = async () => {
    const url = getFormUrl();
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast({
      title: "Link copiado!",
      description: "O link do formulário foi copiado para a área de transferência.",
    });
  };

  const updateSetting = <K extends keyof FormSettings>(key: K, value: FormSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateSuccessMessage = (key: keyof FormSettings['success_message'], value: string) => {
    setSettings(prev => ({
      ...prev,
      success_message: { ...prev.success_message, [key]: value }
    }));
  };

  const isValidHexColor = (color: string) => /^#[0-9A-Fa-f]{6}$/.test(color);

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  };

  // Editor content (shared between mobile and desktop)
  const editorContent = (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <Accordion type="multiple" defaultValue={["details", "mode", "appearance", "fields", "messages", "automation"]} className="space-y-3">
        
        {/* Form Details */}
        <AccordionItem value="details" className="border rounded-xl px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Settings className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-left">
                <span className="font-medium">Detalhes</span>
                <p className="text-xs text-muted-foreground font-normal">
                  Nome e URL do formulário
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-2 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="form-name">Nome</Label>
              <Input
                id="form-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do formulário"
                maxLength={100}
              />
            </div>
            {!form.is_default && (
              <div className="space-y-2">
                <Label htmlFor="form-slug">Slug (URL)</Label>
                <Input
                  id="form-slug"
                  value={slug}
                  onChange={(e) => setSlug(generateSlug(e.target.value))}
                  placeholder="slug-do-formulario"
                  maxLength={50}
                />
              </div>
            )}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
              <code className="flex-1 text-xs text-muted-foreground truncate">
                {getFormUrl()}
              </code>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleCopyLink}
                className="flex-shrink-0"
              >
                {copiedLink ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Auto-Assignment Section */}
        <AccordionItem value="assignment" className="border rounded-xl px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <UserPlus className="h-5 w-5 text-blue-600" />
              </div>
              <div className="text-left">
                <span className="font-medium">Atribuição Automática</span>
                <p className="text-xs text-muted-foreground font-normal">
                  Colaborador responsável pelos leads
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-2 space-y-4">
            <div className="space-y-2">
              <Label>Colaborador Responsável</Label>
              <Select 
                value={assignedTo || 'none'} 
                onValueChange={(v) => setAssignedTo(v === 'none' ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum (fica por atribuir)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (fica por atribuir)</SelectItem>
                  {teamMembers?.map(member => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Todos os leads que chegarem por este formulário serão automaticamente atribuídos a este colaborador.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Target Stage Section */}
        <AccordionItem value="target-stage" className="border rounded-xl px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <Target className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="text-left">
                <span className="font-medium">Etapa Inicial do Lead</span>
                <p className="text-xs text-muted-foreground font-normal">
                  Em qual etapa do pipeline o lead entra automaticamente
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-2 space-y-4">
            <div className="space-y-2">
              <Label>Etapa do Pipeline</Label>
              <Select
                value={targetStage || 'default'}
                onValueChange={(v) => setTargetStage(v === 'default' ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Primeira etapa (padrão)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Primeira etapa (padrão)</SelectItem>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.key}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Os leads deste formulário entrarão diretamente nesta etapa do pipeline. O nome do formulário será adicionado nas notas do lead.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Form Mode Section */}
        <AccordionItem value="mode" className="border rounded-xl px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
                <MessagesSquare className="h-5 w-5 text-violet-600" />
              </div>
              <div className="text-left">
                <span className="font-medium">Tipo de Formulário</span>
                <p className="text-xs text-muted-foreground font-normal">
                  Escolha entre tradicional ou conversacional
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-2 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => updateSetting('mode', 'traditional')}
                className={cn(
                  "relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all",
                  settings.mode === 'traditional'
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-xl",
                  settings.mode === 'traditional' ? "bg-primary/10" : "bg-muted"
                )}>
                  <FileText className={cn(
                    "h-6 w-6",
                    settings.mode === 'traditional' ? "text-primary" : "text-muted-foreground"
                  )} />
                </div>
                <div className="text-center">
                  <p className={cn(
                    "font-medium text-sm",
                    settings.mode === 'traditional' ? "text-primary" : "text-foreground"
                  )}>Tradicional</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Todos os campos visíveis
                  </p>
                </div>
                {settings.mode === 'traditional' && (
                  <div className="absolute top-2 right-2">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={() => updateSetting('mode', 'conversational')}
                className={cn(
                  "relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all",
                  settings.mode === 'conversational'
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-xl",
                  settings.mode === 'conversational' ? "bg-primary/10" : "bg-muted"
                )}>
                  <MessagesSquare className={cn(
                    "h-6 w-6",
                    settings.mode === 'conversational' ? "text-primary" : "text-muted-foreground"
                  )} />
                </div>
                <div className="text-center">
                  <p className={cn(
                    "font-medium text-sm",
                    settings.mode === 'conversational' ? "text-primary" : "text-foreground"
                  )}>Conversacional</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Uma pergunta de cada vez
                  </p>
                </div>
                {settings.mode === 'conversational' && (
                  <div className="absolute top-2 right-2">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                )}
              </button>
            </div>

            {settings.mode === 'conversational' && (
              <p className="text-xs text-muted-foreground bg-amber-500/10 text-amber-700 dark:text-amber-400 p-3 rounded-lg">
                💡 O modo conversacional usa um fluxo passo-a-passo otimizado para conversão.
              </p>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Appearance Section */}
        <AccordionItem value="appearance" className="border rounded-xl px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Palette className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <span className="font-medium">Aparência</span>
                <p className="text-xs text-muted-foreground font-normal">
                  Título, subtítulo, logo e cores
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-2 space-y-5">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={settings.title}
                onChange={(e) => updateSetting('title', e.target.value)}
                maxLength={100}
                placeholder="Contacte-nos"
              />
            </div>

            <div className="space-y-2">
              <Label>Subtítulo</Label>
              <Textarea
                value={settings.subtitle}
                onChange={(e) => updateSetting('subtitle', e.target.value)}
                maxLength={200}
                placeholder="Preencha o formulário..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                Logo
              </Label>
              <LogoUploader
                value={settings.logo_url}
                onChange={(url) => updateSetting('logo_url', url)}
              />
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                Cor Principal
              </Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      "h-8 w-8 rounded-full transition-all duration-200 hover:scale-110",
                      settings.primary_color.toLowerCase() === color.toLowerCase() && "ring-2 ring-offset-2 ring-primary scale-110"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => updateSetting('primary_color', color)}
                  />
                ))}
              </div>
              <div className="flex gap-3 items-center">
                <div 
                  className="h-11 w-11 rounded-lg border-2 flex-shrink-0"
                  style={{ 
                    backgroundColor: settings.primary_color,
                    borderColor: isValidHexColor(settings.primary_color) ? settings.primary_color : 'hsl(var(--destructive))'
                  }}
                />
                <Input
                  value={settings.primary_color}
                  onChange={(e) => updateSetting('primary_color', e.target.value)}
                  placeholder="#3B82F6"
                  maxLength={7}
                  className="font-mono uppercase"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Fields Section */}
        <AccordionItem value="fields" className="border rounded-xl px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <MessageSquare className="h-5 w-5 text-green-600" />
              </div>
              <div className="text-left">
                <span className="font-medium">Campos</span>
                <p className="text-xs text-muted-foreground font-normal">
                  Configure os campos do formulário
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-2">
            <CustomFieldsEditor
              settings={settings}
              onUpdateSettings={setSettings}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Messages Section */}
        <AccordionItem value="messages" className="border rounded-xl px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="text-left">
                <span className="font-medium">Mensagens</span>
                <p className="text-xs text-muted-foreground font-normal">
                  Sucesso, erro e botão de envio
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-2 space-y-5">
            <div className="space-y-2">
              <Label>Texto do Botão</Label>
              <Input
                value={settings.submit_button_text}
                onChange={(e) => updateSetting('submit_button_text', e.target.value)}
                maxLength={30}
                placeholder="Enviar"
              />
            </div>

            <div className="p-4 border rounded-xl space-y-4 bg-emerald-500/5">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle className="h-4 w-4" />
                  Mensagem de Sucesso
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSuccessPreview(!showSuccessPreview)}
                >
                  {showSuccessPreview ? 'Esconder' : 'Pré-visualizar'}
                </Button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Título</Label>
                  <Input
                    value={settings.success_message.title}
                    onChange={(e) => updateSuccessMessage('title', e.target.value)}
                    maxLength={50}
                    placeholder="Obrigado!"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Descrição</Label>
                  <Textarea
                    value={settings.success_message.description}
                    onChange={(e) => updateSuccessMessage('description', e.target.value)}
                    maxLength={200}
                    placeholder="Recebemos o seu contacto..."
                    rows={2}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Mensagem de Erro</Label>
              <Textarea
                value={settings.error_message}
                onChange={(e) => updateSetting('error_message', e.target.value)}
                maxLength={200}
                placeholder="Não foi possível enviar..."
                rows={2}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Automation Section */}
        <AccordionItem value="automation" className="border rounded-xl px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                <Zap className="h-5 w-5 text-orange-600" />
              </div>
              <div className="text-left">
                <span className="font-medium">Automação</span>
                <p className="text-xs text-muted-foreground font-normal">
                  Mensagens automáticas e regras de IA
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-2 space-y-6">
            {/* Message Templates */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Thermometer className="h-4 w-4 text-muted-foreground" />
                <Label className="font-medium">Modelos de Mensagem por Temperatura</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Use <code className="bg-muted px-1 rounded">{"{{ $('Dados').item.json.Nome }}"}</code> para personalizar com o nome do lead.
              </p>

              <div className="space-y-4">
                <div className="space-y-2 p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20">
                  <Label className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    🔥 Lead Quente (Hot)
                  </Label>
                  <Textarea
                    value={msgTemplateHot}
                    onChange={(e) => setMsgTemplateHot(e.target.value)}
                    placeholder="Olá {{ $('Dados').item.json.Nome }}! Vimos que tem interesse urgente. Podemos ajudar agora mesmo?"
                    rows={3}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2 p-3 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
                  <Label className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    😐 Lead Morno (Warm)
                  </Label>
                  <Textarea
                    value={msgTemplateWarm}
                    onChange={(e) => setMsgTemplateWarm(e.target.value)}
                    placeholder="Olá {{ $('Dados').item.json.Nome }}! Obrigado pelo seu contacto. Gostaria de saber mais sobre os nossos serviços?"
                    rows={3}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2 p-3 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
                  <Label className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    🥶 Lead Frio (Cold)
                  </Label>
                  <Textarea
                    value={msgTemplateCold}
                    onChange={(e) => setMsgTemplateCold(e.target.value)}
                    placeholder="Olá {{ $('Dados').item.json.Nome }}! Recebemos o seu contacto. Estamos disponíveis para esclarecer qualquer dúvida."
                    rows={3}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>

            {/* AI Qualification Rules */}
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-muted-foreground" />
                <Label className="font-medium">Regras de Qualificação por IA</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Defina critérios para a IA classificar automaticamente a temperatura dos leads.
              </p>
              <Textarea
                value={aiQualificationRules}
                onChange={(e) => setAiQualificationRules(e.target.value)}
                placeholder={`Exemplo de regras:

- HOT: Lead que menciona urgência, preço ou quer agendar
- WARM: Lead com interesse demonstrado mas sem urgência
- COLD: Lead que apenas pede informações gerais

Considerar também:
- Palavras como "orçamento", "já" → HOT
- Perguntas sobre funcionamento → WARM
- Campos opcionais vazios → COLD`}
                rows={8}
                className="text-sm font-mono"
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Meta Pixels Section */}
        <AccordionItem value="meta-pixels" className="border rounded-xl px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Target className="h-5 w-5 text-blue-600" />
              </div>
              <div className="text-left">
                <span className="font-medium">Meta Pixels</span>
                <p className="text-xs text-muted-foreground font-normal">
                  Rastreamento de conversões Facebook/Meta
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-2 space-y-4">
            <p className="text-xs text-muted-foreground bg-blue-500/10 text-blue-700 dark:text-blue-400 p-3 rounded-lg">
              Os pixels disparam eventos <strong>PageView</strong> e <strong>Lead</strong> automaticamente quando o formulário é visualizado e submetido.
            </p>

            {metaPixels.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum pixel configurado para este formulário.
              </p>
            ) : (
              <div className="space-y-3">
                {metaPixels.map((pixel, index) => (
                  <div key={pixel.id} className="flex flex-col gap-3 p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-medium">#{index + 1}</span>
                      <Input
                        placeholder="Nome do pixel (ex: Pixel Principal)"
                        value={pixel.name}
                        onChange={(e) => handleUpdatePixel(pixel.id, 'name', e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleUpdatePixel(pixel.id, 'enabled', !pixel.enabled)}
                        className={pixel.enabled ? 'text-green-500' : 'text-muted-foreground'}
                        title={pixel.enabled ? 'Ativo' : 'Inativo'}
                      >
                        {pixel.enabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemovePixel(pixel.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input
                      placeholder="Pixel ID (15-16 dígitos)"
                      value={pixel.pixel_id}
                      onChange={(e) => handleUpdatePixel(pixel.id, 'pixel_id', e.target.value.replace(/\D/g, '').slice(0, 16))}
                      className={pixel.pixel_id && !isValidPixelId(pixel.pixel_id) ? 'border-destructive' : ''}
                    />
                    {pixel.pixel_id && !isValidPixelId(pixel.pixel_id) && (
                      <p className="text-xs text-destructive">Pixel ID deve ter 15-16 dígitos</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={handleAddPixel}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Pixel
            </Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );

  // Preview content
  const previewContent = (
    <div className="flex h-full flex-col bg-muted/30">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h3 className="font-medium">Pré-visualização</h3>
          <p className="text-xs text-muted-foreground">
            {settings.mode === 'conversational' ? 'Modo Conversacional' : 'Modo Tradicional'}
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-md">
          {settings.mode === 'conversational' ? (
            <ConversationalFormPreview settings={settings} />
          ) : (
            <FormPreview settings={settings} showSuccess={showSuccessPreview} />
          )}
        </div>
      </div>
    </div>
  );

  // Mobile layout
  if (isMobile) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium truncate">{form.name}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePreview}>
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={handleSave} disabled={updateForm.isPending}>
              {updateForm.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        {editorContent}
      </div>
    );
  }

  // Desktop layout with resizable panels
  return (
    <div className="h-[calc(100vh-12rem)] min-h-[600px]">
      <ResizablePanelGroup direction="horizontal" className="h-full rounded-xl border bg-background">
        <ResizablePanel defaultSize={50} minSize={30} maxSize={70}>
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon-sm" onClick={onBack}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h2 className="text-lg font-semibold">{form.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    Personalize o formulário
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handlePreview}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir
                </Button>
                <Button size="sm" onClick={handleSave} disabled={updateForm.isPending}>
                  {updateForm.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Guardar
                </Button>
              </div>
            </div>
            {editorContent}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={50} minSize={30}>
          {previewContent}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
