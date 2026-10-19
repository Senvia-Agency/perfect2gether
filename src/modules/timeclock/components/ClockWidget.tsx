import { useReleaseFeatures } from '@/hooks/useReleaseFeatures';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ChevronRight, Clock3, Loader2, MapPin, MessageSquarePlus, Pause, Pencil, Play, Power } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useTimeClock } from '../useTimeClock';
import { formatDuration, getClockState, localDate } from '../workday';
import type { Action } from '../types';
import { actionLabels, clockTime, entryLocation, stateLabels, statusLabels } from './presentation';
import '@/components/layout/workspace-theme.css';
import '../timeclock.css';

export function ClockWidget() {
  const { features } = useReleaseFeatures();
  const [open, setOpen] = useState(false);
  const clock = useTimeClock(undefined, undefined, open ? 1000 : 30000);
  const now = clock.now;
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [manual, setManual] = useState(false);
  const [at, setAt] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { setNote(''); setAt(''); setManual(false); setNoteOpen(false); setMessage(''); }, [clock.organizationId, clock.userId]);
  const entries = clock.currentSnapshot?.entries.filter(entry => entry.user_id === clock.userId) ?? [];
  const state = getClockState(entries, now, 'Europe/Lisbon');
  const stateLabel = state.status === 'closed' && !state.startedAt ? 'Por iniciar' : stateLabels[state.status];
  const today = localDate(now, 'Europe/Lisbon');
  const todayEntries = entries.filter(entry => localDate(Date.parse(entry.punched_at), 'Europe/Lisbon') === today);
  const busy = clock.phase !== 'idle';
  async function punch(action: Action) {
    setMessage('');
    if (manual && (!at || (note.match(/\p{L}/gu)?.length ?? 0) < 3)) { setMessage('Indique a hora e uma justificação com pelo menos 3 letras.'); return; }
    try {
      await clock.punch(action, { note, ...(manual ? { at: new Date(at).toISOString() } : {}) });
      setMessage('Registo guardado.'); setNote(''); setAt(''); setManual(false); setNoteOpen(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível registar o ponto.'); }
  }
  if (!features.timeclock) return null;
  return <Popover open={open} onOpenChange={value => { setOpen(value); if (value) clock.warmup(); }}>
    <PopoverTrigger asChild><button className="clock-pill" aria-label={`Relógio de ponto: ${stateLabel}, ${formatDuration(state.workedSeconds)}`}>
      <span className={`clock-dot ${state.status}`} /><time>{clockTime(now)}</time><span className="clock-pill-detail">{stateLabel} <span>{formatDuration(state.workedSeconds)}</span></span>
    </button></PopoverTrigger>
    <PopoverContent align="end" sideOffset={10} collisionPadding={12} className="workspace-theme clock-popover" aria-label="Relógio de ponto">
      <section className="clock-summary">
        <div className="clock-summary-line"><span className={`clock-dot ${state.status}`} /><span>{stateLabel}</span><span className="clock-divider" /><strong className="tabular-nums">{formatDuration(state.status === 'paused' ? state.currentPauseSeconds : state.workedSeconds, true)}</strong><button className="clock-icon" aria-label="Corrigir hora do próximo registo" aria-pressed={manual} onClick={() => { setManual(!manual); setNoteOpen(true); }}><Pencil size={14} /></button><Link to="/rh?tab=ponto" className="clock-icon ml-auto" aria-label="Abrir folha de ponto" onClick={() => setOpen(false)}><ChevronRight size={16} /></Link></div>
        <p className="clock-subline">{state.startedAt ? `Início ${clockTime(state.startedAt)}` : 'Pronto para começar'} · Pausas {formatDuration(state.pauseSeconds)}</p>
        <div className="clock-actions">
          {state.status === 'closed' ? <Button disabled={busy || clock.isLoading || !!clock.error} className="clock-main" onClick={() => void punch(state.canResumeDay ? 'resume' : 'start')}><Play size={16} /> {state.canResumeDay ? 'Retomar dia' : 'Iniciar dia'}</Button> : <>
            <Button variant="outline" disabled={busy} onClick={() => void punch(state.status === 'working' ? 'pause' : 'resume')}>{state.status === 'working' ? <Pause size={16} /> : <Play size={16} />}{state.status === 'working' ? 'Pausa' : 'Retomar'}</Button>
            <Button disabled={busy} className="clock-main" onClick={() => void punch('stop')}><Power size={16} /> Terminar dia</Button>
          </>}

        </div>
        <button className="clock-note-toggle" aria-expanded={noteOpen} onClick={() => { if (noteOpen) setManual(false); setNoteOpen(!noteOpen); }}><MessageSquarePlus size={14} />{noteOpen ? 'Fechar observação' : 'Adicionar observação'}</button>
        {noteOpen && <div className="space-y-2 mt-2">{manual && <label className="clock-field">Hora do próximo registo<Input type="datetime-local" value={at} onChange={event => setAt(event.target.value)} /></label>}<label className="clock-field">{manual ? 'Justificação da correção' : 'Observação do próximo registo'}<Textarea value={note} onChange={event => setNote(event.target.value)} maxLength={300} rows={2} placeholder="Escreva uma observação…" /></label>{manual && <p className="text-xs text-muted-foreground">A correção fica pendente de validação.</p>}</div>}
        {busy && <p role="status" className="clock-feedback"><Loader2 size={14} className="animate-spin" />{clock.phase === 'locating' ? 'A obter localização…' : 'A guardar registo…'}</p>}
        {message && <p role="status" className="clock-feedback">{message}</p>}
        {clock.error && <div role="alert" className="clock-error">{clock.error.message}<Button size="sm" variant="outline" onClick={() => { void (clock.canRetry ? clock.retry() : clock.refresh()).catch(error => setMessage(error instanceof Error ? error.message : 'Não foi possível repetir.')); }}>Tentar novamente</Button></div>}
      </section>
      <section className="clock-timeline" aria-label="Registos de hoje"><h2>Hoje</h2>
        {clock.isLoading ? <p role="status" className="clock-empty">A carregar registos…</p> : todayEntries.length === 0 ? <div className="clock-empty"><Clock3 size={24} /><p>Ainda sem registos hoje</p><span>Comece o dia para iniciar a contagem.</span></div> : <ol>{todayEntries.map(entry => <li key={entry.id} className={entry.status === 'voided' ? 'clock-voided' : ''}><span className={`clock-event ${entry.action === 'pause' ? 'pause' : entry.action === 'stop' ? 'stop' : 'start'}`}>{entry.action === 'pause' ? <Pause size={15} /> : entry.action === 'stop' ? <Power size={15} /> : <Play size={15} />}</span><div className="min-w-0"><strong>{actionLabels[entry.action]}{entry.corrected && ' *'}</strong><span className="clock-location"><MapPin size={11} />{entryLocation(entry)}</span>{entry.status !== 'valid' && <span className={`clock-badge ${entry.status}`}>{statusLabels[entry.status]}</span>}{entry.note && <p className="clock-entry-note">{entry.note}</p>}</div><time>{clockTime(entry.punched_at)}</time></li>)}</ol>}
      </section>
      <Link className="clock-full-link" to="/rh?tab=ponto" onClick={() => setOpen(false)}>Ver folha de ponto <ArrowUpRight size={14} /></Link>
    </PopoverContent>
  </Popover>;
}
