import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { build } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { FastifyInstance } from "fastify";
import { registerTestAccount, getChannel } from "./helpers";
import { autoAssignConversation } from "../src/core/inbox/routing";
import { handleInbound } from "../src/core/inbound/router";

describe("atendimento: filas, roteamento e inbox", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = build({ enableWebsocket: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  async function createAgent(accountId: string, queueId: string, name: string) {
    const passwordHash = await bcrypt.hash("senha123", 10);
    const user = await prisma.user.create({
      data: { accountId, name, email: `${name.toLowerCase()}-${Date.now()}@ex.com`, passwordHash, role: "AGENT" },
    });
    await prisma.queueMember.create({ data: { queueId, userId: user.id } });
    await prisma.agentStatus.create({ data: { userId: user.id, status: "ONLINE", activeCount: 0 } });
    return user;
  }

  it("distribui conversas entre agentes e respeita o limite por agente (maxPerAgent)", async () => {
    const { accountId } = await registerTestAccount(app, `inbox-routing-${Date.now()}`);
    const channel = await getChannel(accountId, "WHATSAPP");
    const queue = await prisma.queue.create({ data: { accountId, name: "Suporte", strategy: "ROUND_ROBIN", maxPerAgent: 1 } });
    const agentA = await createAgent(accountId, queue.id, "AgenteA");
    const agentB = await createAgent(accountId, queue.id, "AgenteB");

    async function newConversation() {
      const contact = await prisma.contact.create({ data: { accountId, name: "Cliente", phone: `+551190000${Math.floor(Math.random() * 10000)}` } });
      return prisma.conversation.create({
        data: { accountId, contactId: contact.id, channelType: channel.type, queueId: queue.id, status: "OPEN" },
      });
    }

    const conv1 = await newConversation();
    await autoAssignConversation(conv1.id);
    const conv2 = await newConversation();
    await autoAssignConversation(conv2.id);

    const updated1 = await prisma.conversation.findUnique({ where: { id: conv1.id } });
    const updated2 = await prisma.conversation.findUnique({ where: { id: conv2.id } });

    expect([agentA.id, agentB.id]).toContain(updated1?.agentId);
    expect([agentA.id, agentB.id]).toContain(updated2?.agentId);
    expect(updated1?.agentId).not.toBe(updated2?.agentId); // distribuiu entre os dois agentes

    // terceira conversa: ambos os agentes já estão no limite (maxPerAgent=1)
    const conv3 = await newConversation();
    await autoAssignConversation(conv3.id);
    const updated3 = await prisma.conversation.findUnique({ where: { id: conv3.id } });
    expect(updated3?.agentId).toBeNull();
    expect(updated3?.status).toBe("OPEN"); // permanece na fila para puxar manualmente
  });

  it("reabre a conversa quando o contato responde após ser resolvida", async () => {
    const { accountId } = await registerTestAccount(app, `inbox-reopen-${Date.now()}`);
    const channel = await getChannel(accountId, "WHATSAPP");
    const contact = await prisma.contact.create({ data: { accountId, name: "Cliente Reabre", phone: "+5511922223333" } });

    const conversation = await prisma.conversation.create({
      data: { accountId, contactId: contact.id, channelType: "WHATSAPP", status: "RESOLVED", resolvedAt: new Date() },
    });

    const result = await handleInbound({ accountId, contactId: contact.id, channelId: channel.id, text: "Olá de novo, preciso de ajuda" });
    expect(result.reopened).toBe(true);

    const updated = await prisma.conversation.findUnique({ where: { id: conversation.id } });
    expect(updated?.status).toBe("OPEN");
    expect(updated?.reopenedCount).toBe(1);
    expect(updated?.resolvedAt).toBeNull();

    const attachedMessage = await prisma.message.findFirst({ where: { conversationId: conversation.id, direction: "IN" } });
    expect(attachedMessage?.body).toContain("preciso de ajuda");
  });

  it("e2e: inbound sem fluxo cai na fila padrão, agente responde e o contato recebe", async () => {
    const { token, accountId } = await registerTestAccount(app, `inbox-e2e-${Date.now()}`);
    const channel = await getChannel(accountId, "WHATSAPP");
    const defaultQueue = await prisma.queue.findFirst({ where: { accountId }, orderBy: { createdAt: "asc" } });
    const agent = await createAgent(accountId, defaultQueue!.id, "AgenteE2E");

    const contact = await prisma.contact.create({ data: { accountId, name: "Cliente E2E", phone: "+5511933334444" } });

    const inboundResult = await handleInbound({ accountId, contactId: contact.id, channelId: channel.id, text: "Preciso de suporte" });
    expect(inboundResult.conversation).toBeTruthy();
    const conversationId = (inboundResult.conversation as any).id;

    const assigned = await prisma.conversation.findUnique({ where: { id: conversationId } });
    expect(assigned?.agentId).toBe(agent.id);
    expect(assigned?.status).toBe("ASSIGNED");

    const agentLogin = await app.inject({ method: "POST", url: "/auth/login", payload: { email: agent.email, password: "senha123" } });
    const agentToken = agentLogin.json().token;

    const replyRes = await app.inject({
      method: "POST",
      url: `/conversations/${conversationId}/messages`,
      headers: { authorization: `Bearer ${agentToken}` },
      payload: { text: "Olá, como posso ajudar?" },
    });
    expect(replyRes.statusCode).toBe(201);

    const outMessage = await prisma.message.findFirst({ where: { conversationId, direction: "OUT" } });
    expect(outMessage?.source).toBe("AGENT");
    expect(JSON.parse(outMessage!.body).text).toBe("Olá, como posso ajudar?");

    const conversationAfterReply = await prisma.conversation.findUnique({ where: { id: conversationId } });
    expect(conversationAfterReply?.firstResponseAt).toBeTruthy();

    // sanity check: token do admin também acessa a listagem da fila (supervisão)
    const supervisionRes = await app.inject({
      method: "GET",
      url: "/supervision",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(supervisionRes.statusCode).toBe(200);
  });
});
