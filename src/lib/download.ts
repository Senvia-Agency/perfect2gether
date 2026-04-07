import { supabase } from "@/integrations/supabase/client";

export async function downloadFileFromUrl(url: string, filename: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Download failed');
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

export async function openPdfInNewTab(path: string) {
  let url = path;
  if (!path.startsWith('http')) {
    const { data, error } = await supabase.storage
      .from('invoices')
      .createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      throw new Error('Erro ao gerar link');
    }
    url = data.signedUrl;
  }
  window.open(url, '_blank');
}
