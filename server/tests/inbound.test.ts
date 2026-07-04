import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { build } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { FastifyInstance } from "fastify";
import { registerTestAccount, getChannel } from "./helpers";
import { isOptedOut } from "../src/core/contacts/optOutService";

describe("roteador de inbound (simulador)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = build({ enableWebsocket: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("responder SAIR gera opt-out do canal e confirma o descadastro", async () => {
    const { token, accountId } = await registerTestAccount(app, `inbound-sair-${Date.now()}`);
    const channel = await getChannel(accountId, "WHATSAPP");
    const contact = await prisma.contact.create({ data: { accountId, name: "Cliente", phone: "+5511955554444" } });

    const res = await app.inject({
      method: "POST",
      url: "/simulator/inbound",
      headers: { authorization: `Bearer ${token}` },
      payload: { contactId: contact.id, channelId: channel.id, text: "SAIR" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().optedOut).toBe(true);

    expect(await isOptedOut(contact.id, "WHATSAPP")).toBe(true);
  });

  it("mensagem comum não gera opt-out e fica registrada na linha do tempo", async () => {
    const { token, accountId } = await registerTestAccount(app, `inbound-normal-${Date.now()}`);
    const channel = await getChannel(accountId, "WHATSAPP");
    const contact = await prisma.contact.create({ data: { accountId, name: "Cliente 2", phone: "+5511955553333" } });

    const res = await app.inject({
      method: "POST",
      url: "/simulator/inbound",
      headers: { authorization: `Bearer ${token}` },
      payload: { contactId: contact.id, channelId: channel.id, text: "Oi, quero saber mais sobre o produto" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().optedOut).toBe(false);
    expect(await isOptedOut(contact.id, "WHATSAPP")).toBe(false);

    const messages = await prisma.message.findMany({ where: { accountId, contactId: contact.id, direction: "IN" } });
    expect(messages).toHaveLength(1);
  });
});
