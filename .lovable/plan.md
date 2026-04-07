
Objetivo: garantir o diagnóstico certo para o caso do Daniel sem assumir que o problema é o plano.

O que a análise do código já confirma:
- O bloqueio por trial expirado/pagamento em atraso acontece apenas na UI autenticada, via `ProtectedRoute` / `ProtectedLayoutRoute`.
- O webhook de entrada do Make/Zapier usa `submit-lead?mode=webhook&token=...`.
- Nesse modo, a função `submit-lead` só valida `webhook_token` da organização e depois grava o lead.
- Não existe qualquer verificação de plano, trial expirado, `payment_overdue` ou subscrição dentro do fluxo de entrada do webhook.
- Portanto: se “antes do plano expirar entrava e depois deixou de entrar”, a causa mais provável não é o bloqueio do plano em si, mas sim uma quebra paralela no fluxo externo do Make ou no token/URL usado por ele.

Plano de implementação/investigação:
1. Verificar logs reais da função `submit-lead`
- Confirmar se houve chamadas recentes para o webhook da organização do Daniel.
- Separar dois cenários:
  - Sem chamadas: o Make deixou de enviar.
  - Com chamadas e erro: há falha no processamento interno.

2. Validar dados da organização do Daniel
- Confirmar no backend:
  - `webhook_token` atual
  - organização correta
  - plano atual
  - `payment_failed_at`
  - se o token não foi regenerado/trocado
- Comparar o token atual com o URL configurado no Make.

3. Confirmar o comportamento do `submit-lead`
- Revisar o caminho completo do modo webhook:
  - lookup por `webhook_token`
  - parsing do payload
  - limpeza de telefone/email
  - deduplicação por telefone em 60s
  - insert em `leads`
- Se houver erro, identificar exatamente em qual etapa.

4. Preparar correção defensiva
- Se o problema for token inválido ou URL antiga:
  - melhorar resposta/logs para deixar explícito quando o token está errado.
- Se o problema for payload do Make:
  - aceitar mais aliases de campos e devolver erro mais claro quando faltar dado mínimo.
- Se o problema for insert/deduplicação:
  - ajustar a lógica sem reabrir acesso por plano.

5. Validar o fluxo ponta a ponta
- Testar o webhook com um payload equivalente ao Make.
- Confirmar:
  - lead criado
  - notificações disparadas
  - sem bloqueio indevido por subscrição
- Depois orientar a revisão do cenário do Make com o URL final correto.

Conclusão provável neste momento:
- Pelo código atual, a expiração do plano não corta a entrada de leads via Make.
- A suspeita principal é:
  - cenário do Make desativado,
  - URL/token antigo,
  - ou erro silencioso no payload/chamada externa.

Detalhes técnicos:
```text
UI bloqueada por plano
  -> ProtectedRoute / ProtectedLayoutRoute
  -> impede uso interno do app

Webhook externo
  -> /functions/v1/submit-lead?mode=webhook&token=XYZ
  -> handleWebhookMode()
  -> valida token da organização
  -> cria lead
  -> dispara webhooks/notificações

Não há dependência direta:
  check-subscription != submit-lead webhook mode
```

Arquivos envolvidos:
- `supabase/functions/submit-lead/index.ts`
- `supabase/functions/check-subscription/index.ts`
- `src/components/auth/ProtectedRoute.tsx`
- `src/components/auth/ProtectedLayoutRoute.tsx`
- `src/components/settings/IntegrationsContent.tsx`

Resultado esperado após implementação:
- diagnóstico fechado com evidência,
- logs mais claros para este tipo de falha,
- fluxo do Make resiliente,
- Daniel volta a receber leads sem confusão entre “acesso ao app” e “entrada de webhook”.
