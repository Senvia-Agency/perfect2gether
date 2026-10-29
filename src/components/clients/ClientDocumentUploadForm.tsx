import { FileCheck2, Loader2, Upload, UploadCloud, X } from 'lucide-react';
import { useId, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUploadClientDocument } from '@/hooks/useClientDocuments';
import {
  CLIENT_DOCUMENT_CATEGORY_OPTIONS,
  parseClientDocumentCategory,
  prepareClientDocumentUploadMetadata,
  type ClientDocumentCategory,
  type ClientDocumentPerson,
} from '@/lib/client-documents';
import type { EdpDocumentSide } from '@/lib/edp/types';
import { cn } from '@/lib/utils';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

type ClientDocumentUploadFormProps = {
  readonly clientId: string;
  readonly people: readonly ClientDocumentPerson[];
  readonly onCancel: () => void;
};

type UploadMessage = {
  readonly kind: 'error' | 'success';
  readonly text: string;
};

export function ClientDocumentUploadForm({ clientId, people, onCancel }: ClientDocumentUploadFormProps) {
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
  const [message, setMessage] = useState<UploadMessage | null>(null);

  const chooseFile = (selectedFile: File | null) => {
    setFile(selectedFile);
    setMessage(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || !category) {
      setMessage({ kind: 'error', text: 'Escolha o tipo de documento e o ficheiro.' });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setMessage({ kind: 'error', text: 'O ficheiro excede o limite de 10 MB.' });
      return;
    }

    const metadata = prepareClientDocumentUploadMetadata({ category, customLabel, fileName: file.name, side });
    setMessage(null);
    try {
      await upload.mutateAsync({
        personId,
        category: metadata.category,
        label: metadata.label,
        side: metadata.side,
        validityConfirmedOn: validity || null,
        file,
      });
      setCustomLabel('');
      setValidity('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setMessage({ kind: 'success', text: 'Documento adicionado.' });
    } catch (error) {
      if (error instanceof Error) setMessage({ kind: 'error', text: error.message });
      else throw error;
    }
  };

  const dropFile = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    chooseFile(event.dataTransfer.files.item(0));
  };

  return (
    <form id={`${fieldId}-form`} className="space-y-4 rounded-lg border bg-muted/20 p-4" onSubmit={(event) => void submit(event)}>
      <div>
        <h4 className="text-base font-semibold">Adicionar documento</h4>
        <p className="text-sm text-muted-foreground">Escolha um ficheiro e indique a quem pertence.</p>
      </div>

      <div
        className={cn('rounded-lg border-2 border-dashed bg-background p-4 text-center transition-colors', isDragging ? 'border-primary bg-primary/5' : 'border-border')}
        onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={dropFile}
      >
        <Label htmlFor={`${fieldId}-file`} className="sr-only">Ficheiro</Label>
        <Input
          ref={fileInputRef}
          id={`${fieldId}-file`}
          className="sr-only"
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          onChange={(event) => chooseFile(event.currentTarget.files?.item(0) ?? null)}
        />
        {file ? (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <FileCheck2 className="h-6 w-6 text-primary" aria-hidden="true" />
            <div className="min-w-0 text-left">
              <p className="break-all text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Remover ficheiro selecionado" onClick={() => chooseFile(null)}>
              <X aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <UploadCloud className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Arraste o ficheiro para aqui</p>
              <p className="text-xs text-muted-foreground">PDF, JPG ou PNG até 10 MB</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>Escolher ficheiro</Button>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={`${fieldId}-category`} label="Tipo de documento">
          <Select value={category ?? undefined} onValueChange={(value) => {
            const selectedCategory = parseClientDocumentCategory(value);
            setCategory(selectedCategory);
            setSide(selectedCategory === 'CC' ? 'front' : 'single');
          }}>
            <SelectTrigger id={`${fieldId}-category`}><SelectValue placeholder="Selecionar tipo" /></SelectTrigger>
            <SelectContent>
              {CLIENT_DOCUMENT_CATEGORY_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        <Field id={`${fieldId}-person`} label="Associar a">
          <Select value={personId ?? 'client'} onValueChange={(value) => setPersonId(value === 'client' ? null : value)}>
            <SelectTrigger id={`${fieldId}-person`}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="client">Cliente / empresa</SelectItem>
              {people.map((person) => <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        <Field id={`${fieldId}-label`} label="Nome personalizado (opcional)">
          <Input id={`${fieldId}-label`} maxLength={200} value={customLabel} onChange={(event) => setCustomLabel(event.currentTarget.value)} placeholder="Usaremos o nome do ficheiro" />
        </Field>

        <Field id={`${fieldId}-validity`} label="Validade (opcional)">
          <Input id={`${fieldId}-validity`} type="date" value={validity} onChange={(event) => setValidity(event.currentTarget.value)} />
        </Field>

        {category === 'CC' && (
          <Field id={`${fieldId}-side`} label="Face do cartão">
            <Select value={side} onValueChange={(value) => {
              if (value === 'single' || value === 'front' || value === 'back') setSide(value);
            }}>
              <SelectTrigger id={`${fieldId}-side`}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="front">Frente</SelectItem>
                <SelectItem value="back">Verso</SelectItem>
                <SelectItem value="single">Frente e verso juntos</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role={message?.kind === 'error' ? 'alert' : 'status'} aria-live="polite" className={cn('text-sm', message?.kind === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
          {message?.text}
        </p>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={upload.isPending}>Cancelar</Button>
          <Button type="submit" disabled={upload.isPending}>
            {upload.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
            {upload.isPending ? 'A adicionar...' : 'Adicionar documento'}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Field({ id, label, children }: { readonly id: string; readonly label: string; readonly children: ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('pt-PT', { maximumFractionDigits: 1 })} KiB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-PT', { maximumFractionDigits: 1 })} MiB`;
}
