import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LEAD_CLIENT_SEGMENTS, LEAD_CLIENT_SEGMENT_LABELS, leadClientSegmentSchema, type LeadClientSegment } from '@/lib/lead-classification';

interface Props {
  readonly id?: string;
  readonly value?: LeadClientSegment;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly onValueChange: (value: LeadClientSegment) => void;
}

export function LeadClientSegmentSelect({ id, value, disabled, className, onValueChange }: Props) {
  return (
    <Select value={value ?? ''} disabled={disabled} onValueChange={raw => onValueChange(leadClientSegmentSchema.parse(raw))}>
      <SelectTrigger id={id} className={className} aria-label="Segmento do Cliente">
        <SelectValue placeholder="Selecionar segmento" />
      </SelectTrigger>
      <SelectContent>
        {LEAD_CLIENT_SEGMENTS.map(segment => (
          <SelectItem key={segment} value={segment}>{LEAD_CLIENT_SEGMENT_LABELS[segment]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
