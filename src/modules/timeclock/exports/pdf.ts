import type { jsPDF } from 'jspdf';
import type { PersonReport, ReportIdentity } from './monthly';
import { formatDuration } from '../workday';
import { clockTime } from '../components/presentation';

const columns = [12, 43, 62, 81, 100, 119, 143, 165] as const;
function header(pdf: jsPDF, identity: ReportIdentity, report: PersonReport, month: string) {
  pdf.setTextColor(31, 29, 49); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15);
  if (identity.logo) pdf.addImage(identity.logo, 'PNG', 12, 9, 24, 12);
  pdf.text(identity.name, identity.logo ? 40 : 12, 17); pdf.setFontSize(9); pdf.setFont('helvetica', 'normal');
  pdf.text(`NIF: ${identity.nif || 'Por configurar'}`, identity.logo ? 40 : 12, 23);
  pdf.setFontSize(13); pdf.setFont('helvetica', 'bold'); pdf.text('Folha de ponto', 198, 17, { align: 'right' });
  pdf.setFontSize(10); pdf.setFont('helvetica', 'normal'); pdf.text(month, 198, 24, { align: 'right' });
  pdf.text(`${report.person.name} | ${report.person.role}${report.person.is_active ? '' : ' | Inativo'}`, 12, 34);
  pdf.setFontSize(8); pdf.text('Horário Europe/Lisbon | * Correção manual | P Pendente | I Incompleto', 12, 41);
  pdf.setFillColor(242, 240, 250); pdf.rect(12, 45, 186, 8, 'F');
  ['Dia', 'Entrada 1', 'Saída 1', 'Entrada 2', 'Saída 2', 'Trabalho', 'Pausas', 'Estado'].forEach((label, index) => { const x = columns[index]; if (x !== undefined) pdf.text(label, x + 1, 50); });
}
function footers(pdf: jsPDF) {
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) { pdf.setPage(page); pdf.setFontSize(8); pdf.setTextColor(110, 106, 125); pdf.text('Perfect2Gether · Registos pendentes sujeitos a validação', 12, 288); pdf.text(`${page} / ${pages}`, 198, 288, { align: 'right' }); }
}
export async function buildMonthlyPdf(reports: readonly PersonReport[], month: string, identity: ReportIdentity) {
  const { jsPDF: Pdf } = await import('jspdf');
  const reportIdentity = { ...identity, logo: identity.logo ? await logoImage(identity.logo) : null };
  const pdf = new Pdf({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let first = true;
  for (const report of reports) {
    if (!first) pdf.addPage(); first = false; header(pdf, reportIdentity, report, month);
    let y = 53;
    for (const day of report.summary.days) {
      const notes = [...day.pairs.slice(2).map(pair => `${clockTime(pair.in)} - ${pair.out ? clockTime(pair.out) : 'aberto'}`), day.holiday, ...day.notes, ...day.flags].filter(Boolean).join(' | ');
      const lines: string[] = notes ? pdf.splitTextToSize(notes, 182) : [];
      const height = 5.2 + Math.min(lines.length, 6) * 3.2;
      if (y + height > 245) { pdf.addPage(); header(pdf, reportIdentity, report, month); y = 53; }
      const weekend = [0, 6].includes(new Date(day.date + 'T12:00:00Z').getUTCDay());
      if (weekend || day.holiday) { pdf.setFillColor(247, 246, 250); pdf.rect(12, y, 186, height, 'F'); }
      pdf.setFontSize(8); pdf.setTextColor(40, 37, 54);
      const cells = [day.date.slice(8) + (day.corrected ? ' *' : ''), ...[0, 1].flatMap(index => { const pair = day.pairs[index]; return [pair ? clockTime(pair.in) : '-', pair?.out ? clockTime(pair.out) : pair ? 'aberto' : '-']; }), formatDuration(day.workSeconds), formatDuration(day.pauseSeconds), [day.pending ? 'P' : '', day.incomplete ? 'I' : ''].filter(Boolean).join(' / ') || '-'];
      cells.forEach((cell, index) => { const x = columns[index]; if (x !== undefined) pdf.text(cell, x + 1, y + 3.8); });
      y += 5.2;
      for (const line of lines) {
        if (y + 4 > 245) { pdf.addPage(); header(pdf, reportIdentity, report, month); y = 57; pdf.setFontSize(7); pdf.text(`${day.date} - observações (continuação)`, 14, y); y += 5; }
        pdf.setTextColor(105, 100, 118); pdf.setFontSize(7); pdf.text(line, 14, y + 2); y += 3.2;
      }
      pdf.setDrawColor(232, 229, 239); pdf.line(12, y, 198, y);
    }
    if (y > 235) { pdf.addPage(); header(pdf, reportIdentity, report, month); y = 59; }
    pdf.setTextColor(31, 29, 49); pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.text(`Total: ${formatDuration(report.summary.workSeconds)} | Pausas: ${formatDuration(report.summary.pauseSeconds)}`, 12, y + 10);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.text(`${report.summary.incompleteDays} dia(s) incompleto(s) · ${report.summary.days.filter(day => day.pending).length} dia(s) pendente(s)`, 12, y + 17);
    pdf.line(12, y + 35, 91, y + 35); pdf.line(119, y + 35, 198, y + 35); pdf.text('Assinatura do colaborador', 12, y + 40); pdf.text('Assinatura da entidade empregadora', 119, y + 40);
  }
  if (reports.length === 0) { pdf.setFontSize(12); pdf.text('Sem colaboradores ou registos neste período.', 12, 20); }
  footers(pdf); return pdf;
}

export async function downloadPdf(reports: readonly PersonReport[], month: string, identity: ReportIdentity) {
  const pdf = await buildMonthlyPdf(reports, month, identity);
  pdf.save(`folha-ponto-${month}.pdf`);
}

function logoImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 200;
      const context = canvas.getContext('2d');
      if (!context) { reject(new Error('Não foi possível preparar o logótipo.')); return; }
      const scale = Math.min(400 / image.naturalWidth, 200 / image.naturalHeight);
      context.drawImage(image, (400 - image.naturalWidth * scale) / 2, (200 - image.naturalHeight * scale) / 2, image.naturalWidth * scale, image.naturalHeight * scale);
      try { resolve(canvas.toDataURL('image/png')); } catch (error) { reject(error); }
    };
    image.onerror = () => reject(new Error('Não foi possível carregar o logótipo da organização para o PDF.')); image.src = url;
  });
}
