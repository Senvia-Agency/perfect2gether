import { useMemo } from 'react';
import { useOrganization } from './useOrganization';
import { getClientLabels, NicheLabels, NICHE_CLIENT_LABELS } from '@/lib/niche-labels';
import { NicheType } from '@/lib/pipeline-templates';
import { useModules } from './useModules';

export function useClientLabels(): NicheLabels {
  const { data: org } = useOrganization();
  const { modules } = useModules();
  
  return useMemo(() => {
    const niche = (org?.niche as NicheType) || 'generic';
    const labels = getClientLabels(niche);

    // When energy module is off for telecom, revert to generic status labels
    if (niche === 'telecom' && !modules.energy) {
      const generic = NICHE_CLIENT_LABELS.generic;
      return {
        ...labels,
        vip: generic.vip,
        active: generic.active,
        inactive: generic.inactive,
        statusFieldLabel: generic.statusFieldLabel,
        statusActive: generic.statusActive,
        statusInactive: generic.statusInactive,
        statusVip: generic.statusVip,
      };
    }

    return labels;
  }, [org?.niche, modules.energy]);
}
