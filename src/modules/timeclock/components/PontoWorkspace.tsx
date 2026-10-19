import { useState } from 'react';
import { Download, FileDown, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTimeClock } from '../useTimeClock';
import { clockApi } from '../api';
import { currentMonth, formatDuration } from '../workday';
import { downloadCsv, reportsFor } from '../exports/monthly';
import { downloadPdf } from '../exports/pdf';
import { MonthlySheet } from './MonthlySheet';
import { EntryManager } from './EntryManager';
import { ClockConfiguration } from './ClockConfiguration';
import { NfcManager } from './NfcManager';
import { ReportIdentity } from './ReportIdentity';
import { clockTime } from './presentation';
import '../timeclock.css';

export function PontoWorkspace() {
  const [month, setMonth] = useState(currentMonth(Date.now()));
  const [person, setPerson] = useState('');
  const [tab, setTab] = useState('sheet');
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');
  const clock = useTimeClock(month, person || undefined);
  const snapshot = clock.snapshot;
  const selected = person || clock.userId;
  const nif = snapshot?.report_identity.nif;
  async function exportPdf(all = false) {
    if (!snapshot) return;
    setExporting(true); setMessage('');
    try { await downloadPdf(reportsFor(all && clock.organizationId ? await clockApi.snapshot(clock.organizationId, month) : snapshot, month, all ? undefined : selected, clock.now), month, { name: snapshot.report_identity.name, nif: snapshot.report_identity.nif, logo: snapshot.report_identity.logo_url }); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível gerar o PDF.'); } finally { setExporting(false); }
  }
  async function exportCsv(all = false) {
    if (!snapshot) return;
    setMessage('');
    try { const data = all && clock.organizationId ? await clockApi.snapshot(clock.organizationId, month) : snapshot; downloadCsv(reportsFor(data, month, all ? undefined : selected), month); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível exportar.'); }
  }
  if (clock.isLoading) return <div className="ponto-blank" role="status">A carregar folha de ponto…</div>;
  if (!snapshot) return <div className="ponto-blank" role="alert"><p>{clock.error?.message ?? 'Não foi possível carregar a folha de ponto.'}</p><Button className="mt-4" variant="outline" onClick={() => void clock.refresh()}>Tentar novamente</Button></div>;
  const pending = clock.summary.days.filter(day => day.pending).length;
  return <div className="ponto-workspace"><header className="ponto-toolbar"><div><h2>Folha de ponto</h2><p>{snapshot.can_manage ? 'Acompanhe os registos e valide o tempo da equipa.' : 'O seu tempo de trabalho, num só lugar.'}</p></div><div className="ponto-controls"><input aria-label="Mês da folha de ponto" type="month" value={month} onChange={event => { if (/^\d{4}-\d{2}$/.test(event.target.value)) setMonth(event.target.value); }} />{snapshot.can_manage && <select aria-label="Colaborador da folha de ponto" value={person} onChange={event => setPerson(event.target.value)}><option value="">A minha folha</option>{snapshot.people.filter(item => item.id !== clock.userId).map(item => <option key={item.id} value={item.id}>{item.name}{!item.is_active && ' (inativo)'}</option>)}</select>}<Button variant="outline" aria-label="Atualizar folha de ponto" onClick={() => void clock.refresh()}><RefreshCw size={16} /></Button></div></header>
    <nav className="ponto-tabs" aria-label="Vistas de ponto"><button aria-pressed={tab === 'sheet'} onClick={() => setTab('sheet')}>Folha mensal</button>{snapshot.can_manage && <button aria-pressed={tab === 'review'} onClick={() => setTab('review')}>Gestão de registos</button>}<button aria-pressed={tab === 'history'} onClick={() => setTab('history')}>Histórico</button>{snapshot.can_configure && <button aria-pressed={tab === 'configuration'} onClick={() => setTab('configuration')}>Configuração</button>}</nav>
    {(clock.error || message) && <p className="ponto-notice" role="alert">{message || clock.error?.message}</p>}
    {tab === 'sheet' && <><div className="ponto-stats">{[{ label: 'Horas trabalhadas', value: formatDuration(clock.summary.workSeconds) }, { label: 'Média por dia', value: formatDuration(clock.summary.averageSeconds) }, { label: 'Dias com registos', value: String(clock.summary.daysWithEntries) }, { label: 'Dias pendentes', value: String(pending) }].map(stat => <div className="ponto-stat" key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong></div>)}</div><div className="ponto-toolbar"><p className="text-xs text-muted-foreground">{snapshot.people.find(item => item.id === selected)?.name ?? 'A minha folha'} · Europe/Lisbon</p><div className="ponto-controls"><Button variant="outline" onClick={() => void exportCsv()}><Download size={15} />CSV</Button><Button disabled={exporting} onClick={() => void exportPdf()}><FileDown size={15} />{exporting ? 'A gerar…' : 'Descarregar PDF'}</Button>{snapshot.can_manage && <><Button variant="outline" onClick={() => void exportCsv(true)}>CSV da equipa</Button><Button variant="outline" disabled={exporting} onClick={() => void exportPdf(true)}>PDF da equipa</Button></>}</div></div>{!nif && <p className="text-xs text-muted-foreground">NIF da entidade por configurar na Configuração de ponto.</p>}<MonthlySheet summary={clock.summary} /></>}
    {tab === 'review' && snapshot.can_manage && clock.organizationId && clock.userId && <EntryManager entries={snapshot.entries} people={snapshot.people} userId={clock.userId} org={clock.organizationId} refresh={clock.refresh} />}
    {tab === 'history' && <section className="ponto-card"><div className="ponto-card-header"><h3>Histórico de alterações</h3><span className="text-xs text-muted-foreground">Registo de auditoria</span></div>{snapshot.history.length === 0 ? <p className="ponto-blank">Sem alterações neste período.</p> : <ol className="ponto-audit">{snapshot.history.map(item => <li key={item.id}><div className="flex justify-between gap-3"><strong>{item.action}</strong><small>{new Date(item.created_at).toLocaleDateString('pt-PT')} {clockTime(item.created_at)}</small></div><p>{item.reason}</p><small>{snapshot.people.find(value => value.id === item.actor_id)?.name ?? 'Utilizador autorizado'}{item.entry_id ? ` · Registo ${item.entry_id.slice(0, 8)}` : ''}</small><details><summary className="cursor-pointer text-xs text-primary">Ver alteração</summary><pre className="text-[10px] whitespace-pre-wrap break-all mt-2">{JSON.stringify({ antes: item.before, depois: item.after }, null, 2)}</pre></details></li>)}</ol>}</section>}
    {tab === 'configuration' && snapshot.can_configure && clock.organizationId && <><ReportIdentity snapshot={snapshot} org={clock.organizationId} refresh={clock.refresh} /><ClockConfiguration snapshot={snapshot} org={clock.organizationId} refresh={clock.refresh} /><NfcManager snapshot={snapshot} org={clock.organizationId} refresh={clock.refresh} /></>}
  </div>;
}
