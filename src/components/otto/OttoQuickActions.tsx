import { Button } from "@/components/ui/button";
import { useLocation } from "react-router-dom";
import {
  Target, BarChart3, FileText, Users, CalendarDays, Settings,
  UserPlus, Import, ArrowRightLeft, Columns3, Bell, Clock,
  Receipt, CreditCard, RefreshCw, Wallet, Building2,
  Megaphone, MailPlus, Upload, ShoppingBag, Package, Ticket,
  LayoutDashboard, Eye, Plug, UsersRound, Kanban, BadgeDollarSign,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface QuickAction {
  label: string;
  icon: LucideIcon;
}

const PAGE_ACTIONS: Record<string, QuickAction[]> = {
  "/dashboard": [
    { label: "Resumo do negócio", icon: BarChart3 },
    { label: "Personalizar dashboard", icon: LayoutDashboard },
    { label: "Ver leads recentes", icon: Eye },
  ],
  "/leads": [
    { label: "Como criar um lead?", icon: UserPlus },
    { label: "Configurar pipeline", icon: Kanban },
    { label: "Importar leads", icon: Upload },
    { label: "Mover lead de etapa", icon: ArrowRightLeft },
  ],
  "/clients": [
    { label: "Criar cliente", icon: UserPlus },
    { label: "Campos personalizados", icon: Columns3 },
    { label: "Converter lead em cliente", icon: ArrowRightLeft },
  ],
  "/calendar": [
    { label: "Agendar reunião", icon: CalendarDays },
    { label: "Criar lembrete", icon: Bell },
    { label: "Tipos de evento", icon: Clock },
  ],
  "/proposals": [
    { label: "Criar proposta", icon: FileText },
    { label: "Enviar por email", icon: MailPlus },
    { label: "Converter em venda", icon: ArrowRightLeft },
  ],
  "/sales": [
    { label: "Criar venda", icon: Receipt },
    { label: "Emitir fatura", icon: FileText },
    { label: "Registar pagamento", icon: CreditCard },
    { label: "Vendas recorrentes", icon: RefreshCw },
  ],
  "/financeiro": [
    { label: "Registar despesa", icon: Wallet },
    { label: "Configurar contas", icon: Building2 },
    { label: "Sincronizar faturas", icon: RefreshCw },
  ],
  "/marketing": [
    { label: "Criar campanha", icon: Megaphone },
    { label: "Gerir templates", icon: MailPlus },
    { label: "Importar contactos", icon: Upload },
  ],
  "/ecommerce": [
    { label: "Adicionar produto", icon: ShoppingBag },
    { label: "Gerir encomendas", icon: Package },
    { label: "Códigos de desconto", icon: Ticket },
  ],
  "/settings": [
    { label: "Integrações", icon: Plug },
    { label: "Gerir equipa", icon: UsersRound },
    { label: "Pipeline", icon: Kanban },
    { label: "Plano e faturação", icon: BadgeDollarSign },
  ],
};

const DEFAULT_ACTIONS: QuickAction[] = [
  { label: "Como criar um lead?", icon: Target },
  { label: "Gerir pipeline", icon: BarChart3 },
  { label: "Enviar proposta", icon: FileText },
  { label: "Configurações", icon: Settings },
];

function getActionsForPath(pathname: string): QuickAction[] {
  if (PAGE_ACTIONS[pathname]) return PAGE_ACTIONS[pathname];
  const prefix = Object.keys(PAGE_ACTIONS).find((k) => pathname.startsWith(k));
  return prefix ? PAGE_ACTIONS[prefix] : DEFAULT_ACTIONS;
}

interface OttoQuickActionsProps {
  onSelect: (text: string) => void;
}

export function OttoQuickActions({ onSelect }: OttoQuickActionsProps) {
  const { pathname } = useLocation();
  const actions = getActionsForPath(pathname);

  return (
    <div className="space-y-3">
      <div className="bg-muted rounded-2xl rounded-tl-md px-3.5 py-2.5 text-sm">
        <p className="font-medium">Olá! 👋 Sou o Otto, o teu assistente Senvia OS.</p>
        <p className="text-muted-foreground mt-1">Como posso ajudar-te hoje?</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant="outline"
            size="sm"
            className="h-auto py-1.5 px-3 text-xs rounded-full gap-1.5"
            onClick={() => onSelect(action.label)}
          >
            <action.icon className="w-3 h-3" />
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
