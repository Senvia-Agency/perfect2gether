import { FormSettings, CustomField } from '@/types';
import { Sparkles, CheckCircle2 } from 'lucide-react';

interface FormPreviewProps {
  settings: FormSettings;
  showSuccess?: boolean;
}

function CustomFieldPreview({ field, primaryColor }: { field: CustomField; primaryColor: string }) {
  const isRequired = field.required;
  
  switch (field.type) {
    case 'text':
    case 'number':
      return (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">
            {field.label} {isRequired && '*'}
          </label>
          <div className="h-10 rounded-lg border bg-muted/30 px-3 flex items-center">
            <span className="text-sm text-muted-foreground/50">
              {field.placeholder || (field.type === 'number' ? '0' : 'Digite aqui...')}
            </span>
          </div>
        </div>
      );
    
    case 'textarea':
      return (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">
            {field.label} {isRequired && '*'}
          </label>
          <div className="h-20 rounded-lg border bg-muted/30 px-3 py-2">
            <span className="text-sm text-muted-foreground/50">
              {field.placeholder || 'Digite o texto aqui...'}
            </span>
          </div>
        </div>
      );
    
    case 'select':
      return (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">
            {field.label} {isRequired && '*'}
          </label>
          <div className="h-10 rounded-lg border bg-muted/30 px-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground/50">
              {field.options?.[0] || 'Selecione...'}
            </span>
            <svg className="h-4 w-4 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      );
    
    case 'checkbox':
      return (
        <div className="flex items-start gap-3 rounded-lg border p-3">
          <div 
            className="mt-0.5 h-4 w-4 rounded border-2"
            style={{ borderColor: primaryColor }}
          />
          <span className="text-xs text-foreground leading-tight">
            {field.label} {isRequired && '*'}
          </span>
        </div>
      );
    
    default:
      return null;
  }
}

export function FormPreview({ settings, showSuccess = false }: FormPreviewProps) {
  const sortedCustomFields = [...(settings.custom_fields || [])].sort((a, b) => a.order - b.order);

  if (showSuccess) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border bg-card p-8 text-center">
        <div 
          className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: settings.primary_color + '15' }}
        >
          <CheckCircle2 className="h-8 w-8" style={{ color: settings.primary_color }} />
        </div>
        <h3 className="text-xl font-semibold text-card-foreground">
          {settings.success_message.title || 'Obrigado!'}
        </h3>
        <p className="mt-2 text-muted-foreground text-sm">
          {settings.success_message.description || 'Entraremos em contacto brevemente.'}
        </p>
        <button 
          className="mt-6 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors"
        >
          Enviar outra mensagem
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      {/* Header */}
      <div className="mb-6 text-center">
        {settings.logo_url ? (
          <img 
            src={settings.logo_url} 
            alt="Logo" 
            className="mx-auto mb-4 h-12 w-auto object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div 
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: settings.primary_color }}
          >
            <Sparkles className="h-6 w-6 text-white" />
          </div>
        )}
        <h2 
          className="text-xl font-bold"
          style={{ color: settings.primary_color }}
        >
          {settings.title || 'Contacte-nos'}
        </h2>
        {settings.subtitle && (
          <p className="mt-2 text-muted-foreground text-sm">
            {settings.subtitle}
          </p>
        )}
      </div>

      {/* Form Fields Preview */}
      <div className="space-y-4">
        {/* Fixed Fields - conditionally rendered based on visibility */}
        {settings.fields.name.visible && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              {settings.fields.name.label} {settings.fields.name.required && '*'}
            </label>
            <div className="h-10 rounded-lg border bg-muted/30 px-3 flex items-center">
              <span className="text-sm text-muted-foreground/50">João Silva</span>
            </div>
          </div>
        )}

        {settings.fields.email.visible && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              {settings.fields.email.label} {settings.fields.email.required && '*'}
            </label>
            <div className="h-10 rounded-lg border bg-muted/30 px-3 flex items-center">
              <span className="text-sm text-muted-foreground/50">joao@exemplo.pt</span>
            </div>
          </div>
        )}

        {settings.fields.phone.visible && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              {settings.fields.phone.label} {settings.fields.phone.required && '*'}
            </label>
            <div className="h-10 rounded-lg border bg-muted/30 flex items-center overflow-hidden">
              <div className="px-3 border-r bg-muted/50 h-full flex items-center gap-1.5">
                <span className="text-base leading-none">🇵🇹</span>
                <span className="text-xs text-muted-foreground">+351</span>
              </div>
              <span className="px-3 text-sm text-muted-foreground/50">912 345 678</span>
            </div>
          </div>
        )}

        {settings.fields.message.visible && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              {settings.fields.message.label} {settings.fields.message.required && '*'}
            </label>
            <div className="h-20 rounded-lg border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground/50">A sua mensagem aqui...</span>
            </div>
          </div>
        )}

        {/* Custom Fields */}
        {sortedCustomFields.map((field) => (
          <CustomFieldPreview 
            key={field.id} 
            field={field} 
            primaryColor={settings.primary_color} 
          />
        ))}

        {/* GDPR Checkbox Preview */}
        <div className="flex items-start gap-3 rounded-lg border p-3">
          <div 
            className="mt-0.5 h-4 w-4 rounded border-2 flex items-center justify-center"
            style={{ borderColor: settings.primary_color, backgroundColor: settings.primary_color }}
          >
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-xs text-muted-foreground leading-tight">
            Li e aceito a Política de Privacidade
          </span>
        </div>

        {/* Submit Button */}
        <button 
          className="w-full h-11 rounded-lg text-white font-medium text-sm transition-all hover:opacity-90"
          style={{ backgroundColor: settings.primary_color }}
        >
          Enviar mensagem
        </button>

        <p className="text-center text-[10px] text-muted-foreground">
          Os seus dados estão protegidos em conformidade com o RGPD
        </p>
      </div>
    </div>
  );
}