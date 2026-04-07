import { useState } from "react";
import { Users, Settings2, Plus, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrgAbsences, useOrgVacationBalances, useUpdateVacationBalance, useOrgMembers, type RhAbsence } from "@/hooks/useRhAbsences";
import { useAuth } from "@/contexts/AuthContext";
import RhAbsenceCard from "./RhAbsenceCard";
import RhAbsenceApprovalDialog from "./RhAbsenceApprovalDialog";
import RhAdminOverlapCheck from "./RhAdminOverlapCheck";

export default function RhAdminPanel() {
  const { organization } = useAuth();
  const { data: absences = [] } = useOrgAbsences();
  const { data: balances = [] } = useOrgVacationBalances();
  const { data: orgMembers = [] } = useOrgMembers();
  const updateBalance = useUpdateVacationBalance();

  const [approvalAbsence, setApprovalAbsence] = useState<RhAbsence | null>(null);
  const [approvalMode, setApprovalMode] = useState<"approve" | "reject">("approve");
  const [showBalanceDialog, setShowBalanceDialog] = useState(false);
  const [editBalance, setEditBalance] = useState<{ userId: string; userName: string; totalDays: number } | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberUserId, setNewMemberUserId] = useState("");
  const [newMemberDays, setNewMemberDays] = useState(22);

  const pendingAbsences = absences.filter(a => a.status === "pending");
  const currentYear = new Date().getFullYear();

  // Build set of user_ids that have a balance configured
  const usersWithBalance = new Set((balances as any[]).map(b => b.user_id));

  // Members that don't have a balance yet
  const existingUserIds = new Set((balances as any[]).map(b => b.user_id));
  const availableMembers = orgMembers.filter(m => !existingUserIds.has(m.user_id));

  const handleSaveBalance = async () => {
    if (!editBalance || !organization?.id) return;
    await updateBalance.mutateAsync({
      organizationId: organization.id,
      userId: editBalance.userId,
      year: currentYear,
      totalDays: editBalance.totalDays,
    });
    setEditBalance(null);
    setShowBalanceDialog(false);
  };

  const handleAddMember = async () => {
    if (!newMemberUserId || !organization?.id) return;
    await updateBalance.mutateAsync({
      organizationId: organization.id,
      userId: newMemberUserId,
      year: currentYear,
      totalDays: newMemberDays,
    });
    setNewMemberUserId("");
    setNewMemberDays(22);
    setShowAddMember(false);
  };

  return (
    <div className="space-y-6">
      {/* Team Balances Overview */}
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <CalendarDays className="h-5 w-5" />
          Saldos da Equipa — {currentYear}
        </h3>
        {balances.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Nenhum saldo configurado. Clique em "Gerir Saldos" para adicionar.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Membro</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Utilizados</TableHead>
                    <TableHead className="text-center">Disponíveis</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(balances as any[]).map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.user_name}</TableCell>
                      <TableCell className="text-center">{b.total_days}</TableCell>
                      <TableCell className="text-center">{b.used_days}</TableCell>
                      <TableCell className="text-center font-semibold text-primary">
                        {b.total_days - b.used_days}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pending Requests */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Pedidos da Equipa
            {pendingAbsences.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                {pendingAbsences.length} pendente{pendingAbsences.length !== 1 ? "s" : ""}
              </span>
            )}
          </h3>
          <Button variant="outline" size="sm" onClick={() => setShowBalanceDialog(true)}>
            <Settings2 className="h-4 w-4 mr-2" /> Gerir Saldos
          </Button>
        </div>

        {pendingAbsences.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Sem pedidos pendentes de aprovação.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pendingAbsences.map(absence => (
              <div key={absence.id}>
                {absence.absence_type === "vacation" && !usersWithBalance.has(absence.user_id) && (
                  <div className="mb-1 px-3 py-1.5 text-xs rounded-md bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                    ⚠️ {absence.user_name || "Este colaborador"} não tem saldo de férias configurado. Será criado automaticamente com 22 dias ao aprovar.
                  </div>
                )}
                <RhAdminOverlapCheck absence={absence} organizationId={organization?.id} />
                <RhAbsenceCard
                  absence={absence}
                  showUser
                  isAdmin
                  onApprove={() => { setApprovalAbsence(absence); setApprovalMode("approve"); }}
                  onReject={() => { setApprovalAbsence(absence); setApprovalMode("reject"); }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approval Dialog */}
      <RhAbsenceApprovalDialog
        open={!!approvalAbsence}
        onOpenChange={(v) => { if (!v) setApprovalAbsence(null); }}
        absence={approvalAbsence}
        mode={approvalMode}
      />

      {/* Balance Management Dialog */}
      <Dialog open={showBalanceDialog} onOpenChange={setShowBalanceDialog}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Saldos de Férias — {currentYear}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {balances.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum saldo configurado. Adicione saldos para os membros da equipa.
              </p>
            ) : (
              (balances as any[]).map((b) => (
                <Card key={b.id} className="bg-secondary/30">
                  <CardContent className="py-3 px-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{b.user_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.total_days} totais · {b.used_days} utilizados · {b.total_days - b.used_days} disponíveis
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setEditBalance({ userId: b.user_id, userName: b.user_name, totalDays: b.total_days })}>
                      Editar
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          {availableMembers.length > 0 && (
            <Button variant="outline" className="w-full mt-2" onClick={() => setShowAddMember(true)}>
              <Plus className="h-4 w-4 mr-2" /> Adicionar Membro
            </Button>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Member Balance Dialog */}
      <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar Saldo de Férias</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Membro</label>
              <Select value={newMemberUserId} onValueChange={setNewMemberUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um membro..." />
                </SelectTrigger>
                <SelectContent>
                  {availableMembers.map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Dias totais de férias</label>
              <Input
                type="number"
                value={newMemberDays}
                onChange={(e) => setNewMemberDays(Number(e.target.value))}
                min={0}
                max={50}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMember(false)}>Cancelar</Button>
            <Button onClick={handleAddMember} disabled={!newMemberUserId || updateBalance.isPending}>
              {updateBalance.isPending ? "A guardar..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Balance Dialog */}
      <Dialog open={!!editBalance} onOpenChange={(v) => { if (!v) setEditBalance(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Saldo — {editBalance?.userName}</DialogTitle>
          </DialogHeader>
          <div>
            <label className="block text-sm font-medium mb-1.5">Dias totais de férias</label>
            <Input
              type="number"
              value={editBalance?.totalDays || 22}
              onChange={(e) => setEditBalance(prev => prev ? { ...prev, totalDays: Number(e.target.value) } : null)}
              min={0}
              max={50}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBalance(null)}>Cancelar</Button>
            <Button onClick={handleSaveBalance} disabled={updateBalance.isPending}>
              {updateBalance.isPending ? "A guardar..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}