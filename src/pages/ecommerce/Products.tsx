import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SEO } from "@/components/SEO";


import { ProductsTable } from "@/components/ecommerce/ProductsTable";
import { CategoriesTable } from "@/components/ecommerce/CategoriesTable";

export default function EcommerceProducts() {

  return (
    <>
      <SEO title="Produtos | E-commerce | Senvia OS" description="Gerir catálogo de produtos" />

      <div className="space-y-6 p-4 md:p-6 pb-24 md:pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/ecommerce">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Produtos</h1>
            <p className="text-sm text-muted-foreground">Gerir catálogo e categorias</p>
          </div>
        </div>

        <Tabs defaultValue="products" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-grid">
            <TabsTrigger value="products">Produtos</TabsTrigger>
            <TabsTrigger value="categories">Categorias</TabsTrigger>
          </TabsList>
          <TabsContent value="products">
            <ProductsTable />
          </TabsContent>
          <TabsContent value="categories">
            <CategoriesTable />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
