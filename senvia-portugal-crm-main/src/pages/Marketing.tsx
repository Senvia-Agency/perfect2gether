import { Mail, Send, BarChart3, ArrowRight, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const modules = [
  {
    title: "Templates de Email",
    description: "Crie e gira templates de email reutilizáveis com variáveis dinâmicas",
    icon: Mail,
    href: "/marketing/templates",
    available: true,
  },
  {
    title: "Campanhas",
    description: "Envie emails em massa para clientes e leads segmentados",
    icon: Send,
    href: "/marketing/campaigns",
    available: true,
  },
  {
    title: "Listas",
    description: "Gira listas de contactos e importe ficheiros XLSX/CSV",
    icon: Users,
    href: "/marketing/lists",
    available: true,
  },
  {
    title: "Relatórios",
    description: "Acompanhe métricas de abertura, cliques e conversões",
    icon: BarChart3,
    href: "/marketing/reports",
    available: true,
  },
];

export default function Marketing() {
  return (
    <div className="space-y-6 p-4 md:p-6 pb-24 md:pb-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketing</h1>
          <p className="text-muted-foreground">
            Gestão de templates de email e campanhas de marketing
          </p>
        </div>

        {/* Module Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <Card
              key={module.title}
              className={cn(
                "relative overflow-hidden transition-all",
                module.available 
                  ? "hover:border-primary/50 hover:shadow-md cursor-pointer" 
                  : "opacity-60"
              )}
            >
              {module.available ? (
                <Link to={module.href} className="block">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        <module.icon className="h-6 w-6 text-primary" />
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="mt-4">
                      <h3 className="font-semibold">{module.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {module.description}
                      </p>
                    </div>
                  </CardContent>
                </Link>
              ) : (
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                      <module.icon className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <Badge variant="secondary">Em breve</Badge>
                  </div>
                  <div className="mt-4">
                    <h3 className="font-semibold">{module.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {module.description}
                    </p>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
    </div>
  );
}
