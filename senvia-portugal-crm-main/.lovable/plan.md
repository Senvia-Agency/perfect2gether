

## Detetar e mostrar férias sobrepostas de colegas de equipa (P2G)

### Conceito
Quando um utilizador da P2G está a criar um pedido de ausência (férias), o sistema verifica automaticamente se algum colega da mesma equipa já tem férias aprovadas ou pendentes nos mesmos dias. Se existirem sobreposições, mostra um aviso com os nomes dos colegas e as datas em conflito.

Também no painel de admin (aprovação), ao visualizar um pedido pendente, mostrar aviso de sobreposições com membros da equipa do requerente.

### Alterações

**1) `src/hooks/useRhAbsences.ts`** — novo hook `useTeamOverlappingAbsences`
- Recebe `userId`, `periods: DatePeriod[]`, `organizationId`
- Busca a equipa do utilizador via `team_members` → `teams`
- Busca ausências (approved/pending) dos colegas da mesma equipa cujas datas se sobreponham com os períodos selecionados
- Retorna lista de `{ userName, periods[], absenceType }` com sobreposições

**2) `src/components/portal-total-link/rh/RhAbsenceRequestForm.tsx`**
- Importar e usar `useTeamOverlappingAbsences` passando os períodos selecionados
- Mostrar aviso amarelo antes do botão "Submeter" quando existirem sobreposições:
  - "⚠️ João Silva tem férias aprovadas de 15 Jul a 22 Jul"
  - Não bloqueia a submissão — apenas alerta informativo

**3) `src/components/portal-total-link/rh/RhAbsenceCard.tsx`** ou **`RhAdminPanel.tsx`**
- No painel de admin, ao mostrar pedidos pendentes, verificar sobreposições com a equipa do requerente
- Mostrar aviso visual junto ao card do pedido pendente

### Lógica de sobreposição
Dois períodos sobrepõem-se se: `startA <= endB AND endA >= startB`

### Ficheiros
| Ficheiro | Acção |
|----------|-------|
| `src/hooks/useRhAbsences.ts` | Novo hook `useTeamOverlappingAbsences` |
| `src/components/portal-total-link/rh/RhAbsenceRequestForm.tsx` | Mostrar aviso de sobreposições |
| `src/components/portal-total-link/rh/RhAdminPanel.tsx` | Mostrar aviso de sobreposições nos pedidos pendentes |

