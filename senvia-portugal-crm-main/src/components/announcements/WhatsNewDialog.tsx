import { useAnnouncements } from '@/hooks/useAnnouncements';
import { isPerfect2GetherOrg } from '@/lib/perfect2gether';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface WhatsNewDialogProps {
  organizationId?: string | null;
}

export function WhatsNewDialog({ organizationId }: WhatsNewDialogProps) {
  const { announcement, shouldShow, markAsSeen } = useAnnouncements();

  if (isPerfect2GetherOrg(organizationId)) return null;
  if (!shouldShow || !announcement) return null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) markAsSeen(); }}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            {announcement.title}
            {announcement.version && (
              <span className="text-xs font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {announcement.version}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {announcement.image_url && (
          <img
            src={announcement.image_url}
            alt={announcement.title}
            className="w-full rounded-lg object-cover max-h-48"
          />
        )}

        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown>{announcement.content}</ReactMarkdown>
        </div>

        <DialogFooter>
          <Button onClick={markAsSeen} className="w-full sm:w-auto">
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
