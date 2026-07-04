import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { build } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { FastifyInstance } from "fastify";
import { registerTestAccount, getChannel } from "./helpers";
import { jobRunner } from "../src/core/jobs/instance";
import { createOptOut } from "../src/core/contacts/optOutService";

describe("campanhas em massa", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = build({ enableWebsocket: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  async function drainAllJobs(maxTicks = 20) {
    for (let i = 0; i < maxTicks; i++) {
      await prisma.job.updateMany({ where: { status: "PENDING" }, data: { runAt: new Date() } });
      await jobRunner.runOnce();
      const pending = await prisma.job.count({ where: { status: "PENDING" } });
      if (pending === 0) break;
    }
  }

  async function setupAccountWithList(suffix: string, contactCount: number) {
    const { token, accountId } = await registerTestAccount(app, suffix);
    const channel = await getChannel(accountId, "EMAIL");
    const template = await prisma.template.create({
      data: {
        accountId,
        channelId: channel.id,
        channelType: "EMAIL",
        name: "Promo",
        body: "Olá {{nome}}, aproveite nossa promoção!",
        status: "APPROVED",
      },
    });
    const list = await prisma.list.create({ data: { accountId, name: "Lista de teste" } });
    const contacts = [];
    for (let i = 0; i < contactCount; i++) {
      const contact = await prisma.contact.create({
        data: { accountId, name: `Cliente ${i}`, email: `cliente${i}-${suffix}@ex.com` },
      });
      await prisma.listMember.create({ data: { listId: list.id, contactId: contact.id } });
      contacts.push(contact);
    }
    return { token, accountId, channel, template, list, contacts };
  }

  it("campanha para lista de 20 contatos processa todos em lotes", async () => {
    const { token, accountId, channel, template, list } = await setupAccountWithList(`camp-batch-${Date.now()}`, 20);

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.9); // sem falha simulada
    const res = await app.inject({
      method: "POST",
      url: "/campaigns",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Campanha 20", channelId: channel.id, listId: list.id, templateId: template.id },
    });
    expect(res.statusCode).toBe(201);
    const campaign = res.json();

    await drainAllJobs();
    randomSpy.mockRestore();

    const report = await app.inject({
      method: "GET",
      url: `/campaigns/${campaign.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    const body = report.json();
    expect(body.campaign.status).toBe("DONE");
    expect(body.campaign.totalCount).toBe(20);
    expect(body.totalRecipients).toBe(20);
    expect(body.totalMessages).toBe(20);

    const messages = await prisma.message.count({ where: { accountId, campaignId: campaign.id } });
    expect(messages).toBe(20);
  });

  it("faz split A/B aproximadamente pelo percentual configurado", async () => {
    const { token, accountId, channel, template, list } = await setupAccountWithList(`camp-ab-${Date.now()}`, 40);
    const variantB = await prisma.template.create({
      data: {
        accountId,
        channelId: channel.id,
        channelType: "EMAIL",
        name: "Promo B",
        body: "Oi {{nome}}, oferta especial B!",
        status: "APPROVED",
      },
    });

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.9);
    const res = await app.inject({
      method: "POST",
      url: "/campaigns",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: "Campanha AB",
        channelId: channel.id,
        listId: list.id,
        templateId: template.id,
        variantBId: variantB.id,
        variantPct: 50,
      },
    });
    const campaign = res.json();
    randomSpy.mockRestore();

    await drainAllJobs();

    const report = await app.inject({
      method: "GET",
      url: `/campaigns/${campaign.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    const { variantCounts } = report.json();
    expect(variantCounts.A + variantCounts.B).toBe(40);
    // com 40 contatos e 50%, esperamos alguma distribuição real entre A e B
    expect(variantCounts.A).toBeGreaterThan(5);
    expect(variantCounts.B).toBeGreaterThan(5);
  });

  it("campanha agendada só roda no horário definido", async () => {
    const { token, channel, template, list } = await setupAccountWithList(`camp-sched-${Date.now()}`, 3);

    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const res = await app.inject({
      method: "POST",
      url: "/campaigns",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Campanha agendada", channelId: channel.id, listId: list.id, templateId: template.id, scheduleAt: future },
    });
    const campaign = res.json();
    expect(campaign.status).toBe("SCHEDULED");

    await jobRunner.runOnce(); // job de início ainda não venceu (runAt no futuro)

    const stillScheduled = await prisma.campaign.findUnique({ where: { id: campaign.id } });
    expect(stillScheduled?.status).toBe("SCHEDULED");
    const recipients = await prisma.campaignRecipient.count({ where: { campaignId: campaign.id } });
    expect(recipients).toBe(0);

    await drainAllJobs(); // adianta o relógio e processa
    const finished = await prisma.campaign.findUnique({ where: { id: campaign.id } });
    expect(finished?.status).toBe("DONE");
    expect(finished?.totalCount).toBe(3);
  });

  it("exclui contatos com opt-out do canal da campanha", async () => {
    const { token, accountId, channel, template, list, contacts } = await setupAccountWithList(
      `camp-optout-${Date.now()}`,
      5
    );
    await createOptOut(accountId, contacts[0].id, "EMAIL", "SAIR");

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.9);
    const res = await app.inject({
      method: "POST",
      url: "/campaigns",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Campanha opt-out", channelId: channel.id, listId: list.id, templateId: template.id },
    });
    const campaign = res.json();
    await drainAllJobs();
    randomSpy.mockRestore();

    const finished = await prisma.campaign.findUnique({ where: { id: campaign.id } });
    expect(finished?.totalCount).toBe(4);

    const recipient = await prisma.campaignRecipient.findFirst({
      where: { campaignId: campaign.id, contactId: contacts[0].id },
    });
    expect(recipient).toBeNull();
  });
});
