import { ChevronDown, FileCheck2, Loader2, Upload, UploadCloud, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUploadClientDocument } from '@/hooks/useClientDocuments';
import {
  CLIENT_DOCUMENT_CATEGORY_OPTIONS,
  parseClientDocumentCategory,
  prepareClientDocumentUploadMetadata,
  type ClientDocumentArchiveItem,
  type ClientDocumentCategory,
  type ClientDocumentPerson,
} from '@/lib/client-documents';
import type { EdpDocumentSide } from '@/lib/edp/types';
import { cn } from '@/lib/utils';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export type ClientDocumentUploadPreset = {
  readonly category?: ClientDocumentCategory;
  readonly side?: EdpDocumentSide;
  readonly file?: File | null;
  /** Documento existente: o ficheiro entra como nova versão dele. */
  readonly document?: ClientDocumentArchiveItem;
};

type ClientDocumentUploadDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly clientId: string;
  readonly people: readonly ClientDocumentPerson[];
  readonly preset: ClientDocumentUploadPreset;
  readonly onUploaded: (message: string) => void;
};

const SIDE_OPTIONS = [
  { value: 'single', label: 'Frente e verso juntos' },
  { value: 'front', label: 'Só a frente' },
  { value: 'back', label: 'Só o verso' },
] as const satisfies readonly { readonly value: EdpDocumentSide; readonly label: string }[];

/** Documentos de uma pessoa (CC) ou só da empresa (CRC, fatura); os restantes podem ser de qualquer um. */
const PERSON_CATEGORIES: readonly ClientDocumentCategory[] = ['CC'];
const COMPANY_CATEGORIES: readonly ClientDocumentCategory[] = ['CRC', 'Fatura'];

function categoryLabel(category: ClientDocumentCategory): string {
  return CLIENT_DOCUMENT_CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? category;
}

function categoryFromDocument(document: ClientDocumentArchiveItem | undefined): ClientDocumentCategory | null {
  if (!document) return null;
  try {
    return parseClientDocumentCategory(document.category);
  } catch {
    return 'Outro';
  }
}

export function ClientDocumentUploadDialog({ open, onOpenChange, clientId, people, preset, onUploaded }: ClientDocumentUploadDialogProps) {
  const fieldId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadClientDocument(clientId);
  const [category, setCategory] = useState<ClientDocumentCategory | null>(null);
  const [customLabel, setCustomLabel] = useState('');
  const [personId, setPersonId] = useState<string | null>(null);
  const [side, setSide] = useState<EdpDocumentSide>('single');
  const [validity, setValidity] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isNewVersion = Boolean(preset.document);
  // Aberto a partir de um documento necessário ou de um documento existente: o tipo já é conhecido.
  const isCategoryLocked = isNewVersion || Boolean(preset.category);
  const isPersonDocument = category !== null && PERSON_CATEGORIES.includes(category);
  const isCompanyDocument = category !== null && COMPANY_CATEGORIES.includes(category);
  // Com uma só pessoa no cliente, o CC é dela; não há nada a escolher.
  const ownerId = isNewVersion
    ? preset.document?.personId ?? null
    : isCompanyDocument ? null
    : isPersonDocument && personId === null && people.length === 1 ? people[0].id
    : personId;
  // Numa nova versão a pessoa é a do documento (o servidor não a altera), mesmo que tenha ficado sem pessoa.
  const missingOwner = !isNewVersion && isPersonDocument && people.length > 1 && ownerId === null;
  const showOwnerChoice = !isNewVersion && !isCompanyDocument && (isPersonDocument ? people.length > 1 : people.length > 0);
  const ownerName = ownerId ? people.find((person) => person.id === ownerId)?.name ?? null : null;

  // Cada abertura começa do zero, só com o que o ponto de entrada já sabe (tipo, face, ficheiro largado, documento).
  useEffect(() => {
    if (!open) return;
    const presetCategory = preset.category ?? categoryFromDocument(preset.document);
    setCategory(presetCategory);
    setSide(preset.side ?? 'single');
    setPersonId(preset.document?.personId ?? null);
    setCustomLabel('');
    setValidity('');
    setFile(preset.file ?? null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [open, preset]);

  const chooseFile = (selectedFile: File | null) => {
    setFile(selectedFile);
    setError(null);
    // Sem isto, voltar a escolher o mesmo ficheiro depois de o remover não dispara onChange.
    if (!selectedFile && fileInputRef.current) fileInputRef.current.value = '';
  };

  const chooseCategory = (value: ClientDocumentCategory) => {
    setCategory(value);
    setSide('single');
    setPersonId(null);
  };

  const dropFile = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    chooseFile(event.dataTransfer.files.item(0));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || !category) {
      setError(!file ? 'Escolha o ficheiro.' : 'Escolha o tipo de documento.');
      return;
    }
    if (missingOwner) {
      setError('Escolha a pessoa a quem pertence o cartão.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('O ficheiro excede o limite de 10 MB.');
      return;
    }

    const metadata = prepareClientDocumentUploadMetadata({
      category,
      customLabel: preset.document?.label ?? customLabel,
      fileName: file.name,
      side,
    });
    setError(null);
    try {
      await upload.mutateAsync({
        documentId: preset.document?.documentId,
        personId: ownerId,
        category: preset.document?.category ?? metadata.category,
        label: metadata.label,
        side: metadata.side,
        validityConfirmedOn: validity || null,
        file,
      });
      onUploaded(isNewVersion ? 'Nova versão adicionada.' : 'Documento adicionado.');
      onOpenChange(false);
    } catch (uploadError) {
      if (uploadError instanceof Error) setError(uploadError.message);
      else throw uploadError;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!upload.isPending) onOpenChange(next); }}>
      <DialogContent className="sm:max-w-lg">
        <form className="space-y-5" onSubmit={(event) => void submit(event)}>
          <DialogHeader>
            <DialogTitle>
              {isNewVersion ? 'Nova versão' : isCategoryLocked && category ? categoryLabel(category) : 'Adicionar documento'}
            </DialogTitle>
            <DialogDescription>
              {[isNewVersion ? preset.document?.label : null, isCategoryLocked ? ownerName : null, 'PDF, JPG ou PNG até 10 MB.']
                .filter(Boolean)
                .join(' · ')}
            </DialogDescription>
          </DialogHeader>

          <div
            className={cn(
              'rounded-lg border-2 border-dashed p-4 text-center transition-colors',
              isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20',
            )}
            onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setIsDragging(false)}
            onDrop={dropFile}
          >
            <Label htmlFor={`${fieldId}-file`} className="sr-only">Ficheiro</Label>
            {/* Input nativo: o <Input> do shadcn traz w-full, que anula o sr-only e faz scroll horizontal na janela. */}
            <input
              ref={fileInputRef}
              id={`${fieldId}-file`}
              className="sr-only"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(event) => chooseFile(event.currentTarget.files?.item(0) ?? null)}
            />
            {file ? (
              <div className="flex items-center gap-3 text-left">
                <FileCheck2 className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                </div>
                <Button type="button" variant="ghost" size="icon" aria-label="Remover ficheiro selecionado" onClick={() => chooseFile(null)}>
                  <X aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <button type="button" className="w-full space-y-1 py-2" onClick={() => fileInputRef.current?.click()}>
                <UploadCloud className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium">Arraste o ficheiro ou <span className="text-primary underline-offset-2 hover:underline">escolha do computador</span></p>
              </button>
            )}
          </div>

          {!isCategoryLocked && (
            <ChipGroup label="Tipo">
              {CLIENT_DOCUMENT_CATEGORY_OPTIONS.map((option) => (
                <Chip key={option.value} selected={category === option.value} onClick={() => chooseCategory(option.value)}>
                  {option.label}
                </Chip>
              ))}
            </ChipGroup>
          )}

          {showOwnerChoice && (
            <ChipGroup label={isPersonDocument ? 'De quem é o cartão?' : 'Pertence a'}>
              {!isPersonDocument && <Chip selected={ownerId === null} onClick={() => setPersonId(null)}>Empresa</Chip>}
              {people.map((person) => (
                <Chip key={person.id} selected={ownerId === person.id} onClick={() => setPersonId(person.id)}>{person.name}</Chip>
              ))}
            </ChipGroup>
          )}

          {/* A face só se pergunta num CC novo; quando falta uma das faces, o cartão já a indica. */}
          {category === 'CC' && !preset.side && (
            <ChipGroup label="O ficheiro tem">
              {SIDE_OPTIONS.map((option) => (
                <Chip key={option.value} selected={side === option.value} onClick={() => setSide(option.value)}>{option.label}</Chip>
              ))}
            </ChipGroup>
          )}

          <Collapsible>
            <CollapsibleTrigger className="group flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
              <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
              Mais opções
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 grid gap-3 sm:grid-cols-2">
              {!isNewVersion && (
                <div className="space-y-1.5">
                  <Label htmlFor={`${fieldId}-label`}>Nome</Label>
                  <Input id={`${fieldId}-label`} maxLength={200} value={customLabel} onChange={(event) => setCustomLabel(event.currentTarget.value)} placeholder="Nome do ficheiro" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor={`${fieldId}-validity`}>Válido até</Label>
                <Input id={`${fieldId}-validity`} type="date" value={validity} onChange={(event) => setValidity(event.currentTarget.value)} />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={upload.isPending}>Cancelar</Button>
            <Button type="submit" disabled={upload.isPending || !file || !category || missingOwner}>
              {upload.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
              {upload.isPending ? 'A carregar...' : 'Carregar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChipGroup({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Chip({ selected, onClick, children }: { readonly selected: boolean; readonly onClick: () => void; readonly children: ReactNode }) {
  return (
    <Button type="button" size="sm" variant={selected ? 'default' : 'outline'} aria-pressed={selected} className="h-8 rounded-full" onClick={onClick}>
      {children}
    </Button>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('pt-PT', { maximumFractionDigits: 1 })} KiB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-PT', { maximumFractionDigits: 1 })} MiB`;
}
