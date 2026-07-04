# Zenvia Clone — Plano de Execução (para o agente implementador)

> **Instruções**: execute os milestones NA ORDEM no branch `claude/zenvia-clone`.
> A arquitetura em `docs/ARQUITETURA.md` é **vinculante** — siga a estrutura de
> pastas, o modelo de dados, o pipeline de mensagens e as decisões registradas.
> O contexto funcional está em `docs/FUNCIONALIDADES.md`, mas o escopo é SOMENTE
> o listado na arquitetura (respeite o "fora de escopo"). Ao final de cada
> milestone: testes verdes, commit com a mensagem indicada, push.

## Milestones

| # | Entrega | Critérios de aceite | Commit |
|---|---|---|---|
| M1 | Scaffold monorepo + schema Prisma completo + auth multi-tenant (register cria Account+ADMIN+canais+1000 créditos; login JWT; guards por papel) + JobRunner básico com testes | `npm run dev` sobe server+web; teste: registro→login→`/me`; rota de MANAGER nega AGENT (403); JobRunner processa um job de teste | `feat: scaffold, multi-tenancy e autenticação` |
| M2 | Contatos: CRUD, atributos customizados, listas, importação CSV (mapeamento+dedup+relatório de erros), segmentos com avaliador de filtros, opt-out | Testes: segmento filtra por atributo (AND); CSV com linha inválida reporta erro e importa as válidas; opt-out bloqueia envio (M3 valida de novo) | `feat: contatos, listas, segmentos e opt-out` |
| M3 | Núcleo de mensageria: providers simulados (WhatsApp/e-mail), MessageService com débito de créditos, templates com render de `{{vars}}`, transições de status via Job, janela de 24h, ledger | Testes: envio debita créditos e falha com 402 sem saldo; status progride QUEUED→SENT→DELIVERED→READ; FAILED estorna; WhatsApp fora da janela exige template; opt-out → recusa | `feat: pipeline de mensagens, providers simulados e créditos` |
| M4 | API pública CPaaS (`/v1/...` com X-API-Key, escopos, mostra chave 1x) + webhooks (HMAC, retries com backoff) + inbound router + página Simulador | Testes: envio via API key ok / chave revogada 401 / sem escopo 403; webhook assinado corretamente; falha reagenda entrega; inbound "SAIR" gera opt-out | `feat: API pública, webhooks e simulador de canais` |
| M5 | Campanhas: wizard (canal→audiência→template→A/B→agendamento), CampaignRunner em lotes com exclusão de opt-out/duplicados, contadores e relatório por campanha | Testes: campanha para lista de 20 processa todos em lotes; split A/B ~percentual; agendada só roda no horário; opt-out excluído; relatório bate com mensagens | `feat: campanhas em massa com A/B e agendamento` |
| M6 | Jornadas: editor sequencial (send/wait/condition), JourneyRunner com esperas e ramificação por "respondeu?"/atributo | Teste: jornada send→wait→condition ramifica correto quando o contato responde (simular inbound) e quando não responde (avançar relógio do job) | `feat: jornadas automatizadas` |
| M7 | Chatbot: canvas React Flow (paleta, edição lateral, draft/publish, keywords), FlowEngine (message/question+validação/condition/action/handoff), simulador de teste embutido | Testes de engine: fluxo com pergunta valida e-mail inválido e repergunta; condition ramifica; action atualiza atributo; handoff cria Conversation na fila com variáveis; UI publica e o simulador percorre o fluxo | `feat: construtor de chatbot e engine de fluxos` |
| M8 | Inbox: conversas, filas com roteamento (round-robin/least-busy, maxPerAgent), console do agente 3 colunas em tempo real (WebSocket), respostas rápidas, notas, transferência, resolver/reabrir, SLA, supervisão | Testes de roteamento (distribui e respeita limite); reabertura ao responder; e2e: inbound sem fluxo → fila → agente responde → contato recebe | `feat: atendimento multicanal com filas e tempo real` |
| M9 | Relatórios (dashboard geral + campanhas + bot + atendimento com TMA/TME, export CSV) e Billing (extrato do ledger, preços, recarga simulada, alerta de saldo) | Números dos relatórios conferem com dados de seed/teste; export CSV baixa; recarga credita no ledger | `feat: relatórios e billing` |
| M10 | Seed demo completo, README (setup, arquitetura resumida, credenciais demo, screenshots das páginas principais), polimento de loading/empty/erro | `npm test` e `npm run build` verdes na raiz; fluxo manual completo (abaixo) validado com Playwright e screenshots em `docs/screenshots/` | `docs: README, seed demo e polimento final` |

## Seed demo (M10)

Conta "Acme" com admin `demo@zenvia.dev` / `demo1234`, 1 gestor, 2 agentes,
50 contatos com atributos variados, 2 listas, 1 segmento, templates WhatsApp e
e-mail, 1 campanha concluída (com estatísticas), 1 jornada ativa, 1 fluxo de
bot publicado (menu → pergunta → transbordo), 2 filas, conversas em vários
estados e extrato de créditos com movimentos.

## Fluxo manual de aceitação (definição de pronto)

1. Registrar conta nova → canais e créditos criados automaticamente.
2. Importar contatos por CSV → criar segmento por atributo.
3. Criar template WhatsApp com variável e botão → criar campanha A/B para o
   segmento → acompanhar relatório com status progredindo.
4. Montar fluxo no canvas (menu → pergunta validada → transbordo) → publicar.
5. No Simulador, conversar como cliente: bot responde, valida, transborda.
6. No Inbox (como agente), receber a conversa, usar resposta rápida, resolver.
7. Criar API key → enviar mensagem via `curl` na API pública → receber webhook
   de status (usar webhook.site local ou endpoint de eco no próprio server).
8. Conferir débitos no extrato de billing e números no dashboard.

## Regras de execução

- Trabalhe SOMENTE no branch `claude/zenvia-clone`; push após cada milestone.
- Termine cada mensagem de commit com `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Push com retry (2s/4s/8s/16s) em falha de rede. Não crie pull request.
- Decisões pequenas fora do plano: escolha o padrão mais simples e siga.
- Não implemente nada da lista "fora de escopo" da arquitetura.
