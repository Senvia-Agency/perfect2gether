import { useReleaseFeatures } from '@/hooks/useReleaseFeatures';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const controls = [{ key: 'messages', label: 'Mensagens' }, { key: 'timeclock', label: 'Relógio de ponto' }, { key: 'new_ui', label: 'Nova navegação e apresentação de RH' }] as const;
export function ReleaseFeatures() {
  const { features, update } = useReleaseFeatures();
  if (!features.can_manage) return null;
  return <Card><CardHeader><CardTitle>Funcionalidades da organização</CardTitle><CardDescription>Pode desativar módulos ou recuperar a apresentação anterior. Os dados e registos são preservados.</CardDescription></CardHeader>
    <CardContent className="space-y-4">{controls.map(({ key, label }) => <div key={key} className="flex items-center justify-between gap-4"><Label htmlFor={`release-${key}`}>{label}</Label><Switch id={`release-${key}`} checked={features[key]} disabled={update.isPending} onCheckedChange={checked => update.mutate({ messages: features.messages, timeclock: features.timeclock, new_ui: features.new_ui, [key]: checked })} /></div>)}{update.isError && <p role="alert" className="text-sm text-destructive">Não foi possível guardar. Tente novamente.</p>}</CardContent></Card>;
}
