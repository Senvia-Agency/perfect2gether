import { CornerUpLeft, Loader2, Mic, Paperclip, SendHorizontal, Square, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useVoiceRecorder } from '../useVoiceRecorder';
import type { MessagesController } from '../useMessages';
import { fileSize } from './AttachmentCard';
import { useMessageDraft } from './MessageDrafts';

function DraftAudio({ file }: { readonly file: File }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => { const value = URL.createObjectURL(file); setUrl(value); return () => URL.revokeObjectURL(value); }, [file]);
  return <audio controls src={url} className="h-10 max-w-full" aria-label={`Pré-escutar ${file.name}`} />;
}

export function Composer({ controller, reply, clearReply, inputRef }: { readonly inputRef?: RefObject<HTMLTextAreaElement>; readonly controller: MessagesController; readonly reply: string | null; readonly clearReply: () => void }) {
  const { draft, update, clear } = useMessageDraft(controller.selectedId ?? '');
  const { body, files } = draft;
  const setBody = (value: string) => update({ body: value });
  const setFiles = (value: File[]) => update({ files: value });
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const voice = useVoiceRecorder();
  const fallbackInput = useRef<HTMLTextAreaElement>(null);
  const textarea = inputRef ?? fallbackInput;
  useEffect(() => {
    const element = textarea.current;
    if (!element) return;
    const resize = () => {
      element.style.height = '40px';
      element.style.height = Math.min(120, Math.max(40, element.scrollHeight)) + 'px';
      element.style.overflowY = element.scrollHeight > 120 ? 'auto' : 'hidden';
    };
    resize();
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth !== width) { width = element.clientWidth; resize(); }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [body, voice.recording]);
  function addFiles(incoming: File[]) {
    const max = controller.snapshot?.max_file_bytes;
    if (max && incoming.some(file => file.size > max)) { setError(`Cada ficheiro pode ter até ${fileSize(max)}.`); return; }
    setError(''); setFiles([...files, ...incoming]);
  }
  useEffect(() => { if (voice.recordedFile) { addFiles([voice.recordedFile]); voice.clear(); } }, [voice.recordedFile, voice.clear]);
  const mention = body.match(/@([^@\n]*)$/)?.[1];
  const participants = controller.snapshot?.conversations.find(item => item.id === controller.selectedId)?.members ?? [];
  async function send() {
    if (voice.recording || progress !== null || (!body.trim() && files.length === 0)) return;
    abort.current = new AbortController(); setProgress(0); setError('');
    try { await controller.send(body, files, reply, setProgress, abort.current.signal); clear(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Falha no envio. O rascunho foi guardado.'); }
    finally { setProgress(null); }
  }
  return <div className="shrink-0 bg-card px-3 pb-3 pt-2 sm:px-5 sm:pb-5" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)); }}>
    {reply && <div className="mb-2 flex items-center gap-2 rounded-xl border-l-2 border-primary bg-primary/5 px-3 py-1.5 text-xs text-primary"><CornerUpLeft className="h-3.5 w-3.5" /><span className="flex-1">A responder a uma mensagem</span><Button size="icon" variant="ghost" className="h-10 w-10 shrink-0 rounded-lg" aria-label="Cancelar resposta" onClick={clearReply}><X className="h-3.5 w-3.5" /></Button></div>}
    {files.length > 0 && <ul className="mb-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto">{files.map((file, index) => <li key={`${file.name}-${index}`} className="flex max-w-full items-center gap-2 rounded-xl border bg-muted/30 py-2 pl-3 pr-1"><Paperclip className="h-4 w-4 shrink-0 text-primary" /><div className="min-w-0"><p className="max-w-48 truncate text-xs font-medium">{file.name}</p><p className="text-[11px] text-muted-foreground">{fileSize(file.size)}</p></div>{file.type.startsWith('audio/') && <DraftAudio file={file} />}<Button size="icon" variant="ghost" className="h-10 w-10 shrink-0 rounded-lg" disabled={progress !== null} aria-label={`Remover ${file.name}`} onClick={() => setFiles(files.filter((_, item) => item !== index))}><X className="h-3.5 w-3.5" /></Button></li>)}</ul>}
    <input ref={input} className="hidden" type="file" multiple aria-label="Escolher anexos" onChange={event => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
    <div className="flex items-end gap-1.5 rounded-2xl border border-border/80 bg-muted/35 p-2 transition-colors focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
      <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0 rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary" aria-label="Anexar ficheiros" title={`Anexar ficheiros · até ${controller.snapshot ? fileSize(controller.snapshot.max_file_bytes) : '50 MB'} por ficheiro`} disabled={progress !== null || voice.recording} onClick={() => input.current?.click()}><Paperclip className="h-5 w-5" /></Button>
      {voice.recording ? <div className="flex min-h-10 min-w-0 flex-1 items-center gap-2 px-1 text-sm" role="status"><span className="h-2 w-2 shrink-0 rounded-full bg-destructive" /><span className="truncate text-muted-foreground">A gravar áudio</span><span className="font-medium tabular-nums">{Math.floor(voice.seconds / 60)}:{String(voice.seconds % 60).padStart(2, '0')}</span></div> : <Textarea ref={textarea} rows={1} aria-label="Mensagem" placeholder="Escreve uma mensagem…" value={body} disabled={progress !== null} className="min-h-10 min-w-0 flex-1 resize-none border-0 bg-transparent px-1 py-2.5 text-sm leading-5 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" style={{ height: `${Math.min(120, Math.max(40, (body.split('\n').length) * 20 + 20))}px` }} onChange={event => { setBody(event.target.value); controller.typing(); }} onPaste={event => { const pasted = Array.from(event.clipboardData.files); if (pasted.length) { event.preventDefault(); addFiles(pasted); } }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} />}
      {voice.recording ? <><Button size="icon" variant="ghost" className="h-10 w-10 shrink-0 rounded-xl text-destructive" aria-label="Descartar áudio" onClick={voice.cancel}><X className="h-5 w-5" /></Button><Button size="icon" className="h-10 w-10 shrink-0 rounded-xl" aria-label="Concluir áudio" onClick={() => voice.stop()}><Square className="h-4 w-4 fill-current" /></Button></> : <><Button size="icon" variant="ghost" className="h-10 w-10 shrink-0 rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary" aria-label="Gravar áudio" title="Gravar mensagem de voz" disabled={progress !== null} onClick={() => void voice.start()}><Mic className="h-5 w-5" /></Button><Button size="icon" className="h-10 w-10 shrink-0 rounded-xl shadow-sm" aria-label="Enviar mensagem" title="Enviar mensagem" disabled={progress !== null || (!body.trim() && !files.length)} onClick={() => void send()}>{progress !== null ? <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" /> : <SendHorizontal className="h-5 w-5" />}</Button></>}
    </div>
    {mention !== undefined && <div className="mt-2 max-h-32 overflow-y-auto rounded-xl border bg-card p-1 shadow-sm" aria-label="Mencionar participante">{participants.filter(member => member.name.toLocaleLowerCase().includes(mention.toLocaleLowerCase())).map(member => <Button key={member.id} variant="ghost" className="w-full justify-start rounded-lg" onClick={() => setBody(body.replace(/@([^@\n]*)$/, `@${member.name} `))}>{member.name}</Button>)}</div>}
    {progress !== null && <div role="status" aria-live="polite" className="mt-2 flex items-center gap-3 text-xs text-muted-foreground"><progress value={progress} max={100} className="h-1.5 flex-1 accent-primary" /><span>{Math.round(progress)}%</span><Button size="sm" variant="ghost" onClick={() => abort.current?.abort()}>Cancelar</Button></div>}
    {(error || voice.error) && <div role="alert" className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-destructive/5 p-3 text-xs text-destructive"><p>{error || voice.error}</p>{error && progress === null && (body.trim() || files.length > 0) && <Button size="sm" variant="outline" className="rounded-lg" onClick={() => void send()}>Tentar novamente</Button>}</div>}
  </div>;
}
