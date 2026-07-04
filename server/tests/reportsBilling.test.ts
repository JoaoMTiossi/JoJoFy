import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { build } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { FastifyInstance } from "fastify";
import { registerTestAccount, getChannel } from "./helpers";
import { jobRunner } from "../src/core/jobs/instance";
import { getBalance } from "../src/core/billing/creditService";
import { sendMessage } from "../src/core/messaging/messageService";

describe("relatórios e billing", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = build({ enableWebsocket: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  async function drainJobs(maxTicks = 10) {
    for (let i = 0; i < maxTicks; i++) {
      await prisma.job.updateMany({ where: { status: "PENDING" }, data: { runAt: new Date() } });
      await jobRunner.runOnce();
      const pending = await prisma.job.count({ where: { status: "PENDING" } });
      if (pending === 0) break;
    }
  }

  it("números do relatório de campanha conferem com as mensagens enviadas", async () => {
    const { token, accountId } = await registerTestAccount(app, `report-camp-${Date.now()}`);
    const channel = await getChannel(accountId, "EMAIL");
    const template = await prisma.template.create({
      data: { accountId, channelId: channel.id, channelType: "EMAIL", name: "T", body: "Olá {{nome}}", status: "APPROVED" },
    });
    const list = await prisma.list.create({ data: { accountId, name: "Lista relatório" } });
    for (let i = 0; i < 5; i++) {
      const contact = await prisma.contact.create({ data: { accountId, name: `C${i}`, email: `c${i}-${Date.now()}@ex.com` } });
      await prisma.listMember.create({ data: { listId: list.id, contactId: contact.id } });
    }

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.9);
    const campRes = await app.inject({
      method: "POST",
      url: "/campaigns",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Camp Relatório", channelId: channel.id, listId: list.id, templateId: template.id },
    });
    const campaign = campRes.json();
    await drainJobs();
    randomSpy.mockRestore();

    const reportRes = await app.inject({
      method: "GET",
      url: "/reports/campaigns",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(reportRes.statusCode).toBe(200);
    const found = reportRes.json().find((c: any) => c.id === campaign.id);
    expect(found.totalCount).toBe(5);
    expect(found.sentCount).toBe(5);

    const messages = await prisma.message.count({ where: { accountId, campaignId: campaign.id } });
    expect(messages).toBe(found.sentCount);
  });

  it("dashboard reflete saldo e mensagens da conta", async () => {
    const { token, accountId } = await registerTestAccount(app, `report-dash-${Date.now()}`);
    const channel = await getChannel(accountId, "EMAIL");
    const contact = await prisma.contact.create({ data: { accountId, name: "Dash", email: "dash@ex.com" } });

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.9);
    await sendMessage({ accountId, contactId: contact.id, channelId: channel.id, source: "API", text: "Olá!" });
    randomSpy.mockRestore();

    const dashRes = await app.inject({
      method: "GET",
      url: "/reports/dashboard",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(dashRes.statusCode).toBe(200);
    const body = dashRes.json();
    expect(body.balance).toBeCloseTo(999.9); // 1000 - 0.1 (preço do e-mail)
    expect(body.lowBalance).toBe(false);
    expect(body.messagesByChannel.EMAIL).toBe(1);
  });

  it("exporta CSV de campanhas com cabeçalho e linhas", async () => {
    const { token } = await registerTestAccount(app, `report-csv-${Date.now()}`);
    const res = await app.inject({
      method: "GET",
      url: "/reports/export?type=campaigns",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.body.split("\n")[0]).toBe("id,name,status,totalCount,sentCount,failedCount,createdAt");
  });

  it("extrato do ledger, preços por canal e recarga simulada creditam a conta", async () => {
    const { token, accountId } = await registerTestAccount(app, `billing-${Date.now()}`);

    const balanceRes = await app.inject({ method: "GET", url: "/billing/balance", headers: { authorization: `Bearer ${token}` } });
    expect(balanceRes.json().balance).toBe(1000);

    const pricesRes = await app.inject({ method: "GET", url: "/billing/prices", headers: { authorization: `Bearer ${token}` } });
    const prices = pricesRes.json();
    expect(prices.find((p: any) => p.channelType === "WHATSAPP").credits).toBe(3);
    expect(prices.find((p: any) => p.channelType === "EMAIL").credits).toBe(0.1);

    const rechargeRes = await app.inject({
      method: "POST",
      url: "/billing/recharge",
      headers: { authorization: `Bearer ${token}` },
      payload: { credits: 500 },
    });
    expect(rechargeRes.statusCode).toBe(201);
    expect(rechargeRes.json().balance).toBe(1500);

    const balanceAfter = await getBalance(prisma, accountId);
    expect(balanceAfter).toBe(1500);

    const ledgerRes = await app.inject({ method: "GET", url: "/billing/ledger", headers: { authorization: `Bearer ${token}` } });
    const ledger = ledgerRes.json();
    expect(ledger[0].reason).toContain("Recarga");
    expect(ledger[0].balanceAfter).toBe(1500);
  });
});
