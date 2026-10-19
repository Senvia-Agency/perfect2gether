import type { ElementType } from 'react';
import { cn } from '@/lib/utils';

const colors: Readonly<Record<string, string>> = {
  '/dashboard': 'from-violet-400 to-indigo-500',
  '/leads': 'from-sky-400 to-blue-500',
  '/clients': 'from-teal-400 to-emerald-500',
  '/proposals': 'from-orange-400 to-rose-500',
  '/sales': 'from-emerald-400 to-teal-600',
  '/financeiro': 'from-amber-400 to-orange-500',
  '/calendar': 'from-rose-400 to-pink-500',
  '/marketing': 'from-sky-400 to-indigo-500',
  '/prospects': 'from-cyan-400 to-sky-600',
  '/ecommerce': 'from-fuchsia-400 to-purple-500',
  '/messages': 'from-violet-400 to-violet-600',
  '/rh': 'from-purple-400 to-fuchsia-500',
  '/settings': 'from-slate-400 to-slate-600',
  '/gestao': 'from-indigo-400 to-blue-600',
};

export function NavigationIcon({ icon: Icon, route, small = false, locked = false }: { readonly icon: ElementType; readonly route: string; readonly small?: boolean; readonly locked?: boolean }) {
  return <span aria-hidden="true" className={cn('inline-flex shrink-0 items-center justify-center bg-gradient-to-br text-white shadow-sm', small ? 'h-8 w-8 rounded-xl' : 'h-9 w-9 rounded-xl', colors[route] ?? 'from-violet-400 to-indigo-500', locked && 'opacity-40 grayscale')}><Icon className={small ? 'h-4 w-4' : 'h-[18px] w-[18px]'} strokeWidth={1.8} /></span>;
}
