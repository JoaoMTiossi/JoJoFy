# Especificação — Carteira de contatos e visibilidade por papel

Mudança solicitada: alguns perfis veem **todos** os contatos; outros veem
**somente os seus**. Esta especificação é vinculante para a implementação.

## Regra de visibilidade

| Papel | Contatos | Conversas |
|---|---|---|
| ADMIN, MANAGER, DEVELOPER | Todos da conta | Todas da conta |
| AGENT | Somente os que enxerga (regra abaixo) | Atribuídas a ele + não atribuídas nas filas em que é membro |

Um AGENT enxerga um contato se **qualquer** condição vale:
1. É o **dono** do contato (`Contact.ownerId = agente`);
2. O contato tem conversa **atribuída ao agente** (para atender quem não é da
   carteira dele sem quebrar o inbox);
3. O contato tem conversa **não atribuída numa fila em que o agente é membro**
   (para ver o contexto antes de puxar da fila).

## Modelo de dados

- `Contact.ownerId String?` + relação com `User` (nullable: contato sem dono).
- Migration nova; contatos existentes ficam sem dono (visíveis só para
  ADMIN/MANAGER/DEVELOPER até serem atribuídos).

## Backend (imposto nas queries, nunca só na UI)

- Helper único `contactVisibilityWhere(user)` em `server/src/core/` usado por:
  `GET /contacts` (lista/busca), `GET /contacts/:id`, linha do tempo,
  e qualquer rota que exponha contato por id. Para papéis full-view retorna
  `{accountId}`; para AGENT retorna o OR das 3 condições acima.
- `GET /conversations`: para AGENT, forçar
  `OR(agentId = ele, AND(agentId = null, queueId IN filas dele))` —
  o filtro `mine` deixa de ser opcional na prática para agentes.
  Supervisão continua MANAGER+ (sem mudança).
- **Atribuição de dono**:
  - `PATCH /contacts/:id` aceita `ownerId` (só ADMIN/MANAGER podem alterar);
  - `POST /contacts/bulk-owner` `{contactIds[], ownerId}` (ADMIN/MANAGER);
  - importação CSV aceita coluna opcional `owner_email` mapeada para dono.
- **Carteirização automática**: quando um AGENT assume (pull/atribuição) uma
  conversa de contato **sem dono**, o contato passa a ser dele. Contato que já
  tem dono não muda (o agente atende, mas a carteira permanece).
- Mutação de contato por AGENT: pode editar atributos apenas dos contatos que
  enxerga; criação de contato por AGENT nasce com `ownerId = ele`.
- API pública (API key) não muda: escopo é da conta (server-to-server).
- Campanhas/segmentos/jornadas não mudam (recursos de MANAGER+, veem tudo).

## Frontend

- Página do contato: campo "Dono" (select de usuários) visível a todos,
  editável só por ADMIN/MANAGER.
- Lista de contatos: coluna "Dono"; para ADMIN/MANAGER, seleção múltipla +
  ação "Atribuir dono"; para AGENT, a lista já vem filtrada do backend
  (sem toggle "ver todos").
- Import CSV: coluna `owner_email` aparece no mapeamento.

## Testes obrigatórios

1. AGENT lista contatos → recebe só os visíveis pelas 3 condições; `GET` de
   contato de outro dono sem conversa → 404 (não 403, para não vazar existência).
2. ADMIN/MANAGER/DEVELOPER listam todos.
3. AGENT assume conversa de contato sem dono → vira dono; com dono → dono não muda.
4. AGENT não altera `ownerId` (403); MANAGER altera; bulk-owner funciona.
5. `GET /conversations` como AGENT nunca retorna conversa atribuída a outro
   agente nem de fila da qual não é membro.
6. CSV com `owner_email` inexistente → linha reportada como erro, demais importam.

## Fora de escopo

Compartilhamento multi-dono, transferência de carteira em massa entre agentes
(além do bulk-owner), visibilidade por fila para MANAGER, mudanças na API pública.
