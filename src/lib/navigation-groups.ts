export interface NavigationGroup<T> {
  readonly label: string;
  readonly items: readonly T[];
}

const primary = [
  { label: 'Geral', routes: ['/dashboard', '/messages', '/portal-total-link'] },
  { label: 'Comercial', routes: ['/leads', '/clients', '/proposals', '/sales'] },
  { label: 'Operação', routes: ['/financeiro', '/calendar', '/rh'] },
] as const;
const secondary = [
  { label: 'Crescimento', routes: ['/marketing', '/prospects', '/ecommerce'] },
  { label: 'Administração', routes: ['/gestao', '/settings'] },
] as const;

export function groupNavigationItems<T extends { readonly to: string }>(items: readonly T[]) {
  const group = (sections: readonly { readonly label: string; readonly routes: readonly string[] }[]): readonly NavigationGroup<T>[] =>
    sections.map(section => ({
      label: section.label,
      items: section.routes.flatMap(route => items.filter(item => item.to === route)),
    })).filter(section => section.items.length > 0);
  return {
    primarySections: group(primary),
    secondarySections: group(secondary),
    mobileShortcuts: ['/dashboard', '/messages', '/leads'].flatMap(route => items.filter(item => item.to === route)),
  };
}
