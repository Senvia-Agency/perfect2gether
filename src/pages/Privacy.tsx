import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";

export default function Privacy() {
  return (
    <>
      <SEO 
        title="Política de Privacidade"
        description="Política de Privacidade do Senvia OS. Saiba como protegemos os seus dados pessoais em conformidade com o RGPD."
        canonical="/privacy"
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
            <h1 className="text-3xl font-bold text-foreground">Política de Privacidade</h1>
            <p className="text-muted-foreground">Última atualização: Janeiro 2026</p>

            <section className="mt-8 space-y-6 text-foreground">
              <div>
                <h2 className="text-xl font-semibold">1. Recolha de Dados</h2>
                <p className="text-muted-foreground">
                  Recolhemos os dados pessoais que nos fornece voluntariamente através dos nossos formulários, 
                  incluindo nome, email, telefone e mensagens. Estes dados são tratados em conformidade com 
                  o Regulamento Geral sobre a Proteção de Dados (RGPD).
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold">2. Utilização dos Dados</h2>
                <p className="text-muted-foreground">
                  Os seus dados são utilizados exclusivamente para responder às suas solicitações, 
                  fornecer os nossos serviços e, quando autorizado, enviar comunicações de marketing.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold">3. Direitos do Titular</h2>
                <p className="text-muted-foreground">
                  Nos termos do RGPD, tem direito a aceder, retificar, apagar, limitar o tratamento, 
                  portar e opor-se ao tratamento dos seus dados pessoais. Para exercer estes direitos, 
                  contacte-nos através do email indicado abaixo.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold">4. Direito ao Esquecimento</h2>
                <p className="text-muted-foreground">
                  Pode solicitar a eliminação completa dos seus dados pessoais a qualquer momento. 
                  Os seus dados serão eliminados de forma permanente no prazo de 30 dias úteis.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold">5. Segurança</h2>
                <p className="text-muted-foreground">
                  Implementamos medidas técnicas e organizativas adequadas para proteger os seus dados 
                  contra acesso não autorizado, alteração, divulgação ou destruição.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold">6. Contacto</h2>
                <p className="text-muted-foreground">
                  Para questões relacionadas com a proteção de dados, contacte o nosso Encarregado de 
                  Proteção de Dados através do email: privacidade@senvia.pt
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
