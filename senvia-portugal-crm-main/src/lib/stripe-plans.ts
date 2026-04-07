export interface StripePlan {
  id: string;
  name: string;
  priceId: string;
  productId: string;
  priceMonthly: number;
  description: string;
  features: string[];
  modules: string[];
  integrations: string[];
  limits: { users: string; forms: string };
  highlighted?: boolean;
}

export const STRIPE_PLANS: StripePlan[] = [
  {
    id: "starter",
    name: "Starter",
    priceId: "price_1T2uHzLWnA81DzXTHdexakfL",
    productId: "prod_U0wAc7Tuy8w6gA",
    priceMonthly: 49,
    description: "Ideal para começar a organizar os seus leads e clientes.",
    modules: [
      "CRM Base (Leads + Clientes)",
      "Calendário",
      "Propostas",
    ],
    integrations: ["Meta Pixels"],
    limits: { users: "Até 10", forms: "2 formulários" },
    features: [
      "CRM base (Leads + Clientes)",
      "Até 10 utilizadores",
      "2 formulários",
      "Calendário e propostas",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceId: "price_1T2uNiLWnA81DzXTMDKqXDEI",
    productId: "prod_U0wGoA4odOBHOZ",
    priceMonthly: 99,
    highlighted: true,
    description: "Para equipas que querem vender mais com automação.",
    modules: [
      "Tudo do Starter +",
      "Módulo Vendas",
      "Módulo Marketing",
    ],
    integrations: ["WhatsApp", "Meta Pixels"],
    limits: { users: "Até 15", forms: "5 formulários" },
    features: [
      "Tudo do Starter +",
      "Módulo Marketing",
      "Integração WhatsApp",
      "Até 15 utilizadores",
      "5 formulários",
    ],
  },
  {
    id: "elite",
    name: "Elite",
    priceId: "price_1T2uO5LWnA81DzXT1V2bp77s",
    productId: "prod_U0wG6doz0zgZFV",
    priceMonthly: 147,
    description: "Controlo total do negócio, sem limites.",
    modules: [
      "Tudo do Pro +",
      "Módulo Financeiro",
      "Módulo E-commerce",
    ],
    integrations: ["WhatsApp", "Meta Pixels", "Faturação (KeyInvoice, InvoiceXpress)", "Pagamentos (Stripe)"],
    limits: { users: "Ilimitados", forms: "Ilimitados" },
    features: [
      "Tudo do Pro +",
      "Módulo Financeiro",
      "Módulo E-commerce",
      "Utilizadores ilimitados",
      "Formulários ilimitados",
    ],
  },
];

export const getPlanById = (id: string) => STRIPE_PLANS.find((p) => p.id === id);
export const getPlanByProductId = (productId: string) => STRIPE_PLANS.find((p) => p.productId === productId);
