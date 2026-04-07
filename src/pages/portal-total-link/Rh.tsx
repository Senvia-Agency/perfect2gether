import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePermissions } from "@/hooks/usePermissions";
import { useRhHolidays } from "@/hooks/useRhHolidays";
import { useMyAbsences, useDeleteAbsence } from "@/hooks/useRhAbsences";
import RhVacationBalance from "@/components/portal-total-link/rh/RhVacationBalance";
import RhAbsenceRequestForm from "@/components/portal-total-link/rh/RhAbsenceRequestForm";
import RhAbsenceCard from "@/components/portal-total-link/rh/RhAbsenceCard";
import RhAdminPanel from "@/components/portal-total-link/rh/RhAdminPanel";

export default function Rh() {
  const [showRequestForm, setShowRequestForm] = useState(false);
  const { isAdmin } = usePermissions();
  const { data: holidays = [] } = useRhHolidays();
  const { data: myAbsences = [], isLoading } = useMyAbsences();
  const deleteAbsence = useDeleteAbsence();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try { await deleteAbsence.mutateAsync(id); } finally { setCancellingId(null); }
  };

  return (
    <div className="space-y-6">
      {/* My Balance */}
      <RhVacationBalance />

      {/* Action Button */}
      <Button onClick={() => setShowRequestForm(true)} className="w-full sm:w-auto">
        <Plus className="h-4 w-4 mr-2" /> Marcar Ausência
      </Button>

      {/* My Absences */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Os Meus Pedidos</h3>
        {isLoading ? (
          <Card><CardContent className="py-8 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></CardContent></Card>
        ) : myAbsences.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Ainda não tem pedidos de ausência.</CardContent></Card>
        ) : (
          <div className="grid gap-4">
            {myAbsences.map(absence => (
              <RhAbsenceCard
                key={absence.id}
                absence={absence}
                onCancel={() => handleCancel(absence.id)}
                isCancelling={cancellingId === absence.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Admin Panel */}
      {isAdmin && (
        <div className="pt-4 border-t">
          <RhAdminPanel />
        </div>
      )}

      {/* Request Form Dialog */}
      <RhAbsenceRequestForm
        open={showRequestForm}
        onOpenChange={setShowRequestForm}
        holidays={holidays}
      />
    </div>
  );
}
