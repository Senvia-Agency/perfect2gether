import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, Ellipsis } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { NavItem } from '@/hooks/useNavItems';
import type { NavigationGroup } from '@/lib/navigation-groups';
import { NavigationIcon } from './NavigationIcon';

type Props = {
  readonly primary: readonly NavigationGroup<NavItem>[];
  readonly secondary: readonly NavigationGroup<NavItem>[];
  readonly pathname: string;
  readonly renderItem: (item: NavItem) => ReactNode;
};

export function NavigationSections({ primary, secondary, pathname, renderItem }: Props) {
  const secondaryActive = secondary.some(group => group.items.some(item => pathname === item.to || pathname.startsWith(item.to + '/')));
  const [open, setOpen] = useState(secondaryActive);
  useEffect(() => { if (secondaryActive) setOpen(true); }, [pathname, secondaryActive]);
  const sections = (groups: readonly NavigationGroup<NavItem>[]) => groups.map(group => (
    <section key={group.label} aria-label={group.label} className="p2g-nav-section">
      <h2 className="p2g-nav-section-label">{group.label}</h2>
      <div className="space-y-1">{group.items.map(renderItem)}</div>
    </section>
  ));
  return <>
    {sections(primary)}
    {secondary.length > 0 && <Collapsible open={open} onOpenChange={setOpen} className="p2g-nav-more">
      <CollapsibleTrigger className="p2g-nav-link flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 py-1.5 text-sm font-medium" data-active={secondaryActive}>
        <NavigationIcon icon={Ellipsis} route="/settings" />
        <span className="flex-1 text-left">Mais</span>
        <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent><div className="p2g-nav-secondary">{sections(secondary)}</div></CollapsibleContent>
    </Collapsible>}
  </>;
}
