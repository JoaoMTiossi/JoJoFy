import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { build } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { FastifyInstance } from "fastify";
import { registerTestAccount, getChannel } from "./helpers";
import { handleInbound } from "../src/core/inbound/router";
import { FlowGraph } from "../src/core/bot/flowEngine";

describe("construtor de chatbot e FlowEngine", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = build({ enableWebsocket: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  function buildGraph(queueId: string): FlowGraph {
    return {
      startNodeId: "start",
      nodes: [
        { id: "start", type: "message", data: { text: "Olá! Bem-vindo(a)." }, next: ["ask-email"] },
        {
          id: "ask-email",
          type: "question",
          data: { prompt: "Qual seu e-mail?", variable: "email", validation: { type: "email" }, invalidMessage: "E-mail inválido, tente de novo." },
          next: ["ask-vip"],
        },
        {
          id: "ask-vip",
          type: "question",
          data: { prompt: "Qual seu nível de compras (número)?", variable: "compras", validation: { type: "number" } },
          next: ["check-vip"],
        },
        { id: "check-vip", type: "condition", data: { attr: "compras", op: "gt", value: 50 }, next: ["mark-vip", "handoff"] },
        { id: "mark-vip", type: "action", data: { actionType: "update_attribute", attr: "segmento", value: "VIP" }, next: ["handoff"] },
        { id: "handoff", type: "handoff", data: { queueId }, next: [] },
      ],
    };
  }

  async function setupFlow() {
    const { token, accountId } = await registerTestAccount(app, `flow-${Date.now()}`);
    const channel = await getChannel(accountId, "WHATSAPP");
    await prisma.attributeDef.create({ data: { accountId, name: "segmento", type: "TEXT" } });
    const queue = await prisma.queue.create({ data: { accountId, name: "Comercial" } });
    const contact = await prisma.contact.create({ data: { accountId, name: "Cliente Bot", phone: "+5511966665555" } });

    const createRes = await app.inject({
      method: "POST",
      url: "/flows",
      headers: { authorization: `Bearer ${token}` },
      payload: { channelId: channel.id, name: "Fluxo de boas-vindas", keywords: ["oi", "menu"], draft: buildGraph(queue.id) },
    });
    const flow = createRes.json();

    const publishRes = await app.inject({
      method: "POST",
      url: `/flows/${flow.id}/publish`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(publishRes.statusCode).toBe(200);

    return { token, accountId, channel, queue, contact, flow };
  }

  it("inicia por palavra-chave, valida e-mail inválido repetindo a pergunta, e segue até a condição", async () => {
    const { accountId, channel, contact, flow } = await setupFlow();

    const start = await handleInbound({ accountId, contactId: contact.id, channelId: channel.id, text: "oi" });
    expect(start.flow).toBe(true);

    let session = await prisma.flowSession.findFirst({ where: { flowId: flow.id, contactId: contact.id } });
    expect(session?.status).toBe("ACTIVE");
    expect(session?.currentNodeId).toBe("ask-email");

    // resposta inválida: repergunta, sem avançar
    await handleInbound({ accountId, contactId: contact.id, channelId: channel.id, text: "não é um email" });
    session = await prisma.flowSession.findUnique({ where: { id: session!.id } });
    expect(session?.currentNodeId).toBe("ask-email");
    expect(JSON.parse(session!.variables).email).toBeUndefined();

    // resposta válida: avança para a próxima pergunta
    await handleInbound({ accountId, contactId: contact.id, channelId: channel.id, text: "cliente@ex.com" });
    session = await prisma.flowSession.findUnique({ where: { id: session!.id } });
    expect(session?.currentNodeId).toBe("ask-vip");
    expect(JSON.parse(session!.variables).email).toBe("cliente@ex.com");
  });

  it("ramifica a condição, executa a ação de atualizar atributo e transborda com as variáveis coletadas", async () => {
    const { accountId, channel, contact, flow, queue } = await setupFlow();

    await handleInbound({ accountId, contactId: contact.id, channelId: channel.id, text: "menu" });
    await handleInbound({ accountId, contactId: contact.id, channelId: channel.id, text: "vip@ex.com" });
    await handleInbound({ accountId, contactId: contact.id, channelId: channel.id, text: "80" }); // > 50 → VIP

    const session = await prisma.flowSession.findFirst({ where: { flowId: flow.id, contactId: contact.id } });
    expect(session?.status).toBe("TRANSFERRED");

    const attrValue = await prisma.attributeValue.findFirst({
      where: { contactId: contact.id, def: { name: "segmento" } },
    });
    expect(attrValue?.value).toBe("VIP");

    const conversation = await prisma.conversation.findFirst({ where: { accountId, contactId: contact.id } });
    expect(conversation?.queueId).toBe(queue.id);
    expect(conversation?.status).toBe("OPEN");

    const notes = await prisma.internalNote.findMany({ where: { conversationId: conversation!.id } });
    expect(notes[0].body).toContain("vip@ex.com");
  });

  it("ramifica para o handoff direto quando a condição é falsa (sem marcar VIP)", async () => {
    const { accountId, channel, contact, flow } = await setupFlow();

    await handleInbound({ accountId, contactId: contact.id, channelId: channel.id, text: "oi" });
    await handleInbound({ accountId, contactId: contact.id, channelId: channel.id, text: "comum@ex.com" });
    await handleInbound({ accountId, contactId: contact.id, channelId: channel.id, text: "10" }); // <= 50 → não VIP

    const session = await prisma.flowSession.findFirst({ where: { flowId: flow.id, contactId: contact.id } });
    expect(session?.status).toBe("TRANSFERRED");

    const attrValue = await prisma.attributeValue.findFirst({
      where: { contactId: contact.id, def: { name: "segmento" } },
    });
    expect(attrValue).toBeNull();
  });
});
