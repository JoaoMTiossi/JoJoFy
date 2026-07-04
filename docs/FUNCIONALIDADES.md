# Zenvia Clone — Especificação Funcional Completa

A Zenvia é uma plataforma brasileira de comunicação com clientes (CX/CPaaS):
unifica **canais de mensagem** (SMS, WhatsApp, e-mail, RCS, voz, web chat),
**campanhas de marketing**, **chatbots**, **atendimento humano multicanal** e
**APIs de mensageria** sobre uma base comum de **contatos** e **relatórios**,
cobrada por **créditos**. Este documento descreve todos os módulos em detalhe,
para seleção do escopo a implementar.

---

## Módulo 1 — Canais de comunicação

Camada que conecta a plataforma aos meios de envio/recebimento. Cada canal é
configurável por conta e usado pelos demais módulos (campanhas, bots, atendimento, API).

- **SMS**: envio individual e em massa; recebimento (MO) para respostas;
  concatenação de mensagens longas; agendamento.
- **WhatsApp Business**: templates aprovados (HSM) com variáveis, botões e mídia;
  mensagens de sessão (janela de 24h); recebimento de texto, mídia e localização.
- **E-mail**: envio transacional e em massa com templates HTML, remetente
  verificado, rastreio de abertura e clique.
- **RCS** (Google): mensagens ricas com carrossel, botões e imagens; fallback
  automático para SMS quando o aparelho não suporta.
- **Voz**: torpedo de voz (TTS), URA simples (menu por dígitos), clique-para-ligar.
- **Web Chat**: widget embutível em sites, customizável (cor, avatar, mensagem
  inicial), conectado a bot ou atendimento humano.
- **Redes sociais**: Facebook Messenger, Instagram Direct e Telegram como canais
  de entrada/saída.
- Comum a todos: **status de entrega** (enviado → entregue → lido/falha),
  normalização de números (E.164), janelas de silêncio (não enviar de madrugada).

## Módulo 2 — APIs de mensageria (CPaaS)

Para desenvolvedores integrarem envio/recebimento sem usar a interface.

- API REST unificada: `POST /channels/{canal}/messages` com payload comum.
- **API keys** por conta com escopos e rotação.
- **Webhooks** de eventos: mensagem recebida, status de entrega, opt-out —
  com assinatura HMAC e reentrega com backoff em caso de falha.
- Consulta de status e histórico de mensagens por ID.
- Sandbox de testes (canal simulado que não consome créditos).
- Rate limiting e idempotência (`X-Idempotency-Key`).

## Módulo 3 — Contatos (base comum / mini-CRM)

- Cadastro de contatos: nome, telefone, e-mail, canais vinculados.
- **Atributos customizados** (texto, número, data, seleção) definidos pela conta.
- **Listas** estáticas e **segmentos dinâmicos** (filtros por atributo:
  "cidade = SP **e** última compra > 30 dias").
- **Importação CSV** com mapeamento de colunas, deduplicação e relatório de erros.
- **Opt-in/opt-out (blocklist)** por canal: descadastro automático ao responder
  "SAIR"/clicar em unsubscribe; bloqueio de envio para optados-out.
- Linha do tempo do contato: todas as mensagens e interações em todos os canais.
- Exportação CSV e exclusão em conformidade com LGPD.

## Módulo 4 — Campanhas (envio em massa / marketing)

- Criação de campanha: escolher **canal**, **público** (lista/segmento),
  **mensagem** (texto com variáveis `{{nome}}`, template WhatsApp, e-mail HTML).
- **Agendamento** (data/hora) e envio imediato; pausa e cancelamento.
- **Teste A/B**: duas variantes de mensagem, distribuição percentual.
- Validação prévia: estimativa de créditos, contagem de destinatários válidos,
  exclusão automática de opt-outs e duplicados.
- Envio em lotes com controle de vazão (rate) para não estourar limites do canal.
- **Relatório por campanha**: enviados, entregues, lidos, falhas, respostas,
  cliques (links encurtados e rastreados), custo em créditos.
- **Jornadas automatizadas** (avançado): sequência de passos com espera e
  condição — ex.: envia WhatsApp → espera 1 dia → se não respondeu, envia SMS.

## Módulo 5 — Chatbot (construtor de fluxos)

- **Construtor visual de fluxos** (canvas com nós conectados):
  - Nós de **mensagem** (texto, mídia, botões/opções rápidas);
  - Nós de **pergunta** com captura de resposta em variável (com validação:
    e-mail, número, data, regex);
  - Nós de **condição** (if/else sobre variáveis e atributos do contato);
  - Nós de **ação**: atualizar atributo do contato, chamar webhook externo
    (HTTP request), adicionar a lista, atribuir tag;
  - Nó de **transbordo**: transferir para atendimento humano (fila);
  - Menu inicial por palavras-chave e resposta padrão ("não entendi").
- Publicação por canal (mesmo fluxo pode atender WhatsApp e Web Chat).
- Versões: rascunho vs. publicado; teste do fluxo em simulador embutido.
- Horário de funcionamento: fora do horário, mensagem alternativa.
- (Avançado) **IA generativa**: nó de resposta com LLM sobre uma base de
  conhecimento (FAQ/documentos) com fallback para o fluxo.

## Módulo 6 — Atendimento humano (inbox multicanal)

- **Caixa de entrada unificada**: conversas de todos os canais numa só tela.
- **Filas/departamentos** (Comercial, Suporte...) com roteamento: distribuição
  automática (round-robin ou menor carga) ou pegar da fila manualmente.
- Console do agente: histórico completo do contato, dados/atributos ao lado,
  **respostas rápidas** (atalhos), notas internas, transferência entre
  agentes/filas, encerramento com **motivo/tag**.
- Estados da conversa: aberta → em atendimento → resolvida; reabertura se o
  cliente responde.
- **SLA**: tempo de primeira resposta e de resolução, com alertas visuais.
- Status do agente (online/ausente/invisível) e limite de conversas simultâneas.
- Supervisão: visão do gestor em tempo real (fila, conversas por agente),
  monitorar/entrar em conversa.
- **Pesquisa de satisfação (CSAT/NPS)** automática ao encerrar a conversa.

## Módulo 7 — Relatórios e analytics

- Dashboard geral: mensagens por canal/dia, taxa de entrega e leitura,
  consumo de créditos.
- Relatórios de campanha (ver módulo 4), de bot (fluxos concluídos,
  taxa de transbordo, nós de abandono) e de atendimento (TMA, TME, conversas
  por agente/fila, CSAT).
- Filtros por período, canal, campanha, fila e agente; exportação CSV.

## Módulo 8 — Administração e plataforma

- **Multi-tenant**: cada conta (empresa) isolada, com seus canais, contatos e usuários.
- Usuários e **papéis**: Admin (tudo), Gestor (relatórios + supervisão),
  Agente (só inbox), Desenvolvedor (API keys/webhooks).
- **Créditos e billing**: saldo por conta, tabela de preço por canal
  (ex.: SMS 1 crédito, WhatsApp 3, e-mail 0,1), débito por envio, extrato,
  recarga (simulada) e alerta de saldo baixo.
- Auditoria: log de ações administrativas.
- Configuração de canais (números, remetentes, tokens) por conta.

---

## Dependências entre módulos

```
Canais (1) ──────────┬─────────────┬──────────────┐
                     │             │              │
Contatos (3) ──► Campanhas (4)  Chatbot (5) ──► Atendimento (6)
                     │             │              │
                     └──────► Relatórios (7) ◄────┘
APIs/CPaaS (2) ── expõe canais + webhooks
Administração (8) ── transversal (usuários, créditos, multi-tenant)
```

- **Contatos (3)** e **Administração (8)** são a fundação — praticamente
  obrigatórios em qualquer recorte.
- **Canais (1)**: num clone sem contratos reais com operadoras/Meta, os canais são
  implementados como **provedores simulados** (gateway fake que "entrega" e gera
  status/respostas), mantendo a arquitetura pronta para plugar provedores reais.
- Campanhas, Chatbot, Atendimento e API são independentes entre si — dá para
  escolher qualquer combinação.
