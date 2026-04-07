import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default function SystemAdminUsers() {
  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/system-admin"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Utilizadores</h1>
            <p className="text-muted-foreground">Criar e gerir utilizadores.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Utilizadores</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Funcionalidade em desenvolvimento.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
