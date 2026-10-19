import { useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { getAttachmentUrl } from '../api';
import type { Attachment } from '../types';

export function fileSize(bytes: number) {
  return bytes >= 1073741824 ? `${(bytes / 1073741824).toFixed(1)} GB` : bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

export function AttachmentCard({ attachment, gallery = [] }: { readonly attachment: Attachment; readonly gallery?: readonly Attachment[] }) {
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(attachment);
  const [imageUrl, setImageUrl] = useState<string>();
  const index = gallery.findIndex(item => item.id === active.id);
  useEffect(() => { if (!open) return; let alive = true; void getAttachmentUrl(active.path).then(value => { if (alive) setImageUrl(value); }).catch((failure: unknown) => { if (alive) setError(failure instanceof Error ? failure.message : 'Imagem indisponível.'); }); return () => { alive = false; }; }, [active.path, open]);
  async function refresh() {
    try { setError(''); setUrl(await getAttachmentUrl(attachment.path)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível abrir o ficheiro.'); }
  }
  useEffect(() => { void refresh(); }, [attachment.path]);
  return <div className="chat-attachment max-w-full space-y-2">
    <div className="chat-file-row"><span className="chat-file-icon" aria-hidden="true"><FileText className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="break-words text-sm font-semibold [overflow-wrap:anywhere]">{attachment.name}</div><p className="chat-secondary mt-1 text-xs">{attachment.name.split('.').pop()?.toUpperCase()} · {fileSize(attachment.size)}</p></div>{url && <a className="chat-file-download" href={url} target="_blank" rel="noopener noreferrer" download={attachment.name} aria-label={`Descarregar ${attachment.name}`} title="Descarregar ficheiro"><Download className="h-4 w-4" /></a>}</div>
    {url && attachment.mime.startsWith('image/') && <button type="button" className="block min-h-10" aria-label={`Ampliar ${attachment.name}`} onClick={() => setOpen(true)}><img src={url} alt={attachment.name} className="max-h-56 rounded object-contain" onError={() => setError('A ligação expirou. Volte a abrir o ficheiro.')} /></button>}
    {url && attachment.mime.startsWith('audio/') && <audio controls preload="metadata" src={url} className="max-w-full" />}
    {url && attachment.mime.startsWith('video/') && <video controls preload="metadata" src={url} className="max-h-72 max-w-full" />}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {(!url || error) && <Button variant="outline" size="sm" onClick={() => void refresh()}>Voltar a abrir</Button>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="messages-theme !max-w-4xl rounded-3xl bg-card"><DialogTitle>{active.name}</DialogTitle><DialogDescription>Pré-visualização da imagem · {index + 1} de {gallery.length || 1}</DialogDescription><img src={imageUrl} alt={active.name} className="max-h-[65dvh] w-full object-contain" /><div className="flex justify-between"><Button variant="outline" disabled={index <= 0} onClick={() => { const previous = gallery[index - 1]; if (previous) { setImageUrl(undefined); setActive(previous); } }}>Anterior</Button><Button variant="outline" disabled={index < 0 || index >= gallery.length - 1} onClick={() => { const next = gallery[index + 1]; if (next) { setImageUrl(undefined); setActive(next); } }}>Seguinte</Button></div></DialogContent></Dialog>
  </div>;
}

