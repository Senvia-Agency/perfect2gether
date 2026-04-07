import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";

export default function Terms() {
  return (
    <>
      <SEO 
        title="Termos de Uso"
        description="Termos de Uso do Senvia OS. Leia as condições de utilização da nossa plataforma CRM."
        canonical="/terms"
      />
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-3xl">
          <Link to="/">
            <Button variant="ghost" className="mb-8">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </Link>

          <article className="prose prose-slate max-w-none">
            <h1 className="text-3xl font-bold text-foreground">Termos de Uso</h1>
            <p className="text-muted-foreground">Última atualização: Janeiro 2026</p>

            <section className="mt-8 space-y-6 text-foreground">
              <div>
                <h2 className="text-xl font-semibold">1. Aceitação dos Termos</h2>
                <p className="text-muted-foreground">
                  Ao utilizar a plataforma Senvia OS, aceita ficar vinculado por estes Termos de Uso. 
                  Se não concordar com alguma parte destes termos, não poderá aceder ao serviço.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold">2. Descrição do Serviço</h2>
                <p className="text-muted-foreground">
                  O Senvia OS é uma plataforma de gestão de relacionamento com clientes (CRM) 
                  desenhada para empresas de serviços de alto valor em Portugal.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold">3. Registo e Conta</h2>
                <p className="text-muted-foreground">
                  Para utilizar o serviço, deve criar uma conta fornecendo informações precisas e completas. 
                  É responsável por manter a confidencialidade das suas credenciais de acesso.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold">4. Uso Aceitável</h2>
                <p className="text-muted-foreground">
                  Compromete-se a utilizar o serviço apenas para fins legais e em conformidade com 
                  todas as leis aplicáveis, incluindo o RGPD.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold">5. Propriedade Intelectual</h2>
                <p className="text-muted-foreground">
                  Todo o conteúdo e funcionalidades da plataforma são propriedade da Senvia OS 
                  e estão protegidos por direitos de autor e outras leis de propriedade intelectual.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold">6. Limitação de Responsabilidade</h2>
                <p className="text-muted-foreground">
                  O serviço é fornecido "tal como está". Não garantimos que o serviço será ininterrupto 
                  ou isento de erros.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold">7. Lei Aplicável</h2>
                <p className="text-muted-foreground">
                  Estes termos são regidos pela lei portuguesa. Qualquer litígio será submetido 
                  à jurisdição exclusiva dos tribunais portugueses.
                </p>
              </div>
            </section>
          </article>

          <footer className="mt-12 border-t pt-6 text-center text-sm text-muted-foreground">
            <p>© 2026 Senvia OS. Todos os direitos reservados.</p>
          </footer>
        </div>
      </div>
    </>
  );
}
