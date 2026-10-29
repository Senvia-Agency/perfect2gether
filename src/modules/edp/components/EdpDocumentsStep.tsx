import { Download, FileCheck2, Loader2, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CLIENT_DOCUMENT_CATEGORY_OPTIONS,
  parseClientDocumentCategory,
  prepareClientDocumentUploadMetadata,
  type ClientDocumentCategory,
} from "@/lib/client-documents";
import type { EdpDocumentSide } from "@/lib/edp/types";
import type {
  EdpDocumentUploadResponse,
  EdpDocumentVersion,
  EdpDraftPayload,
  EdpPersonRole,
} from "@/lib/edp/validation";
import type { EdpDocumentUploadInput } from "../api";
import { toggleDocumentVersion } from "../payload";

type EdpDocumentsStepProps = {
  readonly clientId: string;
  readonly payload: EdpDraftPayload;
  readonly documents: readonly EdpDocumentVersion[];
  readonly people: readonly EdpPersonRole[];
  readonly onChange: (payload: EdpDraftPayload) => void;
  readonly onUpload: (input: EdpDocumentUploadInput) => Promise<EdpDocumentUploadResponse>;
  readonly onDownload: (versionId: string) => Promise<void>;
  readonly canManage: boolean;
};

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function EdpDocumentsStep({
  clientId,
  payload,
  documents,
  people,
  onChange,
  onUpload,
  onDownload,
  canManage,
}: EdpDocumentsStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<ClientDocumentCategory | null>(null);
  const [customLabel, setCustomLabel] = useState("");
  const [side, setSide] = useState<EdpDocumentSide>("single");
  const [personId, setPersonId] = useState<string | null>(null);
  const [validity, setValidity] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [downloadPending, setDownloadPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const selectedDocuments = documents.filter((document) => payload.selected_document_version_ids.includes(document.version_id));
  const selectedBytes = selectedDocuments.reduce((total, document) => total + document.size_bytes, 0);
  const uniquePeople = useMemo(() => {
    const names = new Map<string, string>();
    for (const person of people) if (!names.has(person.person_id)) names.set(person.person_id, person.name);
    return [...names.entries()];
  }, [people]);

  const submitUpload = async () => {
    if (!file || !category) {
      setMessage("Escolha o tipo de documento e o ficheiro.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setMessage("O ficheiro excede o limite de 10 MiB.");
      return;
    }

    const metadata = prepareClientDocumentUploadMetadata({
      category,
      customLabel,
      fileName: file.name,
      side,
    });
    setPending(true);
    setMessage(null);
    try {
      const uploaded = await onUpload({
        clientId,
        personId,
        category: metadata.category,
        label: metadata.label,
        side: metadata.side,
        validityConfirmedOn: validity || null,
        file,
      });
      onChange(toggleDocumentVersion(payload, uploaded.version_id, true));
      setCustomLabel("");
      setValidity("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage("Documento carregado e selecionado.");
    } catch (error) {
      if (error instanceof Error) setMessage(error.message);
      else throw error;
    } finally {
      setPending(false);
    }
  };

  const download = async (versionId: string) => {
    setDownloadPending(versionId);
    setMessage(null);
    try {
      await onDownload(versionId);
    } catch (error) {
      if (error instanceof Error) setMessage(error.message);
      else throw error;
    } finally {
      setDownloadPending(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3" aria-labelledby="edp-selected-documents-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 id="edp-selected-documents-title" className="text-sm font-semibold">Anexos do envio</h3>
            <p className="text-xs text-muted-foreground">Selecione apenas as versões que devem integrar este processo.</p>
          </div>
          <Badge variant="outline">{selectedDocuments.length} ficheiro(s) · {formatBytes(selectedBytes)}</Badge>
        </div>

        {documents.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Ainda não existem documentos neste cliente.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {documents.map((document) => {
              const selected = payload.selected_document_version_ids.includes(document.version_id);
              const owner = document.person_id ? uniquePeople.find(([id]) => id === document.person_id)?.[1] : null;
              return (
                <div key={document.version_id} className="flex min-w-0 items-start gap-3 p-3">
                  <Checkbox
                    aria-label={`Selecionar ${document.original_name}`}
                    checked={selected}
                    disabled={!canManage}
                    onCheckedChange={(checked) => onChange(toggleDocumentVersion(payload, document.version_id, checked === true))}
                    className="mt-1"
                  />
                  <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium">{document.label}</p>
                    <p className="break-all text-xs text-muted-foreground">
                      {document.original_name} · {formatBytes(document.size_bytes)} · versão {document.version_id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {document.category}{owner ? ` · ${owner}` : ""}{document.validity_confirmed_on ? ` · válida até ${document.validity_confirmed_on}` : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Descarregar ${document.original_name}`}
                    disabled={downloadPending === document.version_id}
                    onClick={() => void download(document.version_id)}
                  >
                    {downloadPending === document.version_id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Download className="h-4 w-4" />}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {canManage && <section className="space-y-4 rounded-lg border bg-muted/20 p-4" aria-labelledby="edp-upload-title">
        <div>
          <h3 id="edp-upload-title" className="text-sm font-semibold">Adicionar documento privado</h3>
          <p className="text-xs text-muted-foreground">PDF, JPEG ou PNG; máximo 10 MiB. O servidor valida conteúdo, MIME e autorização.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="edp-document-category" label="Tipo de documento">
            <Select value={category ?? undefined} onValueChange={(value) => {
              const selectedCategory = parseClientDocumentCategory(value);
              setCategory(selectedCategory);
              setSide(selectedCategory === "CC" ? "front" : "single");
            }}>
              <SelectTrigger id="edp-document-category"><SelectValue placeholder="Selecionar tipo" /></SelectTrigger>
              <SelectContent>
                {CLIENT_DOCUMENT_CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="edp-document-label" label="Nome personalizado (opcional)">
            <Input id="edp-document-label" maxLength={200} value={customLabel} onChange={(event) => setCustomLabel(event.currentTarget.value)} placeholder="Usaremos o nome do ficheiro" />
          </Field>
          <Field id="edp-document-person" label="Interveniente">
            <Select value={personId ?? "client"} onValueChange={(value) => setPersonId(value === "client" ? null : value)}>
              <SelectTrigger id="edp-document-person"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Cliente</SelectItem>
                {uniquePeople.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {category === "CC" && (
            <Field id="edp-document-side" label="Face do cartão">
              <Select value={side} onValueChange={(value) => {
                if (value === "single" || value === "front" || value === "back") setSide(value);
              }}>
                <SelectTrigger id="edp-document-side"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="front">Frente</SelectItem>
                  <SelectItem value="back">Verso</SelectItem>
                  <SelectItem value="single">Frente e verso juntos</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field id="edp-document-validity" label="Validade confirmada">
            <Input id="edp-document-validity" type="date" value={validity} onChange={(event) => setValidity(event.currentTarget.value)} />
          </Field>
          <Field id="edp-document-file" label="Ficheiro">
            <Input ref={fileInputRef} id="edp-document-file" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setFile(event.currentTarget.files?.item(0) ?? null)} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{message}</p>
          <Button type="button" onClick={() => void submitUpload()} disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {pending ? "A carregar..." : "Carregar e selecionar"}
          </Button>
        </div>
      </section>}
    </div>
  );
}

function Field({ id, label, children }: { readonly id: string; readonly label: string; readonly children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} KiB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} MiB`;
}
