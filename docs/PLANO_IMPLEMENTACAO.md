# JoJoFy — Plano de Implementação do MVP

> **Instruções para o agente executor**: este documento é autocontido. Execute os
> milestones **na ordem**, commitando ao final de cada um com a mensagem indicada.
> A especificação funcional completa está em `docs/FUNCIONALIDADES.md` — o escopo
> deste plano é somente o **MVP (fase 1)** descrito lá. Não implemente automações,
> SLA, e-mail, relatórios nem API pública neste plano.

## 0. Visão geral

Clone do Pipefy: gestão de processos em Kanban. O MVP entrega:

- Autenticação (registro/login com JWT).
- CRUD de pipes (processos) e fases (colunas), com reordenação e fases finais.
- Campos personalizados por pipe (texto, texto longo, número, data, seleção única, e-mail).
- Cards criados via formulário inicial, movidos por drag & drop.
- Responsáveis, etiquetas, data de vencimento, comentários e histórico do card.
- Busca e filtros no Kanban.

## 1. Stack e estrutura do repositório

- **Monorepo com npm workspaces** (raiz com `package.json` + `workspaces`).
- `server/`: Node.js 20 + **Fastify** + TypeScript + **Prisma** + **SQLite**
  (arquivo `server/dev.db`; usar `DATABASE_URL` para permitir Postgres depois).
- `web/`: **React 18 + TypeScript + Vite**, **TailwindCSS**, **@dnd-kit/core** e
  **@dnd-kit/sortable** para drag & drop, **React Router**, **TanStack Query**.
- Validação compartilhada com **Zod** (schemas duplicados em cada pacote é aceitável no MVP).
- Testes: **Vitest** no server (testes de rotas com `fastify.inject`); no web,
  Vitest + Testing Library apenas para lógica não trivial (ex.: reducer do board).

```
JoJoFy/
├── package.json            # workspaces: ["server", "web"]
├── docs/
├── server/
│   ├── prisma/schema.prisma
│   └── src/
│       ├── app.ts          # build do Fastify (exportado p/ testes)
│       ├── index.ts        # listen
│       ├── plugins/auth.ts # JWT hook
│       ├── routes/         # auth.ts, pipes.ts, phases.ts, fields.ts, cards.ts, labels.ts, comments.ts, users.ts
│       └── lib/prisma.ts
└── web/
    └── src/
        ├── api/            # client HTTP + hooks TanStack Query
        ├── pages/          # Login, Register, Home (lista de pipes), PipeBoard, PipeSettings
        ├── components/     # board/, card/, fields/, ui/
        └── auth/           # contexto de sessão
```

## 2. Modelo de dados (Prisma)

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String
  passwordHash String
  createdAt    DateTime @default(now())
  assignments  CardAssignee[]
  comments     Comment[]
}

model Pipe {
  id        String   @id @default(cuid())
  name      String
  icon      String   @default("📋")
  color     String   @default("#3b82f6")
  createdAt DateTime @default(now())
  phases    Phase[]
  fields    Field[]
  labels    Label[]
}

model Phase {
  id       String  @id @default(cuid())
  pipeId   String
  pipe     Pipe    @relation(fields: [pipeId], references: [id], onDelete: Cascade)
  name     String
  position Int              // ordem da coluna
  isDone   Boolean @default(false)  // fase final "concluído"
  isCanceled Boolean @default(false) // fase final "cancelado"
  cards    Card[]
}

model Field {
  id         String  @id @default(cuid())
  pipeId     String
  pipe       Pipe    @relation(fields: [pipeId], references: [id], onDelete: Cascade)
  label      String
  type       String  // "text" | "textarea" | "number" | "date" | "select" | "email"
  required   Boolean @default(false)
  options    String? // JSON string[] para type=select
  position   Int
  values     FieldValue[]
}

model Card {
  id        String   @id @default(cuid())
  phaseId   String
  phase     Phase    @relation(fields: [phaseId], references: [id])
  title     String
  position  Int               // ordem dentro da fase
  dueDate   DateTime?
  createdAt DateTime @default(now())
  values    FieldValue[]
  assignees CardAssignee[]
  labels    CardLabel[]
  comments  Comment[]
  activities Activity[]
}

model FieldValue {
  id      String @id @default(cuid())
  cardId  String
  card    Card   @relation(fields: [cardId], references: [id], onDelete: Cascade)
  fieldId String
  field   Field  @relation(fields: [fieldId], references: [id], onDelete: Cascade)
  value   String // sempre string; number/date serializados
  @@unique([cardId, fieldId])
}

model Label {
  id     String @id @default(cuid())
  pipeId String
  pipe   Pipe   @relation(fields: [pipeId], references: [id], onDelete: Cascade)
  name   String
  color  String
  cards  CardLabel[]
}

model CardLabel {
  cardId  String
  labelId String
  card    Card  @relation(fields: [cardId], references: [id], onDelete: Cascade)
  label   Label @relation(fields: [labelId], references: [id], onDelete: Cascade)
  @@id([cardId, labelId])
}

model CardAssignee {
  cardId String
  userId String
  card   Card @relation(fields: [cardId], references: [id], onDelete: Cascade)
  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([cardId, userId])
}

model Comment {
  id        String   @id @default(cuid())
  cardId    String
  card      Card     @relation(fields: [cardId], references: [id], onDelete: Cascade)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  body      String
  createdAt DateTime @default(now())
}

model Activity {
  id        String   @id @default(cuid())
  cardId    String
  card      Card     @relation(fields: [cardId], references: [id], onDelete: Cascade)
  actorName String   // desnormalizado para simplificar o MVP
  type      String   // "created" | "moved" | "field_updated" | "assigned" | "commented" | ...
  detail    String   // texto legível: "moveu de 'Triagem' para 'Em andamento'"
  createdAt DateTime @default(now())
}
```

## 3. API (todas sob `/api`, JSON; autenticadas exceto auth)

| Método/rota | Descrição |
|---|---|
| `POST /api/auth/register` | `{name,email,password}` → cria user, retorna `{token,user}` |
| `POST /api/auth/login` | `{email,password}` → `{token,user}` |
| `GET /api/me` | usuário atual |
| `GET /api/users` | lista usuários (para atribuição) |
| `GET /api/pipes` | pipes com contagem de cards ativos |
| `POST /api/pipes` | cria pipe **já com 3 fases padrão**: "Caixa de entrada", "Em andamento", "Concluído"(isDone) |
| `GET /api/pipes/:id` | pipe completo: phases (ordenadas) + cards (com labels/assignees/values) + fields + labels |
| `PATCH /api/pipes/:id` / `DELETE` | renomear/configurar/excluir |
| `POST /api/pipes/:id/phases` | cria fase |
| `PATCH /api/phases/:id` | renomear, `isDone`/`isCanceled` |
| `PATCH /api/pipes/:id/phases/reorder` | `{phaseIds: string[]}` reordena |
| `DELETE /api/phases/:id` | só se não tiver cards (409 caso contrário) |
| `POST /api/pipes/:id/fields` / `PATCH /api/fields/:id` / `DELETE` | CRUD de campos |
| `POST /api/pipes/:id/labels` / `PATCH` / `DELETE` | CRUD de etiquetas |
| `POST /api/pipes/:id/cards` | `{title, values?, dueDate?}` — valida campos `required`; cria na 1ª fase; registra Activity "created" |
| `GET /api/cards/:id` | card completo + comments + activities |
| `PATCH /api/cards/:id` | título, dueDate, values (upsert por fieldId) → Activity "field_updated" |
| `POST /api/cards/:id/move` | `{phaseId, position}` → reposiciona e registra Activity "moved" |
| `POST /api/cards/:id/assignees` / `DELETE .../:userId` | atribuição → Activity |
| `POST /api/cards/:id/labels` / `DELETE .../:labelId` | etiquetas |
| `POST /api/cards/:id/comments` | comentário → Activity "commented" |
| `DELETE /api/cards/:id` | exclui card |

**Regras**:
- Erros de validação → 400 com `{error, details}`; não encontrado → 404; JWT ausente/inválido → 401.
- `position`: inteiros; ao mover/inserir, renumerar os afetados na transação.
- Toda mutação relevante de card grava `Activity`.

## 4. Frontend — páginas e componentes

### Páginas
1. **/login** e **/register** — formulários simples; guarda token em `localStorage`; redireciona se já logado.
2. **/** (Home) — grade de pipes (ícone, nome, nº de cards ativos), botão "Novo pipe" (modal: nome, ícone, cor).
3. **/pipes/:id** (PipeBoard) — o Kanban:
   - Colunas = fases, na ordem; header com nome, contagem e menu (renomear, marcar final, excluir).
   - Cards mostram: título, etiquetas (chips coloridos), avatares dos responsáveis, vencimento (vermelho se atrasado).
   - **Drag & drop** com dnd-kit: mover card entre colunas e reordenar dentro da coluna → `POST /move` otimista (rollback em erro).
   - Botão "+ Novo card" na 1ª fase → modal com o **formulário inicial** (renderiza `fields` do pipe por tipo, valida required).
   - Barra superior: busca por texto + filtros (responsável, etiqueta, só atrasados).
   - Clicar num card abre o **CardModal**.
4. **/pipes/:id/settings** (PipeSettings) — abas:
   - **Campos**: lista ordenável, adicionar/editar campo (label, tipo, required, options p/ select).
   - **Etiquetas**: CRUD com seletor de cor.
   - **Fases**: renomear, reordenar, marcar como final.

### CardModal (peça central)
- Título editável inline; seletor de fase; data de vencimento; responsáveis (multi-select de usuários); etiquetas.
- Seção de **campos** do pipe com edição por tipo (input, textarea, number, date, select, email).
- Aba/seção **Comentários** (lista + textarea) e **Atividade** (timeline do histórico).

### Convenções
- Hooks de dados em `web/src/api/` usando TanStack Query (`usePipe(id)`, `useMoveCard()`...), invalidação após mutações (exceto move, que é otimista).
- Componentes de UI básicos em `components/ui/` (Button, Modal, Input, Select, Avatar, Chip).
- Estilo: Tailwind, tema claro, layout tipo Pipefy (sidebar fina + board com scroll horizontal).

## 5. Milestones (ordem de execução e commits)

| # | Entrega | Critérios de aceite | Commit |
|---|---|---|---|
| M1 | Scaffold monorepo: workspaces, server Fastify "hello", web Vite rodando, Prisma schema + migration, seed (`server/prisma/seed.ts`: 1 user demo `demo@jojofy.dev`/`demo1234`, 1 pipe "Suporte" com 4 fases, 3 campos, 2 labels, 6 cards) | `npm run dev` na raiz sobe server (:3333) e web (:5173) juntos (usar `concurrently`); `npm test` passa | `feat: scaffold monorepo (fastify+prisma, react+vite)` |
| M2 | Auth completa (register/login/JWT/`/me`) + telas Login/Register | Testes de rota: register, login ok, senha errada 401, rota protegida 401 sem token | `feat: autenticação com JWT` |
| M3 | CRUD pipes + fases + campos + labels (API + testes) | Testes cobrindo criação de pipe com fases padrão, reorder, delete de fase com card → 409, validação de field select sem options → 400 | `feat: pipes, fases, campos e etiquetas` |
| M4 | Cards: criação com validação de required, move com renumeração, values, assignees, labels, comments, activities (API + testes) | Teste: criar card sem campo required → 400; mover card gera Activity "moved"; positions consistentes após move | `feat: cards, comentários e histórico` |
| M5 | Frontend Home + PipeBoard com Kanban drag & drop + criação de card | Board renderiza seed; drag & drop persiste; modal de novo card valida required | `feat: kanban board com drag & drop` |
| M6 | CardModal completo + PipeSettings + filtros/busca | Editar campo no card reflete no board; filtros combinam; settings altera fases/campos/labels | `feat: card modal, configurações do pipe e filtros` |
| M7 | Polimento: estados de loading/empty/erro, README com instruções de setup e screenshots das rotas, `npm run build` verde nos dois pacotes | `npm run build` sem erros; README completo | `docs: README e polimento final` |

## 6. Comandos esperados (raiz)

```bash
npm install
npm run dev        # sobe server + web
npm test           # vitest nos workspaces
npm run build      # build dos dois pacotes
npm run db:seed    # popula dados demo
```

## 7. Fora de escopo (NÃO fazer agora)

Automações, SLA, formulário público, e-mail, notificações, relatórios, databases,
webhooks, conexões entre pipes, permissões por papel (todo usuário autenticado
acessa tudo no MVP), visão lista/calendário, upload de anexos.

## 8. Definição de pronto

- Todos os milestones commitados individualmente no branch `claude/pipefy-clone-functions-vtnlmo`.
- `npm test` e `npm run build` verdes na raiz.
- Fluxo manual completo funciona: registrar → criar pipe → configurar campos →
  criar card → arrastar entre fases → comentar → ver histórico.
