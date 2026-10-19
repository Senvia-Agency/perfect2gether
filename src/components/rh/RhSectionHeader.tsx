import type { ElementType, ReactNode } from "react";

export function RhSectionHeader({ icon: Icon, title, description, children }: {
  readonly icon: ElementType;
  readonly title: string;
  readonly description: string;
  readonly children?: ReactNode;
}) {
  return <header className="rh-section-header">
    <div className="flex min-w-0 items-center gap-3">
      <span className="rh-section-icon"><Icon className="h-5 w-5" aria-hidden="true" /></span>
      <div className="min-w-0"><h2 className="text-xl font-semibold tracking-tight">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>
    </div>
    {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
  </header>;
}
