import { useState } from 'react';
import { usePersistedState } from "@/hooks/usePersistedState";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useInternalRequests } from '@/hooks/useInternalRequests';
import { usePermissions } from '@/hooks/usePermissions';
import { RequestsTable } from '@/components/finance/RequestsTable';
import { SubmitRequestModal } from '@/components/finance/SubmitRequestModal';
import { ReviewRequestModal } from '@/components/finance/ReviewRequestModal';
import type { InternalRequest, RequestType, RequestStatus } from '@/types/internal-requests';

export default function InternalRequests() {
  const [filterType, setFilterType] = usePersistedState<RequestType | 'all'>('requests-type-v1', 'all');
  const [filterStatus, setFilterStatus] = usePersistedState<RequestStatus | 'all'>('requests-status-v1', 'all');
  const [showSubmit, setShowSubmit] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<InternalRequest | null>(null);

  const filters = {
    ...(filterType !== 'all' && { type: filterType }),
    ...(filterStatus !== 'all' && { status: filterStatus }),
  };

  const { requests, isLoading, deleteRequest, pendingCount } = useInternalRequests(
    Object.keys(filters).length > 0 ? filters as { type?: RequestType; status?: RequestStatus } : undefined
  );
  const { can } = usePermissions();
  const canApprove = can('finance', 'requests', 'approve');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pedidos Internos</h2>
          {canApprove && pendingCount > 0 && (
            <p className="text-sm text-muted-foreground">{pendingCount} pedido(s) pendente(s)</p>
          )}
        </div>
        <Button size="sm" onClick={() => setShowSubmit(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Novo Pedido
        </Button>
      </div>

      <RequestsTable
        requests={requests}
        isLoading={isLoading}
        onSelect={setSelectedRequest}
        onDelete={(id) => deleteRequest.mutate(id)}
        filterType={filterType}
        filterStatus={filterStatus}
        onFilterType={setFilterType}
        onFilterStatus={setFilterStatus}
      />

      <SubmitRequestModal open={showSubmit} onOpenChange={setShowSubmit} />
      <ReviewRequestModal
        request={selectedRequest}
        open={!!selectedRequest}
        onOpenChange={(open) => !open && setSelectedRequest(null)}
        canApprove={canApprove}
      />
    </div>
  );
}
