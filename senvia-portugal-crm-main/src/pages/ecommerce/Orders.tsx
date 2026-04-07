import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";


import { OrdersTable } from "@/components/ecommerce/OrdersTable";

export default function EcommerceOrders() {

  return (
    <>
      <SEO title="Pedidos | E-commerce | Senvia OS" description="Gerir pedidos da loja" />

      <div className="space-y-6 p-4 md:p-6 pb-24 md:pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/ecommerce">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
            <p className="text-sm text-muted-foreground">Gerir encomendas e estados</p>
          </div>
        </div>

        <OrdersTable />
      </div>
    </>
  );
}
