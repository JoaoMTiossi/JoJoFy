# Zenvia Clone

Clone de uma plataforma de comunicação com clientes (CX/CPaaS) no estilo
Zenvia: campanhas em massa, chatbot com construtor visual, atendimento
multicanal (inbox) e API de mensageria, sobre uma base comum de contatos,
relatórios e créditos — com canais **WhatsApp** e **e-mail** simulados.

Este documento cobre a instalação, um resumo da arquitetura, as credenciais
de demonstração e onde encontrar as capturas de tela das páginas principais.
A arquitetura completa está em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md),
o plano de execução em [`docs/PLANO_IMPLEMENTACAO.md`](docs/PLANO_IMPLEMENTACAO.md)
e o escopo funcional completo em [`docs/FUNCIONALIDADES.md`](docs/FUNCIONALIDADES.md).

## Stack

- **Backend**: Node 20 + TypeScript, Fastify, Prisma ORM sobre SQLite,
  WebSocket (`@fastify/websocket`) para tempo real, Vitest para testes.
- **Frontend**: React 18 + Vite + TypeScript, Tailwind CSS, TanStack Query,
  React Router, `@xyflow/react` (React Flow) para o canvas do chatbot.
- **Monorepo**: npm workspaces (`server/` e `web/`).
- **Jobs em background**: sem Redis/broker externo — uma tabela `Job` no
  banco com um `JobRunner` in-process (tick de 1s e claim transacional).

## Setup rápido

Pré-requisitos: Node 20+, npm.

```bash
# na raiz do monorepo
npm install

# aplica o schema do banco (SQLite em server/prisma/dev.db)
npm run db:push --workspace=server

# popula a conta de demonstração (contatos, campanha, jornada, bot, filas…)
npm run seed --workspace=server

# sobe o servidor (porta 3333) e o front-end (porta 5173) juntos
npm run dev
```

Acesse `http://localhost:5173` e entre com as [credenciais de demonstração](#credenciais-de-demonstração).

### Testes e build

```bash
npm test        # roda os testes do server (Vitest) e do web na raiz
npm run build   # build de produção do server (tsc) e do web (vite build)
```

O script de teste do `server` cria/atualiza automaticamente um banco SQLite
separado (`server/prisma/test.db`) antes de rodar o Vitest, então não é
preciso preparar nada manualmente.

## Credenciais de demonstração (seed)

Após rodar `npm run seed --workspace=server`, a conta **Acme** fica disponível
com:

| Papel | E-mail | Senha |
|---|---|---|
| Admin | `demo@zenvia.dev` | `demo1234` |
| Gestora | `gestor@zenvia.dev` | `demo1234` |
| Agente | `agente1@zenvia.dev` | `demo1234` |
| Agente | `agente2@zenvia.dev` | `demo1234` |

A conta já vem com: 50 contatos com atributos variados (cidade, plano, valor
gasto), 2 listas, 1 segmento, templates de WhatsApp e e-mail, 1 campanha
concluída com estatísticas, 1 jornada ativa, 1 fluxo de bot publicado (menu →
pergunta validada → transbordo), 2 filas de atendimento, conversas em vários
estados (aberta, atribuída, resolvida) e um extrato de créditos com
movimentos (débitos de envio + recarga).

## Arquitetura resumida

```
server/
├── prisma/schema.prisma   # modelo de dados completo (SQLite; enums como String)
└── src/
    ├── app.ts             # build() do Fastify (usado também pelos testes)
    ├── index.ts           # listen :3333 + inicia o JobRunner
    ├── plugins/           # auth (JWT), apiKeyAuth, websocket
    ├── routes/            # rotas do web app: auth, contacts, lists, segments,
    │                      #   templates, campaigns, journeys, flows,
    │                      #   conversations, queues, channels, webhooks,
    │                      #   apikeys, reports, billing, simulator, echo
    ├── api/               # API pública CPaaS: /v1/channels/:type/messages,
    │                      #   /v1/messages/:id (autenticada por X-API-Key)
    └── core/
        ├── messaging/     # MessageService (pipeline outbound único), status
        ├── providers/     # ChannelProvider + WhatsappSim, EmailSim
        ├── bot/           # FlowEngine (interpreta o grafo do fluxo)
        ├── inbox/         # roteamento de filas (round-robin / menor carga)
        ├── campaigns/     # CampaignRunner (lotes, A/B, agendamento)
        ├── journeys/      # JourneyRunner (send/wait/condition)
        ├── webhooks/      # WebhookDispatcher (HMAC, retries com backoff)
        ├── billing/       # CreditService (ledger, débito atômico)
        ├── segments/      # avaliador de filtros de segmento
        └── jobs/          # JobRunner: tick de 1s sobre a tabela Job

web/src/
├── api/          # client axios + funções por domínio
├── auth/         # AuthContext (JWT em localStorage)
├── realtime/     # useRealtime (WebSocket) — invalida queries do TanStack Query
├── components/   # AppLayout (sidebar por papel), flow/ (canvas)
└── pages/        # uma página por rota do mapa abaixo
```

### Pipeline de mensagens

Todo envio (API, campanha, bot, agente ou jornada) passa pelo mesmo
`MessageService.send()`: valida opt-out e a janela de 24h do WhatsApp,
renderiza `{{variáveis}}`, debita créditos e cria a `Message` na mesma
transação, entrega ao provider simulado e agenda via `Job` as transições
realistas de status (`QUEUED` → `SENT` +1s → `DELIVERED` +3s → `READ` +10s,
~3% de chance de `FAILED` com estorno do crédito).

Mensagens **recebidas** só existem via simulação (não há operadora real):
a página **Simulador** deixa "ser o cliente". O `InboundRouter` decide, nesta
ordem: opt-out por palavra-chave (SAIR/PARAR/STOP…) → sessão de fluxo ativa
(FlowEngine) → conversa já aberta com um agente (reabre se preciso) → fluxo
publicado no canal (keyword ou padrão) → cria uma conversa na fila padrão.

### Multi-tenancy

Toda tabela de domínio tem `accountId`; nenhuma query roda sem esse filtro.
Papéis: `ADMIN` (tudo), `MANAGER` (relatórios/supervisão), `AGENT` (só
inbox/contatos) e `DEVELOPER` (API keys/webhooks). O registro de uma conta
nova já cria o usuário `ADMIN`, os canais WhatsApp/e-mail simulados, os
preços por canal e 1.000 créditos de cortesia.

### Decisões e limitações conhecidas

- SQLite não tem enum nativo no Prisma: os campos que seriam enum (papéis,
  status, tipos de canal etc.) são `String` no schema, tipados e validados na
  camada de aplicação (`server/src/lib/enums.ts`, `zod` nas rotas).
- Não há gerenciamento de definições de atributo customizado pela UI (só via
  API/backend, já coberto por testes) — a importação de CSV para um atributo
  que ainda não existe retorna erro explicando isso.
- Não há UI dedicada para cadastrar respostas rápidas (quick replies); elas
  aparecem como atalhos no console do agente e podem ser criadas via API
  (`POST /quick-replies`) — o seed de demonstração já cria três.
- A página `/settings/team` (gestão de usuários e papéis) ficou como
  placeholder — a API de registro/autenticação já suporta múltiplos papéis
  e o seed cria os quatro usuários de demonstração diretamente no banco.
- Endpoint `POST/GET /echo` no próprio servidor serve como destino local de
  webhook para testes manuais, sem depender de um serviço externo como o
  webhook.site.

## Mapa de páginas (papel mínimo)

| Rota | Página | Papel mínimo |
|---|---|---|
| `/login`, `/register` | Autenticação (registro cria a conta) | — |
| `/` | Dashboard: mensagens/dia por canal, entrega/leitura, saldo, conversas abertas | MANAGER |
| `/contacts`, `/contacts/:id` | Contatos: lista, CRUD, atributos e linha do tempo | AGENT |
| `/audiences` | Listas (import CSV) e segmentos (editor de filtros) | MANAGER |
| `/templates` | Templates de WhatsApp (variáveis + botão) e e-mail | MANAGER |
| `/campaigns`, `/campaigns/:id` | Wizard de campanha (canal→audiência→template→A/B→agendar) + relatório | MANAGER |
| `/journeys`, `/journeys/:id` | Editor sequencial de jornada (send/wait/condition) | MANAGER |
| `/flows`, `/flows/:id` | Canvas do chatbot (React Flow) + simulador embutido | MANAGER |
| `/inbox` | Console do agente (3 colunas, tempo real) | AGENT |
| `/supervision` | Visão do gestor: filas, agentes, SLA | MANAGER |
| `/reports` | Relatórios de campanha, bot e atendimento, export CSV | MANAGER |
| `/billing` | Saldo, extrato do ledger, preços, recarga simulada | ADMIN |
| `/simulator` | "Ser o cliente": conversar em cada canal | ADMIN |
| `/settings/channels` | Canais e webhooks | ADMIN |
| `/settings/api-keys` | Chaves de API pública (mostra 1x), escopos, revogar | DEVELOPER |

## Testando a API pública (CPaaS)

```bash
# 1. crie uma chave em /settings/api-keys (copie o valor mostrado — só aparece uma vez)
# 2. cadastre um webhook apontando para o endpoint de eco do próprio servidor:
curl -X POST http://localhost:3333/webhooks \
  -H "Authorization: Bearer <seu JWT>" -H "content-type: application/json" \
  -d '{"url":"http://localhost:3333/echo","events":["message.status","message.received"]}'

# 3. envie uma mensagem via API pública
curl -X POST http://localhost:3333/v1/channels/whatsapp/messages \
  -H "X-API-Key: <sua chave>" -H "content-type: application/json" \
  -d '{"to":"+5511999998888","templateId":"<id de um template WhatsApp>","vars":{"nome":"Maria"}}'

# 4. confira as entregas do webhook (assinado com X-Signature: hmac-sha256)
curl http://localhost:3333/echo
```

## Screenshots

Capturadas com Playwright percorrendo o fluxo manual de aceitação completo
(registro → importação de contatos → segmento → templates → campanha A/B →
canvas do chatbot → simulador → inbox do agente → API key/webhook →
billing/dashboard). Veja [`docs/screenshots/`](docs/screenshots/):

| Arquivo | Conteúdo |
|---|---|
| `01-dashboard.png` | Dashboard logo após o registro (créditos e canais já criados) |
| `02-contacts-import.png` | Importação de contatos via CSV com relatório |
| `03-segment.png` | Segmento criado por atributo (condições em AND) |
| `04-templates.png` | Template de WhatsApp com variável e botão |
| `05-campaign-wizard.png` | Wizard de campanha (canal → audiência → template) |
| `06-campaign-report.png` | Relatório da campanha com status das mensagens |
| `07-flow-canvas.png` | Canvas do chatbot (menu → pergunta → transbordo) |
| `08-simulator.png` | Simulador: bot valida e-mail inválido e repergunta |
| `09-inbox.png` | Console do agente: nota do bot, resposta rápida, conversa resolvida |
| `10-api-keys.png` | Chave de API gerada (mostrada uma única vez) |
| `11-settings-channels-webhooks.png` | Canais e webhook cadastrado |
| `12-billing.png` | Extrato de créditos com débitos de envio |
| `13-dashboard-final.png` | Dashboard após toda a atividade gerada no fluxo |
| `14-reports.png` | Relatório de campanhas |

## Escopo

Este clone implementa **Fundação** (multi-tenant, papéis, contatos) +
**Campanhas** + **Chatbot** + **Atendimento** + **APIs/CPaaS** + canais
**WhatsApp** e **e-mail** (simulados) + **Relatórios** + **Créditos/billing**
+ **Jornadas automatizadas** — conforme selecionado em
[`docs/ARQUITETURA.md`](docs/ARQUITETURA.md). Ficam **fora de escopo**: SMS,
RCS, voz, Web Chat, redes sociais, CSAT/NPS, nó de IA generativa, auditoria
administrativa e integrações reais com Meta/provedores de e-mail.
