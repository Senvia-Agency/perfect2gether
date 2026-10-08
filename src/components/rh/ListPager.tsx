import { Button } from "@/components/ui/button";
export function ListPager({page,total,size,onChange}: {
  readonly page: number; readonly total: number; readonly size: number; readonly onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages === 1) return null;
  return <nav aria-label="Paginação" className="flex items-center justify-end gap-3 pt-3">
    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</Button>
    <span className="text-sm text-muted-foreground">{page} / {pages}</span>
    <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Seguinte</Button>
  </nav>;
}
