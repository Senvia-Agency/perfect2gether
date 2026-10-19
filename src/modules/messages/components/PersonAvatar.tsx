import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const colors = ['bg-teal-500', 'bg-blue-500', 'bg-violet-500', 'bg-rose-500', 'bg-amber-500', 'bg-cyan-500'];

export function PersonAvatar({ name, image, className, colorful = false }: { readonly name: string; readonly image?: string | null; readonly className?: string; readonly colorful?: boolean }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  return <Avatar className={cn('h-10 w-10 text-sm', colorful ? 'rounded-full' : 'rounded-xl', className)}>
    {image && <AvatarImage src={image} alt="" />}
    <AvatarFallback className={cn('text-[inherit] font-semibold', colorful ? `${colors[Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length]} rounded-full text-white` : 'rounded-xl bg-primary/10 text-primary')}>{initials || '?'}</AvatarFallback>
  </Avatar>;
}
