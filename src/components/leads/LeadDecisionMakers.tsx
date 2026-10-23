import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { parseDecisionMakers } from '@/lib/decision-makers';
import type { Json } from '@/integrations/supabase/types';

export function LeadDecisionMakers({ customData }: { readonly customData: Json | null }) {
  const value = customData && typeof customData === 'object' && !Array.isArray(customData)
    ? customData.decision_makers : undefined;
  const people = parseDecisionMakers(value);
  if (!people.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Decisores ({people.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {people.map((person, index) => (
            <li key={`${person.name}-${index}`} className="space-y-1 py-3 first:pt-0 last:pb-0">
              <p className="break-words text-sm font-medium">{person.name}</p>
              {person.role && <p className="break-words text-xs text-muted-foreground">{person.role}</p>}
              {person.phone && <p className="break-all text-sm">{person.phone}</p>}
              {person.email && <p className="break-all text-sm">{person.email}</p>}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
