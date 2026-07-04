# Zenvia Clone — Arquitetura

Escopo selecionado pelo cliente (sobre `docs/FUNCIONALIDADES.md`):
**Fundação** (multi-tenant, usuários/papéis, contatos) + **Campanhas** + **Chatbot** +
**Atendimento (inbox)** + **APIs/CPaaS** + canais **WhatsApp** e **E-mail** (simulados) +
**Relatórios**, **Créditos/billing** e **Jornadas automatizadas**.

**Fora de escopo**: SMS, RCS, voz, Web Chat, redes sociais, CSAT/NPS, nó de IA
generativa, auditoria administrativa, integrações reais com Meta/provedores de e-mail.

---

## 1. Stack e topologia

Monorepo npm workspaces:

```
JoJoFy/ (branch claude/zenvia-clone)
├── package.json                # workspaces: ["server", "web"] + scripts raiz
├── docs/
├── server/                     # Fastify + TypeScript + Prisma + SQLite
│   ├── prisma/schema.prisma
│   └── src/
│       ├── app.ts              # build() do Fastify exportado p/ testes
│       ├── index.ts            # listen :3333 + inicia JobRunner
│       ├── plugins/            # auth (JWT), apiKeyAuth, websocket, tenant
│       ├── routes/             # web app: auth, contacts, lists, segments,
│       │                       #   templates, campaigns, journeys, flows,
│       │                       #   conversations, queues, channels, webhooks,
│       │                       #   apikeys, reports, billing, simulator
│       ├── api/                # API pública CPaaS: /v1/channels/:type/messages,
│       │                       #   /v1/messages/:id  (autenticada por API key)
│       ├── core/
│       │   ├── messaging/      # MessageService, pipeline outbound/inbound
│       │   ├── providers/      # ChannelProvider + WhatsappSim, EmailSim
│       │   ├── bot/            # FlowEngine (interpreta o grafo do fluxo)
│       │   ├── inbox/          # ConversationService, roteamento de filas
│       │   ├── campaigns/      # CampaignRunner (lotes, A/B, vazão)
│       │   ├── journeys/       # JourneyRunner (passos, esperas, condições)
│       │   ├── webhooks/       # WebhookDispatcher (HMAC, retries)
│       │   ├── billing/        # CreditService (débito atômico, extrato)
│       │   ├── segments/       # avaliador de filtros de segmento
│       │   └── jobs/           # JobRunner: loop de tick (1s) sobre tabela Job
│       └── lib/                # prisma, errors, e164, template-render ({{var}})
└── web/                        # React 18 + Vite + TS + Tailwind + TanStack Query
    └── src/
        ├── api/                # client + hooks por domínio
        ├── auth/
        ├── realtime/           # hook useRealtime (WebSocket) p/ inbox e dashboards
        ├── pages/              # ver §6
        └── components/         # ui/ (design system básico), flow/ (canvas), inbox/
```

- **Banco**: SQLite via `DATABASE_URL` (troca por Postgres sem mudar código).
- **Tempo real**: WebSocket (`@fastify/websocket`) com canal por conta; eventos
  `conversation.updated`, `message.created`, `queue.changed`. Frontend reconecta
  com backoff e invalida queries do TanStack Query ao receber eventos.
- **Canvas do chatbot**: `@xyflow/react` (React Flow) para o editor visual.
- **Jobs em background**: sem Redis. Tabela `Job` (type, payload JSON, runAt,
  status, attempts) + `JobRunner` in-process com tick de 1s e claim transacional.
  Usada por: lotes de campanha, passos de jornada, transições de status dos
  provedores simulados, reentrega de webhooks, agendamentos.

## 2. Multi-tenancy e autenticação

- Toda tabela de domínio tem `accountId`; um plugin `tenant` injeta o filtro a
  partir do JWT (web) ou da API key (API pública). Nenhuma query sem `accountId`.
- **Web**: JWT em header, papéis `ADMIN | MANAGER | AGENT | DEVELOPER`.
  Guard por rota: agentes só acessam inbox; managers acessam relatórios e
  supervisão; developers acessam API keys/webhooks; admin tudo.
- **API pública**: header `X-API-Key`; chaves com hash no banco, escopos
  (`messages:send`, `messages:read`) e revogação.
- Registro cria `Account` + usuário `ADMIN` + canais WhatsApp/E-mail simulados
  pré-configurados + 1.000 créditos de cortesia.

## 3. Modelo de dados (entidades e relações principais)

Fundação:
- `Account` (nome, créditos via ledger) · `User` (papel, accountId) ·
  `ApiKey` (hash, escopos, lastUsedAt)
- `Contact` (nome, phone E.164, email) · `AttributeDef` (tipo: text/number/date/select)
  · `AttributeValue` (contactId, defId, value) · `List` + `ListMember` ·
  `Segment` (filtro JSON: grupo AND de condições `{attr, op, value}`) ·
  `OptOut` (contactId, channelType, reason)

Mensageria:
- `Channel` (type WHATSAPP|EMAIL, config JSON, accountId)
- `Template` (channelType, name, body com `{{vars}}`, botões p/ WhatsApp,
  subject/HTML p/ e-mail, status APPROVED — aprovação é automática no simulado)
- `Message` (direction IN|OUT, channelType, contactId, conversationId?,
  campaignId?, source: API|CAMPAIGN|BOT|AGENT|JOURNEY, body JSON,
  status QUEUED→SENT→DELIVERED→READ | FAILED, statusAt, costCredits, providerId)
- `Webhook` (url, secret, eventos assinados) · `WebhookDelivery` (payload,
  attempts, nextRetryAt, lastStatus)

Campanhas e jornadas:
- `Campaign` (channelType, audiência: listId|segmentId, templateId + variáveis,
  variantB opcional + percentual, scheduleAt, status DRAFT→SCHEDULED→RUNNING→
  DONE|CANCELED, contadores) · `CampaignRecipient` (contactId, variant, messageId)
- `Journey` (nome, definição JSON: passos `send|wait|condition`, status) ·
  `JourneyRun` (contactId, stepIndex, state, nextRunAt)

Chatbot:
- `Flow` (channelId, nome, `draft` JSON e `published` JSON separados, keywords) —
  o JSON é o grafo: nós `{id, type: message|question|condition|action|handoff,
  data, next[]}` · `FlowSession` (contactId, flowId, currentNodeId,
  variables JSON, status ACTIVE|DONE|TRANSFERRED)

Atendimento:
- `Queue` (nome, estratégia ROUND_ROBIN|LEAST_BUSY, maxPerAgent) ·
  `Conversation` (contactId, channelType, queueId, agentId?, status OPEN|
  ASSIGNED|RESOLVED, firstResponseAt, resolvedAt, slaFirstResponseMin,
  reopenedCount) · `QuickReply` · `InternalNote` · `ConversationTag`
- `AgentStatus` (userId, ONLINE|AWAY, activeCount)

Billing:
- `ChannelPrice` (channelType → créditos; seed: WhatsApp 3, e-mail 0.1) ·
  `CreditLedger` (accountId, delta, balanceAfter, reason, refType/refId) —
  saldo = último `balanceAfter`; débito em transação com o enfileiramento da
  mensagem; envio é bloqueado com 402 se saldo insuficiente.

Infra:
- `Job` (type, payload, runAt, status, attempts)

## 4. Pipeline de mensagens (coração do sistema)

**Outbound** — único caminho para qualquer envio (API, campanha, bot, agente, jornada):
1. `MessageService.send()` valida opt-out e janela de 24h (WhatsApp: fora da
   janela só template), renderiza `{{vars}}` com atributos do contato,
   **debita créditos** e cria `Message(QUEUED)` na mesma transação;
2. entrega ao `ChannelProvider` do canal; o provedor simulado responde com
   `providerId` e agenda via `Job` as transições realistas de status
   (SENT +1s → DELIVERED +3s → READ +10s; ~3% FAILED com estorno do crédito);
3. cada transição atualiza a `Message`, emite WebSocket e dispara `Webhook`
   `message.status` para as URLs cadastradas.

**Inbound** — só existe via simulação (não há operadora real):
1. Página **Simulador** no web app (e rota `POST /simulator/inbound` em dev)
   permite "ser o cliente": escolhe contato+canal e envia texto/botão;
2. `InboundRouter` decide, nesta ordem: sessão de fluxo ativa → `FlowEngine`
   processa o nó atual; conversa aberta com agente → anexa à conversa (tempo
   real no inbox); fluxo publicado no canal (match de keyword ou default) →
   inicia `FlowSession`; senão → cria `Conversation` na fila padrão;
3. resposta "SAIR" registra `OptOut` do canal e confirma o descadastro;
4. todo inbound dispara webhook `message.received`.

**Handoff (transbordo)**: nó `handoff` do fluxo encerra a `FlowSession` como
`TRANSFERRED`, cria `Conversation` na fila configurada no nó, carregando as
variáveis coletadas como contexto visível ao agente.

## 5. Execuções em background

- **CampaignRunner**: ao disparar, resolve a audiência (lista ou segmento),
  remove opt-outs/duplicados, calcula custo e cria `CampaignRecipient`s;
  processa em lotes de 50 por tick (controle de vazão), aplicando o split A/B
  por percentual; atualiza contadores agregados a cada lote.
- **JourneyRunner**: `JourneyRun` avança por `nextRunAt`; `wait` agenda o
  próximo passo; `condition` avalia `respondeu?`/atributo e ramifica; `send`
  usa o pipeline outbound. Resposta do contato marca a run (`replied=true`).
- **WebhookDispatcher**: POST com header `X-Signature: hmac-sha256(secret, body)`;
  falha → retry com backoff exponencial (1m, 5m, 30m, 2h, descarte) via `Job`.
- **Roteamento de filas**: novo item na fila → tenta atribuição automática
  segundo a estratégia, respeitando `maxPerAgent` e status ONLINE; sem agente
  disponível, permanece na fila (visível para "puxar" manualmente).

## 6. Frontend — mapa de páginas

| Rota | Página | Papel mínimo |
|---|---|---|
| `/login`, `/register` | Auth (registro cria a conta/tenant) | — |
| `/` | Dashboard: mensagens/dia por canal, entrega/leitura, saldo, conversas abertas | MANAGER |
| `/contacts`, `/contacts/:id` | Lista + perfil com atributos e **linha do tempo** | AGENT |
| `/audiences` | Listas (CSV import c/ mapeamento) e segmentos (editor de filtros) | MANAGER |
| `/templates` | Templates WhatsApp (variáveis+botões) e e-mail (HTML c/ preview) | MANAGER |
| `/campaigns`, `/campaigns/:id` | Wizard (canal→audiência→mensagem→A/B→agendar) + relatório | MANAGER |
| `/journeys/:id` | Editor sequencial de passos (send/wait/condition) | MANAGER |
| `/flows/:id` | **Canvas React Flow**: paleta de nós, edição lateral, publicar, simulador de teste | MANAGER |
| `/inbox` | Console do agente: 3 colunas (filas/conversas · chat · contexto do contato), respostas rápidas, notas, transferir, resolver — **tempo real** | AGENT |
| `/supervision` | Visão do gestor: filas, agentes, conversas em curso, SLA estourado | MANAGER |
| `/settings/channels` | Canais e webhooks | ADMIN |
| `/settings/api-keys` | Chaves de API (mostra 1x), escopos, revogar | DEVELOPER |
| `/settings/team` | Usuários, papéis e filas | ADMIN |
| `/billing` | Saldo, extrato do ledger, preços por canal, recarga simulada | ADMIN |
| `/simulator` | "Ser o cliente": conversar como um contato em cada canal | ADMIN |
| `/reports` | Relatórios de campanhas, bot e atendimento (TMA/TME), export CSV | MANAGER |

## 7. Decisões e trade-offs registrados

1. **Provedores simulados atrás de interface** (`ChannelProvider`): o resto do
   sistema não sabe que é fake; plugar Meta/SES depois = implementar a interface.
2. **Jobs no banco, sem broker**: elimina infra externa; o claim transacional
   evita duplo processamento; suficiente para 1 instância (limitação aceita).
3. **Grafo do fluxo como JSON** na tabela `Flow` (não normalizado): o editor
   salva/carrega o documento inteiro; versões = colunas `draft`/`published`.
4. **Créditos por ledger** (nunca UPDATE de saldo): auditável e sem corrida,
   débito na mesma transação da criação da mensagem.
5. **Multi-tenant por coluna** com plugin que impõe `accountId`: mais simples
   que schema-per-tenant e suficiente para o clone.
6. **WebSocket só para notificar** (dados sempre re-buscados via TanStack
   Query): evita divergência de estado entre push e cache.
