import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useApplyNicheTemplate } from '@/hooks/usePipelineStages';
import { useCreateForm } from '@/hooks/useForms';
import { NICHE_TEMPLATES, NicheType } from '@/lib/pipeline-templates';
import { Building2, Heart, Hammer, Wifi, ShoppingCart, Home, Check, ArrowRight, ArrowLeft, FileText, Zap, Globe, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const ICON_MAP: Record<string, React.ElementType> = {
  Building2, Heart, Hammer, Wifi, ShoppingCart, Home,
};

export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const { organization } = useAuth();
  const applyTemplate = useApplyNicheTemplate();
  const createForm = useCreateForm();

  const [step, setStep] = useState(0);
  const [selectedNiche, setSelectedNiche] = useState<NicheType | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [formName, setFormName] = useState('Formulário Principal');
  const [isCreatingForm, setIsCreatingForm] = useState(false);

  const orgSlug = organization?.slug || '';

  const handleSelectNiche = async (niche: NicheType) => {
    if (!organization?.id) return;
    setSelectedNiche(niche);
    setIsApplying(true);

    try {
      await applyTemplate.mutateAsync({
        organizationId: organization.id,
        niche,
        migrateLeads: false,
      });
      setStep(1);
    } catch (e) {
      console.error('Error applying template:', e);
    } finally {
      setIsApplying(false);
    }
  };

  const handleCreateForm = async () => {
    if (!organization?.id || !formName.trim()) return;
    setIsCreatingForm(true);

    try {
      const slug = formName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      await createForm.mutateAsync({
        name: formName.trim(),
        slug: slug || 'formulario',
        is_default: true,
      });
      onComplete();
    } catch (e) {
      console.error('Error creating form:', e);
    } finally {
      setIsCreatingForm(false);
    }
  };

  const steps = [
    { title: 'Pipeline', label: 'Tipo de Negócio' },
    { title: 'Formulários', label: 'Como Funciona' },
    { title: 'Criar Formulário', label: 'Primeiro Formulário' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-border" style={{ paddingTop: 'calc(clamp(20px, env(safe-area-inset-top, 0px), 50px) + 1rem)' }}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="text-lg font-semibold text-foreground">Senvia OS</span>
        </div>
        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                i < step ? 'bg-primary text-primary-foreground' :
                i === step ? 'bg-primary/20 text-primary border border-primary' :
                'bg-muted text-muted-foreground'
              }`}>
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={`hidden sm:block w-8 h-0.5 ${i < step ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto px-4 sm:px-8 py-8"
            >
              <div className="text-center mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
                  Qual é o seu tipo de negócio?
                </h1>
                <p className="text-muted-foreground text-sm sm:text-base">
                  Vamos configurar o seu pipeline de vendas com as etapas ideais para o seu setor.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {NICHE_TEMPLATES.map((template) => {
                  const IconComp = ICON_MAP[template.icon] || Building2;
                  const isSelected = selectedNiche === template.id;
                  return (
                    <button
                      key={template.id}
                      onClick={() => handleSelectNiche(template.id)}
                      disabled={isApplying}
                      className={`relative text-left p-5 rounded-xl border transition-all duration-200 ${
                        isSelected
                          ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                          : 'border-border bg-card hover:border-muted-foreground hover:bg-muted'
                      } ${isApplying ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {isApplying && isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-xl">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      )}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <IconComp className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{template.name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {template.stages.slice(0, 5).map((stage) => (
                          <Badge
                            key={stage.key}
                            variant="outline"
                            className="text-[10px] px-1.5 py-0"
                            style={{ borderColor: stage.color, color: stage.color }}
                          >
                            {stage.name}
                          </Badge>
                        ))}
                        {template.stages.length > 5 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-muted-foreground">
                            +{template.stages.length - 5}
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-2xl mx-auto px-4 sm:px-8 py-8"
            >
              <div className="text-center mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
                  Formulários de Captura
                </h1>
                <p className="text-muted-foreground text-sm sm:text-base">
                  Os formulários capturam leads automaticamente para o seu Kanban.
                </p>
              </div>

              <div className="space-y-6">
                {/* Step 1 */}
                <div className="flex items-start gap-4 p-4 rounded-xl bg-card border border-border">
                  <div className="p-2.5 rounded-lg bg-primary/10 shrink-0">
                    <Globe className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Partilhe o link</h3>
                    <p className="text-sm text-muted-foreground">
                      Cada formulário tem um link público que pode usar em anúncios, Landing Pages ou redes sociais.
                    </p>
                    <div className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-muted border border-border">
                      <span className="text-xs text-muted-foreground">senvia.app/f/</span>
                      <span className="text-xs text-primary font-medium">{orgSlug || 'slug'}</span>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-4 p-4 rounded-xl bg-card border border-border">
                  <div className="p-2.5 rounded-lg bg-primary/10 shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Lead preenche o formulário</h3>
                    <p className="text-sm text-muted-foreground">
                      O potencial cliente preenche o nome, email e telefone. Os dados são guardados automaticamente.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-4 p-4 rounded-xl bg-card border border-border">
                  <div className="p-2.5 rounded-lg bg-primary/10 shrink-0">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Aparece no seu Kanban</h3>
                    <p className="text-sm text-muted-foreground">
                      O lead entra automaticamente na primeira coluna do seu pipeline. Basta arrastar para avançar!
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between mt-8">
                <Button
                  variant="ghost"
                  onClick={() => setStep(0)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                <Button onClick={() => setStep(2)} className="gap-2">
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-md mx-auto px-4 sm:px-8 py-8"
            >
              <div className="text-center mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
                  Crie o seu primeiro formulário
                </h1>
                <p className="text-muted-foreground text-sm sm:text-base">
                  Vamos criar o formulário principal para começar a captar leads.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    Nome do formulário
                  </label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex: Formulário Principal"
                    className="bg-muted border-border text-foreground"
                  />
                </div>

                <div className="p-3 rounded-lg bg-card border border-border">
                  <p className="text-xs text-muted-foreground">
                    Pode personalizar os campos e o design do formulário mais tarde nas <strong className="text-foreground">Definições</strong>.
                  </p>
                </div>
              </div>

              <div className="flex justify-between mt-8">
                <Button
                  variant="ghost"
                  onClick={() => setStep(1)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                <Button
                  onClick={handleCreateForm}
                  disabled={!formName.trim() || isCreatingForm}
                  className="gap-2"
                >
                  {isCreatingForm ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Concluir
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
