import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, Nfc, Pause, Play, Power } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { useTimeClock } from '../useTimeClock';
import type { Action } from '../types';
import { formatDuration } from '../workday';
import { actionLabels, stateLabels } from './presentation';
import '../timeclock.css';

const tagInput = z.object({ id: z.string().uuid('Etiqueta inválida.'), token: z.string().min(1).optional(), counter: z.coerce.number().int().min(0).max(16777215).optional(), picc_data: z.string().regex(/^[a-fA-F0-9]{32}$/).optional(), cmac: z.string().regex(/^[a-fA-F0-9]{16}$/).optional() }).refine(value => value.token || (value.picc_data && value.cmac && value.counter !== undefined), 'A etiqueta não contém credenciais válidas. Volte a aproximar o dispositivo.');
export function NfcPunch() {
  const location = useLocation(), navigate = useNavigate();
  const clock = useTimeClock(undefined, undefined, 1000);
  const [scan] = useState(() => {
    const query = new URLSearchParams(location.search);
    const id = query.get('tag') ?? query.get('id') ?? '';
    const parsed = tagInput.safeParse({ id, ...(query.get('token') ? { token: query.get('token') } : {}), ...(query.has('counter') ? { counter: query.get('counter') } : {}), ...(query.get('picc_data') ? { picc_data: query.get('picc_data') } : {}), ...(query.get('cmac') ? { cmac: query.get('cmac') } : {}) });
    if (parsed.success === false) return { success: false as const, error: parsed.error };
    return { success: true as const, data: { ...parsed.data, id } };
  });
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  useEffect(() => { if (location.search) navigate(location.pathname, { replace: true, state: location.state }); }, [location.pathname, location.search, location.state, navigate]);
  async function punch(action: Action) {
    if (scan.success === false) return;
    setMessage('');
    try { await clock.punch(action, { tag: scan.data, note }); setSuccess(true); setMessage(`${actionLabels[action]} registado com sucesso.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível validar esta etiqueta.'); }
  }
  const busy = clock.phase !== 'idle';
  return <div className="workspace-theme p-4 sm:p-6"><section className="ponto-card mx-auto max-w-lg"><div className="ponto-card-header"><div className="flex gap-3 items-center"><Nfc className="text-primary" size={26} /><div><h1 className="font-semibold">Registar ponto com NFC</h1><p className="text-xs text-muted-foreground mt-1">Confirme o registo para a sua conta.</p></div></div></div><div className="p-5 space-y-5">{!scan.success ? <p role="alert" className="text-sm text-destructive">{scan.error.issues[0]?.message ?? 'Etiqueta inválida.'}</p> : success ? <div className="flex gap-3 items-center text-sm" role="status"><CheckCircle2 className="text-green-600" />{message}</div> : <><div className="clock-summary"><p className="text-sm font-medium">{stateLabels[clock.state.status]}</p><p className="text-2xl font-semibold mt-2 tabular-nums">{formatDuration(clock.state.workedSeconds)}</p><p className="text-xs text-muted-foreground mt-2">A etiqueta será validada no servidor ao confirmar.</p></div><label className="clock-field">Observação<textarea className="border p-3" maxLength={300} rows={2} value={note} onChange={event => setNote(event.target.value)} /></label><div className="clock-actions">{clock.state.status === 'closed' ? <Button disabled={busy || clock.isLoading || !!clock.error} onClick={() => void punch(clock.state.canResumeDay ? 'resume' : 'start')}><Play size={16} />{clock.state.canResumeDay ? 'Retomar dia' : 'Iniciar dia'}</Button> : <><Button variant="outline" disabled={busy} onClick={() => void punch(clock.state.status === 'working' ? 'pause' : 'resume')}>{clock.state.status === 'working' ? <Pause size={16} /> : <Play size={16} />}{clock.state.status === 'working' ? 'Pausa' : 'Retomar'}</Button><Button disabled={busy} onClick={() => void punch('stop')}><Power size={16} />Terminar dia</Button></>}</div>{busy && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 size={16} className="animate-spin" />A validar etiqueta…</p>}{message && <p role="alert" className="text-sm text-destructive">{message}</p>}</>}{clock.error && <p role="alert" className="text-sm text-destructive">{clock.error.message}</p>}<Link to="/rh?tab=ponto" className="inline-flex items-center min-h-10 text-sm text-primary">Abrir folha de ponto</Link></div></section></div>;
}
