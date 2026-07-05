/**
 * Seed de demonstração (M10): conta "Acme" com admin, gestor, agentes,
 * 50 contatos com atributos variados, listas, segmento, templates,
 * 1 campanha concluída, 1 jornada ativa, 1 fluxo de bot publicado, filas e
 * conversas em vários estados, e extrato de créditos com movimentos.
 */
import bcrypt from "bcryptjs";
import { prisma } from "./lib/prisma";
import { creditAccount, debitAccount } from "./core/billing/creditService";
import { FlowGraph } from "./core/bot/flowEngine";

const CIDADES = ["São Paulo", "Rio de Janeiro", "Belo Horizonte", "Curitiba", "Recife"];
const PLANOS = ["Basico", "Pro", "Enterprise"];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPhone(seed: number): string {
  return `+551199${String(1000000 + seed).slice(0, 7)}`;
}

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: "demo@zenvia.dev" } });
  if (existing) {
    console.log("[seed] conta demo já existe — nada a fazer (apague o banco para re-semear).");
    return;
  }

  console.log("[seed] criando conta Acme...");
  const account = await prisma.account.create({ data: { name: "Acme" } });

  const passwordHash = await bcrypt.hash("demo1234", 10);
  const admin = await prisma.user.create({
    data: { accountId: account.id, name: "Admin Acme", email: "demo@zenvia.dev", passwordHash, role: "ADMIN" },
  });
  const manager = await prisma.user.create({
    data: { accountId: account.id, name: "Gestora Ana", email: "gestor@zenvia.dev", passwordHash, role: "MANAGER" },
  });
  const agent1 = await prisma.user.create({
    data: { accountId: account.id, name: "Agente Bruno", email: "agente1@zenvia.dev", passwordHash, role: "AGENT" },
  });
  const agent2 = await prisma.user.create({
    data: { accountId: account.id, name: "Agente Carla", email: "agente2@zenvia.dev", passwordHash, role: "AGENT" },
  });
  await prisma.agentStatus.createMany({
    data: [
      { userId: agent1.id, status: "ONLINE", activeCount: 0 },
      { userId: agent2.id, status: "ONLINE", activeCount: 0 },
    ],
  });

  const whatsapp = await prisma.channel.create({
    data: { accountId: account.id, type: "WHATSAPP", name: "WhatsApp (simulado)", config: JSON.stringify({ simulated: true, number: "+5511999990000" }) },
  });
  const email = await prisma.channel.create({
    data: { accountId: account.id, type: "EMAIL", name: "E-mail (simulado)", config: JSON.stringify({ simulated: true, from: "contato@acme.zenvia.dev" }) },
  });
  await prisma.channelPrice.createMany({
    data: [
      { accountId: account.id, channelType: "WHATSAPP", credits: 3 },
      { accountId: account.id, channelType: "EMAIL", credits: 0.1 },
    ],
  });
  await creditAccount(prisma, account.id, 1000, "Créditos de boas-vindas");

  console.log("[seed] criando atributos customizados e 50 contatos...");
  const attrCidade = await prisma.attributeDef.create({ data: { accountId: account.id, name: "cidade", type: "TEXT" } });
  const attrPlano = await prisma.attributeDef.create({ data: { accountId: account.id, name: "plano", type: "SELECT", options: PLANOS.join(",") } });
  const attrValorGasto = await prisma.attributeDef.create({ data: { accountId: account.id, name: "valor_gasto", type: "NUMBER" } });
  await prisma.attributeDef.create({ data: { accountId: account.id, name: "ultima_compra", type: "DATE" } });

  const contacts = [];
  for (let i = 0; i < 50; i++) {
    const cidade = randomFrom(CIDADES);
    const plano = randomFrom(PLANOS);
    const valorGasto = Math.round(Math.random() * 1000);
    // carteirização de demonstração: 15 contatos do agente Bruno, 15 da
    // agente Carla, 20 sem dono — assim cada perfil vê listas diferentes
    const ownerId = i < 15 ? agent1.id : i < 30 ? agent2.id : undefined;
    const contact = await prisma.contact.create({
      data: {
        accountId: account.id,
        name: `Cliente Demo ${i + 1}`,
        phone: randomPhone(i),
        email: `cliente${i + 1}@demo.zenvia.dev`,
        ownerId,
      },
    });
    await prisma.attributeValue.createMany({
      data: [
        { contactId: contact.id, defId: attrCidade.id, value: cidade },
        { contactId: contact.id, defId: attrPlano.id, value: plano },
        { contactId: contact.id, defId: attrValorGasto.id, value: String(valorGasto) },
      ],
    });
    contacts.push({ ...contact, cidade, plano, valorGasto });
  }

  const listAll = await prisma.list.create({ data: { accountId: account.id, name: "Todos os contatos" } });
  await prisma.listMember.createMany({ data: contacts.map((c) => ({ listId: listAll.id, contactId: c.id })) });

  const vipContacts = contacts.filter((c) => c.valorGasto > 500);
  const listVip = await prisma.list.create({ data: { accountId: account.id, name: "Clientes VIP" } });
  await prisma.listMember.createMany({ data: vipContacts.map((c) => ({ listId: listVip.id, contactId: c.id })) });

  await prisma.segment.create({
    data: {
      accountId: account.id,
      name: "São Paulo com alto consumo",
      filter: JSON.stringify({
        logic: "AND",
        conditions: [
          { attr: "cidade", op: "eq", value: "São Paulo" },
          { attr: "valor_gasto", op: "gt", value: 300 },
        ],
      }),
    },
  });

  console.log("[seed] criando templates...");
  const waTemplate = await prisma.template.create({
    data: {
      accountId: account.id,
      channelId: whatsapp.id,
      channelType: "WHATSAPP",
      name: "Promoção relâmpago",
      body: "Olá {{nome}}! Temos uma oferta especial para o plano {{plano}}. Aproveite hoje.",
      buttons: JSON.stringify([{ label: "Ver oferta" }]),
      status: "APPROVED",
    },
  });
  const emailTemplate = await prisma.template.create({
    data: {
      accountId: account.id,
      channelId: email.id,
      channelType: "EMAIL",
      name: "Newsletter mensal",
      body: "Olá {{nome}}, confira as novidades deste mês.",
      subject: "Novidades Acme para você, {{nome}}",
      html: "<h1>Olá {{nome}}</h1><p>Confira as novidades deste mês para o plano {{plano}}.</p>",
      status: "APPROVED",
    },
  });

  console.log("[seed] criando campanha concluída com estatísticas...");
  const campaignTargets = contacts.slice(0, 12);
  const campaign = await prisma.campaign.create({
    data: {
      accountId: account.id,
      name: "Campanha de boas-vindas",
      channelId: email.id,
      channelType: "EMAIL",
      listId: listAll.id,
      templateId: emailTemplate.id,
      status: "DONE",
      totalCount: campaignTargets.length,
      sentCount: campaignTargets.length,
    },
  });
  const statusCycle = ["READ", "READ", "DELIVERED", "SENT", "FAILED"];
  for (let i = 0; i < campaignTargets.length; i++) {
    const contact = campaignTargets[i];
    const status = statusCycle[i % statusCycle.length];
    const cost = 0.1;
    const message = await prisma.message.create({
      data: {
        accountId: account.id,
        direction: "OUT",
        channelId: email.id,
        channelType: "EMAIL",
        contactId: contact.id,
        campaignId: campaign.id,
        source: "CAMPAIGN",
        body: JSON.stringify({ text: `Olá ${contact.name}, confira as novidades deste mês.`, templateId: emailTemplate.id }),
        status,
        costCredits: cost,
        providerId: `email_sim_seed_${i}`,
      },
    });
    await debitAccount(prisma, account.id, cost, "message.send", { refType: "Message", refId: message.id });
    if (status === "FAILED") {
      await creditAccount(prisma, account.id, cost, "message.failed_refund", { refType: "Message", refId: message.id });
    }
    await prisma.campaignRecipient.create({
      data: { campaignId: campaign.id, contactId: contact.id, variant: "A", messageId: message.id, status: "SENT" },
    });
  }

  console.log("[seed] criando jornada ativa...");
  const journeyDefinition = {
    steps: [
      { type: "send", templateId: waTemplate.id, channelId: whatsapp.id },
      { type: "wait", durationMs: 24 * 60 * 60 * 1000 },
      { type: "condition", conditionType: "replied", ifTrueStepIndex: 3, ifFalseStepIndex: 4 },
      { type: "send", templateId: waTemplate.id, channelId: whatsapp.id, next: 5 },
      { type: "send", templateId: waTemplate.id, channelId: whatsapp.id },
    ],
  };
  const journey = await prisma.journey.create({
    data: {
      accountId: account.id,
      name: "Reengajamento pós-cadastro",
      definition: JSON.stringify(journeyDefinition),
      status: "ACTIVE",
      listId: listVip.id,
    },
  });
  for (const contact of vipContacts.slice(0, 5)) {
    await prisma.journeyRun.create({
      data: { journeyId: journey.id, contactId: contact.id, stepIndex: 1, status: "RUNNING", nextRunAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
  }

  console.log("[seed] criando fluxo de bot publicado (menu → pergunta → transbordo)...");
  const queueComercial = await prisma.queue.create({ data: { accountId: account.id, name: "Comercial", strategy: "ROUND_ROBIN", maxPerAgent: 5 } });
  const queueSuporte = await prisma.queue.create({ data: { accountId: account.id, name: "Suporte", strategy: "LEAST_BUSY", maxPerAgent: 5 } });
  await prisma.queueMember.createMany({
    data: [
      { queueId: queueComercial.id, userId: agent1.id },
      { queueId: queueSuporte.id, userId: agent2.id },
    ],
  });

  const graph: FlowGraph = {
    startNodeId: "menu",
    nodes: [
      { id: "menu", type: "message", data: { text: "Olá! Bem-vindo(a) à Acme. Vou te ajudar a falar com o time certo." }, next: ["ask-email"] },
      {
        id: "ask-email",
        type: "question",
        data: { prompt: "Antes de continuar, qual é o seu e-mail?", variable: "email", validation: { type: "email" }, invalidMessage: "Esse e-mail não parece válido, pode digitar novamente?" },
        next: ["handoff"],
      },
      { id: "handoff", type: "handoff", data: { queueId: queueComercial.id }, next: [] },
    ],
  };
  await prisma.flow.create({
    data: {
      accountId: account.id,
      channelId: whatsapp.id,
      name: "Menu inicial WhatsApp",
      keywords: "oi,olá,menu,start",
      isDefault: true,
      draft: JSON.stringify(graph),
      published: JSON.stringify(graph),
    },
  });

  console.log("[seed] criando conversas em vários estados...");
  const convContact1 = contacts[0];
  const convContact2 = contacts[1];
  const convContact3 = contacts[2];

  await prisma.conversation.create({
    data: { accountId: account.id, contactId: convContact1.id, channelType: "WHATSAPP", queueId: queueSuporte.id, status: "OPEN" },
  });

  const assignedConv = await prisma.conversation.create({
    data: {
      accountId: account.id,
      contactId: convContact2.id,
      channelType: "WHATSAPP",
      queueId: queueComercial.id,
      agentId: agent1.id,
      status: "ASSIGNED",
      firstResponseAt: new Date(),
    },
  });
  await prisma.agentStatus.update({ where: { userId: agent1.id }, data: { activeCount: { increment: 1 } } });
  await prisma.message.create({
    data: {
      accountId: account.id,
      direction: "IN",
      channelId: whatsapp.id,
      channelType: "WHATSAPP",
      contactId: convContact2.id,
      conversationId: assignedConv.id,
      source: "SIMULATOR",
      body: JSON.stringify({ text: "Preciso de ajuda com meu pedido" }),
      status: "DELIVERED",
    },
  });

  const resolvedConv = await prisma.conversation.create({
    data: {
      accountId: account.id,
      contactId: convContact3.id,
      channelType: "WHATSAPP",
      queueId: queueSuporte.id,
      agentId: agent2.id,
      status: "RESOLVED",
      firstResponseAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      resolvedAt: new Date(),
      resolveReason: "Dúvida resolvida",
    },
  });
  await prisma.internalNote.create({ data: { conversationId: resolvedConv.id, authorId: agent2.id, body: "Cliente satisfeito com a solução." } });
  await prisma.conversationTag.create({ data: { conversationId: resolvedConv.id, tag: "duvida-produto" } });

  await prisma.quickReply.createMany({
    data: [
      { accountId: account.id, shortcut: "ola", body: "Olá! Como posso ajudar você hoje?" },
      { accountId: account.id, shortcut: "aguarde", body: "Só um momento, vou verificar isso para você." },
      { accountId: account.id, shortcut: "obrigado", body: "Obrigado pelo contato! Qualquer coisa, estamos por aqui." },
    ],
  });

  await prisma.webhook.create({
    data: {
      accountId: account.id,
      url: "http://localhost:3333/echo",
      secret: "seed-webhook-secret",
      events: "message.status,message.received,contact.optout",
    },
  });

  await creditAccount(prisma, account.id, 200, "Recarga manual (simulada)");

  console.log("[seed] concluído! Login: demo@zenvia.dev / demo1234");
  console.log(`[seed] gestor: gestor@zenvia.dev / demo1234, agentes: agente1@zenvia.dev e agente2@zenvia.dev (senha demo1234)`);
  console.log(
    "[seed] carteiras: 15 contatos do agente1, 15 da agente2, 20 sem dono — entre como agente para ver a lista filtrada."
  );
  void manager;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
