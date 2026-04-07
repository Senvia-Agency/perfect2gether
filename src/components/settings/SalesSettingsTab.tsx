import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useOrganization, useUpdateOrganization } from "@/hooks/useOrganization";
import { ShoppingCart, Info, Percent } from "lucide-react";

interface SalesSettings {
  lock_delivered_sales?: boolean;
  lock_fulfilled_sales?: boolean;
  prevent_payment_deletion?: boolean;
  auto_assign_leads?: boolean;
  exclude_admins_from_assignment?: boolean;
  round_robin_index?: number;
  commissions_enabled?: boolean;
  commission_percentage?: number | null;
}

export function SalesSettingsTab() {
  const { data: org } = useOrganization();
  const updateOrganization = useUpdateOrganization();

  const currentSettings: SalesSettings = (org?.sales_settings as SalesSettings) || {};

  const [lockDelivered, setLockDelivered] = useState(false);
  const [lockFulfilled, setLockFulfilled] = useState(false);
  const [preventDeletion, setPreventDeletion] = useState(false);
  const [autoAssign, setAutoAssign] = useState(false);
  const [excludeAdmins, setExcludeAdmins] = useState(false);
  const [commissionsEnabled, setCommissionsEnabled] = useState(false);
  const [commissionPercentage, setCommissionPercentage] = useState("");

  useEffect(() => {
    setLockDelivered(!!currentSettings.lock_delivered_sales);
    setLockFulfilled(!!currentSettings.lock_fulfilled_sales);
    setPreventDeletion(!!currentSettings.prevent_payment_deletion);
    setAutoAssign(!!currentSettings.auto_assign_leads);
    setExcludeAdmins(!!currentSettings.exclude_admins_from_assignment);
    setCommissionsEnabled(!!currentSettings.commissions_enabled);
    setCommissionPercentage(
      currentSettings.commission_percentage != null && currentSettings.commission_percentage > 0
        ? String(currentSettings.commission_percentage)
        : ""
    );
  }, [org?.sales_settings]);

  const handleSave = () => {
    const parsedPercentage = commissionPercentage ? parseFloat(commissionPercentage) : null;
    updateOrganization.mutate({
      sales_settings: {
        lock_delivered_sales: lockDelivered,
        lock_fulfilled_sales: lockFulfilled,
        prevent_payment_deletion: preventDeletion,
        auto_assign_leads: autoAssign,
        exclude_admins_from_assignment: excludeAdmins,
        round_robin_index: currentSettings.round_robin_index || 0,
        commissions_enabled: commissionsEnabled,
        commission_percentage: parsedPercentage && parsedPercentage > 0 ? parsedPercentage : null,
      },
    });
  };

  const parsedPct = commissionPercentage ? parseFloat(commissionPercentage) : null;
  const currentParsedPct = currentSettings.commission_percentage != null && currentSettings.commission_percentage > 0
    ? currentSettings.commission_percentage
    : null;

  const hasChanges =
    lockDelivered !== !!currentSettings.lock_delivered_sales ||
    lockFulfilled !== !!currentSettings.lock_fulfilled_sales ||
    preventDeletion !== !!currentSettings.prevent_payment_deletion ||
    autoAssign !== !!currentSettings.auto_assign_leads ||
    excludeAdmins !== !!currentSettings.exclude_admins_from_assignment ||
    commissionsEnabled !== !!currentSettings.commissions_enabled ||
    (parsedPct || null) !== (currentParsedPct || null);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Regras de Vendas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start gap-3">
            <Checkbox
              id="lock_delivered"
              checked={lockDelivered}
              onCheckedChange={(checked) => setLockDelivered(!!checked)}
            />
            <div className="space-y-0.5">
              <Label htmlFor="lock_delivered" className="font-medium cursor-pointer">
                Bloquear edição de vendas concluídas
              </Label>
              <p className="text-xs text-muted-foreground">
                Vendas com estado "Concluída" não podem ser editadas por utilizadores sem perfil de administrador.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="lock_fulfilled"
              checked={lockFulfilled}
              onCheckedChange={(checked) => setLockFulfilled(!!checked)}
            />
            <div className="space-y-0.5">
              <Label htmlFor="lock_fulfilled" className="font-medium cursor-pointer">
                Bloquear edição de vendas entregues
              </Label>
              <p className="text-xs text-muted-foreground">
                Vendas com estado "Entregue" não podem ser editadas por utilizadores sem perfil de administrador.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="prevent_deletion"
              checked={preventDeletion}
              onCheckedChange={(checked) => setPreventDeletion(!!checked)}
            />
            <div className="space-y-0.5">
              <Label htmlFor="prevent_deletion" className="font-medium cursor-pointer">
                Impedir exclusão de pagamentos
              </Label>
              <p className="text-xs text-muted-foreground">
                Pagamentos registados não podem ser eliminados.
              </p>
            </div>
          </div>

          <div className="border-t pt-5">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor="auto_assign" className="font-medium cursor-pointer">
                  Atribuição automática de leads
                </Label>
              </div>
              <Switch
                id="auto_assign"
                checked={autoAssign}
                onCheckedChange={setAutoAssign}
              />
            </div>
            <div className="mt-2 flex gap-2 p-3 rounded-md bg-muted/50 border">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Quando ativo, os novos leads são distribuídos automaticamente entre os comerciais da equipa, por ordem sequencial (round-robin). 
                Exemplo: Se existem 5 comerciais, o 1.º lead vai para o comercial 1, o 2.º para o comercial 2, e assim por diante. 
                Quando todos receberem, o ciclo recomeça do primeiro.
              </p>
            </div>
            {autoAssign && (
              <div className="mt-3 flex items-start gap-3">
                <Checkbox
                  id="exclude_admins"
                  checked={excludeAdmins}
                  onCheckedChange={(checked) => setExcludeAdmins(!!checked)}
                />
                <div className="space-y-0.5">
                  <Label htmlFor="exclude_admins" className="font-medium cursor-pointer">
                    Excluir administradores do round-robin
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Apenas comerciais (vendedores) recebem leads automaticamente.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="border-t pt-5">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor="commissions_enabled" className="font-medium cursor-pointer flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Comissões sobre vendas
                </Label>
              </div>
              <Switch
                id="commissions_enabled"
                checked={commissionsEnabled}
                onCheckedChange={setCommissionsEnabled}
              />
            </div>

            {commissionsEnabled && (
              <div className="mt-3 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="commission_percentage" className="text-sm">
                    Percentagem global (%)
                  </Label>
                  <Input
                    id="commission_percentage"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    placeholder="Ex: 10"
                    value={commissionPercentage}
                    onChange={(e) => setCommissionPercentage(e.target.value)}
                    className="w-32"
                  />
                </div>
                <div className="flex gap-2 p-3 rounded-md bg-muted/50 border">
                  <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Quando a percentagem global está preenchida, todos os comerciais recebem essa % sobre o valor total da venda. 
                    Se deixar vazio, pode definir uma percentagem individual na ficha de cada colaborador em Equipa &gt; Editar Dados.
                  </p>
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateOrganization.isPending}
            className="w-full sm:w-auto"
          >
            {updateOrganization.isPending ? "A guardar..." : "Guardar"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
