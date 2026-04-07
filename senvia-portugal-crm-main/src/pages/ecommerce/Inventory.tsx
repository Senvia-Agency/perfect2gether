import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";


import { InventoryTable } from "@/components/ecommerce/InventoryTable";

export default function EcommerceInventory() {

  return (
    <>
      <SEO title="Inventário | E-commerce | Senvia OS" description="Gerir stock e movimentos" />

      <div className="space-y-6 p-4 md:p-6 pb-24 md:pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/ecommerce">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Inventário</h1>
            <p className="text-sm text-muted-foreground">Gerir stock e movimentos</p>
          </div>
        </div>

        <InventoryTable />
      </div>
    </>
  );
}
