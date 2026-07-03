# JoJoFy — Especificação Funcional (Clone do Pipefy)

O Pipefy é uma ferramenta de gestão de processos baseada em Kanban. Este documento
descreve as funcionalidades que o JoJoFy deve replicar, organizadas por módulo,
e propõe um escopo de MVP para a primeira entrega.

## 1. Conceitos centrais

| Conceito | Descrição |
|---|---|
| **Organização** | Espaço de trabalho que agrupa usuários e pipes. |
| **Pipe** | Um processo (ex.: "Contratação", "Suporte"). É um quadro Kanban com fases. |
| **Fase (Phase)** | Coluna do Kanban. Todo pipe tem fases intermediárias e fases finais ("Concluído", "Cancelado"). |
| **Card** | Item de trabalho que percorre as fases (uma vaga, um chamado, um pedido). |
| **Campo (Field)** | Campo personalizado de dados. Pode pertencer ao formulário inicial ou a uma fase específica. |
| **Conexão** | Relação entre cards de pipes diferentes (card pai/filho). |

## 2. Módulos e funcionalidades

### 2.1 Pipes (processos)
- Criar, renomear, duplicar e excluir pipes.
- Criar a partir de **templates** prontos (RH, Vendas, Suporte, Compras...).
- Configurar ícone/cor e visibilidade (público na organização ou privado).
- Definir membros do pipe e seus papéis.

### 2.2 Fases
- Criar, renomear, reordenar e excluir fases.
- Marcar fases como **finais** (concluído/cancelado) — cards nelas saem do fluxo ativo.
- **Campos por fase**: cada fase pode exigir informações próprias antes do card avançar.
- **SLA por fase**: tempo máximo esperado; cards atrasados ficam destacados.
- Restringir para quais fases um card pode ser movido a partir de cada fase.

### 2.3 Cards
- Criar card via **formulário inicial** (campos obrigatórios/opcionais).
- Mover entre fases por **drag & drop**.
- Atribuir **responsáveis**, **etiquetas (labels)** e **data de vencimento**.
- **Comentários** com menções (@usuário).
- **Anexos** (arquivos).
- **Checklists** dentro do card.
- **Histórico/atividade**: registro de cada movimentação, edição e comentário.
- Cards vencidos/atrasados destacados visualmente.
- Busca e filtros (por responsável, etiqueta, fase, texto, vencimento).

### 2.4 Campos personalizados
Tipos de campo suportados:
- Texto curto / texto longo
- Número / moeda
- Data / data-hora
- Seleção única (dropdown/radio) / seleção múltipla (checkbox)
- E-mail, telefone, URL
- Anexo
- Membro (usuário da organização)
- Conexão com card de outro pipe

Propriedades: obrigatório, editável, valor padrão, texto de ajuda, condicional
(exibir somente se outro campo tiver certo valor).

### 2.5 Formulários públicos
- Cada pipe pode expor um **formulário público** (link compartilhável, sem login)
  que cria cards na primeira fase — ex.: formulário de abertura de chamados.

### 2.6 Automações
Regras **gatilho → ação** dentro de um pipe ou entre pipes:
- **Gatilhos**: card criado, card movido para fase X, campo alterado, prazo expirado, card atrasado no SLA.
- **Ações**: mover card, atribuir responsável, definir valor de campo, adicionar etiqueta, enviar e-mail, criar card em outro pipe (conectado), notificar usuário.

### 2.7 E-mail
- **Templates de e-mail** com variáveis dos campos do card (`{{nome_do_cliente}}`).
- Envio manual de dentro do card ou automático via automação.
- (Avançado) Caixa de entrada por pipe: e-mails recebidos viram cards.

### 2.8 Relatórios e dashboards
- Métricas por pipe: cards criados/concluídos por período, tempo médio por fase,
  cards por responsável, taxa de atraso de SLA.
- Filtros por período, fase, responsável e etiqueta.
- Exportação para CSV.

### 2.9 Usuários e permissões
- Cadastro/login (e-mail + senha; opcionalmente OAuth).
- Papéis na organização: **Admin**, **Membro**, **Convidado**.
- Papéis por pipe: **Admin do pipe**, **Membro** (cria/move cards), **Iniciador**
  (só cria cards), **Leitor** (só visualiza).
- Convite de usuários por e-mail.

### 2.10 Notificações
- In-app (sino) e por e-mail: card atribuído a você, menção em comentário,
  card atrasado, movimentação em card que você segue.

### 2.11 Visualizações
- **Kanban** (principal).
- **Lista/tabela** com ordenação e edição inline.
- **Calendário** por data de vencimento.

### 2.12 Databases (tabelas)
- Tabelas de registros reutilizáveis (ex.: "Clientes", "Produtos") que podem ser
  referenciadas por campos de conexão nos cards — o equivalente às *Databases* do Pipefy.

### 2.13 API e integrações
- API REST (ou GraphQL, como o Pipefy) para CRUD de pipes, cards e campos.
- **Webhooks**: POST para URL externa quando eventos ocorrem (card criado/movido).

## 3. Escopo sugerido do MVP (fase 1)

1. Autenticação (e-mail/senha) e organização única.
2. CRUD de pipes e fases (com fases finais e reordenação).
3. Cards com formulário inicial, campos personalizados básicos (texto, número,
   data, seleção, e-mail), drag & drop entre fases.
4. Responsáveis, etiquetas, vencimento, comentários e histórico do card.
5. Filtros e busca no Kanban.

**Fase 2**: automações, SLA, formulário público, notificações, visão lista/calendário.
**Fase 3**: e-mail templates, dashboards, databases, webhooks/API pública, conexões entre pipes.

## 4. Stack sugerida

- **Frontend**: React + TypeScript + Vite, dnd-kit para drag & drop, TailwindCSS.
- **Backend**: Node.js (Fastify ou Express) + TypeScript, Prisma ORM.
- **Banco**: PostgreSQL (SQLite em desenvolvimento).
- **Auth**: JWT com refresh token.
