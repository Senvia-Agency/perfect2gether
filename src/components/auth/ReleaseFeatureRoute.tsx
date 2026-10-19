import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useReleaseFeatures } from '@/hooks/useReleaseFeatures';
export function ReleaseFeatureRoute({ feature, children }: { readonly feature: 'messages' | 'timeclock'; readonly children: ReactNode }) {
  const { features, isPending } = useReleaseFeatures();
  if (isPending) return <div role="status" className="p-6">A carregar…</div>;
  return features[feature] ? children : <Navigate to="/dashboard" replace />;
}
