-- O código EDP é atribuído na adjudicação da venda, não na proposta comercial.
-- Preserva a coluna e os valores históricos das propostas para que vendas
-- anteriores possam continuar a usá-los como pré-preenchimento.
DROP TRIGGER IF EXISTS trg_enforce_p2g_energy_proposal_edp_code ON public.proposals;
DROP FUNCTION IF EXISTS public.enforce_p2g_energy_proposal_edp_code();

-- Mantém os triggers em public.sales que copiam códigos históricos quando
-- disponíveis e, sobretudo, rejeitam uma venda de energia P2G sem código.
