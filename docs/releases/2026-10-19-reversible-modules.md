# Publicação reversível: mensagens, ponto e navegação

## Versão anterior

Branch principal real: `master` (produção Vercel). Tag: `backup/pre-modulos-2026-10-19`.
Baseline: `0c88699ffab3fe5790623ba8471eefec3f53a57c`.

## Interruptores

Definições → Geral → Funcionalidades da organização. Só administradores ativos, com o 2FA exigido pela organização, podem alterar:

- Mensagens.
- Relógio de ponto.
- Nova navegação e apresentação de RH.

As alterações são auditadas em `p2g_release_audit`. Propagam para sessões abertas em até 30 segundos. Desativar mensagens/ponto bloqueia as novas operações dos respetivos RPCs e impede a recolha de trabalhos de notificações. A limpeza de anexos já eliminados continua. Nenhuma tabela, mensagem, ficheiro em uso ou registo de ponto é apagado.

O interruptor visual recupera o shell e a página RH anteriores; os componentes partilhados conservam melhorias. Para recuperar exatamente todo o frontend anterior, promover a publicação Vercel correspondente à tag ou reverter os commits do frontend e publicar. Antes disso, desligar os módulos novos. Não executar migrações destrutivas de rollback.

## Operador, se não conseguir abrir as definições

Executar como operador da base de dados, restringindo à organização pretendida:

```sql
UPDATE public.p2g_release_settings
SET messages=false,timeclock=false,new_ui=false,updated_at=now()
WHERE organization_id='96a3950e-31be-4c6d-abed-b82968c0d7e9';
```

O procedimento administrativo normal é o RPC autenticado `p2g_release('update',payload)`, que regista auditoria. A operação de emergência acima deve ser registada no incidente pelo operador.

## Backend

Migrações aditivas, sem apagar dados existentes. Funções: `process-chat-jobs`, `clock-punch`, `clock-tag-manage`, `clock-notification-worker`. Cron de mensagens a cada minuto e despertar imediato; cron do ponto a cada 5 minutos. Credenciais privadas permanecem nas Edge secrets e no Vault, nunca no frontend/Git.

Anexos: bucket privado `p2g-chat-files`, limite atual do projeto 50 MiB por ficheiro. Conteúdo só para participantes ativos; administradores não ganham leitura de conversas alheias.

Registos sem localização são aceites como pendentes. NFC estático é um token revogável e copiável, sem garantia contra clonagem. A proteção criptográfica e de repetição aplica-se às tags NTAG424 configuradas. NFC físico, ingress de IP confiável e provider de deteção de VPN exigem configuração e validação própria; nunca confiar em cabeçalhos de IP enviados pelo browser.

Dados usados no desenvolvimento em `.messages.local` e `.clock.local` não são importados: incluem testes. A produção começa com os seus próprios dados reais.
