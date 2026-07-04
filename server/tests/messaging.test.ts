import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { build } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { FastifyInstance } from "fastify";
import { registerTestAccount, getChannel } from "./helpers";
import { sendMessage } from "../src/core/messaging/messageService";
import { jobRunner } from "../src/core/jobs/instance";
import { getBalance } from "../src/core/billing/creditService";
import { createOptOut } from "../src/core/contacts/optOutService";

describe("núcleo de mensageria", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = build({ enableWebsocket: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  async function createContact(accountId: string, overrides: Partial<{ name: string; phone: string; email: string }> = {}) {
    return prisma.contact.create({
      data: { accountId, name: overrides.name ?? "Cliente Teste", phone: overrides.phone, email: overrides.email },
    });
  }

  it("envio via e-mail debita créditos e progride QUEUED→SENT→DELIVERED→READ", async () => {
    const { accountId } = await registerTestAccount(app, `msg-ok-${Date.now()}`);
    const channel = await getChannel(accountId, "EMAIL");
    const contact = await createContact(accountId, { email: "cliente@ex.com" });

    const balanceBefore = await getBalance(prisma, accountId);

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.9); // nunca falha (>= 3%)

    const message = await sendMessage({
      accountId,
      contactId: contact.id,
      channelId: channel.id,
      source: "API",
      text: "Olá {{nome}}, seu pedido foi confirmado.",
    });

    expect(message.status).toBe("QUEUED");
    expect(JSON.parse(message.body).text).toBe("Olá Cliente Teste, seu pedido foi confirmado.");

    const balanceAfter = await getBalance(prisma, accountId);
    expect(balanceAfter).toBe(balanceBefore - 0.1); // preço do e-mail

    // adianta o relógio "virtualmente" reagendando o próximo job para agora,
    // já que as transições reais têm delays de 1s/3s/10s
    await prisma.job.updateMany({ where: { status: "PENDING" }, data: { runAt: new Date() } });
    await jobRunner.runOnce();
    let updated = await prisma.message.findUnique({ where: { id: message.id } });
    expect(updated?.status).toBe("SENT");

    await prisma.job.updateMany({ where: { status: "PENDING" }, data: { runAt: new Date() } });
    await jobRunner.runOnce();
    updated = await prisma.message.findUnique({ where: { id: message.id } });
    expect(updated?.status).toBe("DELIVERED");

    await prisma.job.updateMany({ where: { status: "PENDING" }, data: { runAt: new Date() } });
    await jobRunner.runOnce();
    updated = await prisma.message.findUnique({ where: { id: message.id } });
    expect(updated?.status).toBe("READ");

    randomSpy.mockRestore();
  });

  it("falha simulada estorna os créditos debitados", async () => {
    const { accountId } = await registerTestAccount(app, `msg-fail-${Date.now()}`);
    const channel = await getChannel(accountId, "EMAIL");
    const contact = await createContact(accountId, { email: "falha@ex.com" });

    const balanceBefore = await getBalance(prisma, accountId);
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.001); // sempre falha (< 3%)

    const message = await sendMessage({
      accountId,
      contactId: contact.id,
      channelId: channel.id,
      source: "API",
      text: "Mensagem que vai falhar",
    });

    const afterSend = await getBalance(prisma, accountId);
    expect(afterSend).toBe(balanceBefore - 0.1);

    await prisma.job.updateMany({ where: { status: "PENDING" }, data: { runAt: new Date() } });
    await jobRunner.runOnce();
    const updated = await prisma.message.findUnique({ where: { id: message.id } });
    expect(updated?.status).toBe("FAILED");

    const afterFailure = await getBalance(prisma, accountId);
    expect(afterFailure).toBe(balanceBefore); // estornado

    randomSpy.mockRestore();
  });

  it("recusa envio sem créditos suficientes (402) e não cria a mensagem", async () => {
    const { accountId } = await registerTestAccount(app, `msg-402-${Date.now()}`);
    const channel = await getChannel(accountId, "EMAIL");
    const contact = await createContact(accountId, { email: "semsaldo@ex.com" });

    // zera o saldo da conta
    const balance = await getBalance(prisma, accountId);
    await prisma.creditLedger.create({
      data: { accountId, delta: -balance, balanceAfter: 0, reason: "test:zerar saldo" },
    });

    await expect(
      sendMessage({
        accountId,
        contactId: contact.id,
        channelId: channel.id,
        source: "API",
        text: "Vai falhar por falta de crédito",
      })
    ).rejects.toMatchObject({ statusCode: 402 });

    const messages = await prisma.message.findMany({ where: { accountId, contactId: contact.id } });
    expect(messages).toHaveLength(0);
    expect(await getBalance(prisma, accountId)).toBe(0);
  });

  it("WhatsApp fora da janela de 24h exige template; dentro da janela aceita texto livre", async () => {
    const { accountId } = await registerTestAccount(app, `msg-window-${Date.now()}`);
    const channel = await getChannel(accountId, "WHATSAPP");
    const contact = await createContact(accountId, { phone: "+5511911112222" });

    await expect(
      sendMessage({
        accountId,
        contactId: contact.id,
        channelId: channel.id,
        source: "API",
        text: "Oi, tudo bem?",
      })
    ).rejects.toMatchObject({ statusCode: 400 });

    const template = await prisma.template.create({
      data: {
        accountId,
        channelId: channel.id,
        channelType: "WHATSAPP",
        name: "Boas-vindas",
        body: "Olá {{nome}}, bem-vindo!",
        status: "APPROVED",
      },
    });

    const viaTemplate = await sendMessage({
      accountId,
      contactId: contact.id,
      channelId: channel.id,
      source: "API",
      templateId: template.id,
    });
    expect(viaTemplate.status).toBe("QUEUED");

    // simula resposta do contato (inbound) para abrir a janela de 24h
    await prisma.message.create({
      data: {
        accountId,
        direction: "IN",
        channelId: channel.id,
        channelType: "WHATSAPP",
        contactId: contact.id,
        source: "SIMULATOR",
        body: JSON.stringify({ text: "Oi, quero saber mais" }),
        status: "READ",
      },
    });

    const freeText = await sendMessage({
      accountId,
      contactId: contact.id,
      channelId: channel.id,
      source: "AGENT",
      text: "Claro, posso ajudar!",
    });
    expect(freeText.status).toBe("QUEUED");
  });

  it("opt-out do contato recusa o envio", async () => {
    const { accountId } = await registerTestAccount(app, `msg-optout-${Date.now()}`);
    const channel = await getChannel(accountId, "EMAIL");
    const contact = await createContact(accountId, { email: "optout@ex.com" });

    await createOptOut(accountId, contact.id, "EMAIL", "SAIR");

    await expect(
      sendMessage({
        accountId,
        contactId: contact.id,
        channelId: channel.id,
        source: "API",
        text: "Você não devia receber isso",
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
