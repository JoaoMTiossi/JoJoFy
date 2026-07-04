import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import http from "node:http";
import { AddressInfo } from "node:net";
import { build } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { FastifyInstance } from "fastify";
import { registerTestAccount, getChannel } from "./helpers";
import { sendMessage } from "../src/core/messaging/messageService";
import { jobRunner } from "../src/core/jobs/instance";
import { signHmac } from "../src/lib/hmac";

describe("webhooks (HMAC e retries)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = build({ enableWebsocket: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("entrega o webhook assinado corretamente ao ocorrer um evento de mensagem", async () => {
    const received: { headers: http.IncomingHttpHeaders; body: string }[] = [];
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        received.push({ headers: req.headers, body });
        res.writeHead(200);
        res.end("ok");
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;

    const { token, accountId } = await registerTestAccount(app, `webhook-ok-${Date.now()}`);

    const whRes = await app.inject({
      method: "POST",
      url: "/webhooks",
      headers: { authorization: `Bearer ${token}` },
      payload: { url: `http://127.0.0.1:${port}/echo`, secret: "meu-segredo", events: ["message.status"] },
    });
    expect(whRes.statusCode).toBe(201);

    const channel = await getChannel(accountId, "EMAIL");
    const contact = await prisma.contact.create({ data: { accountId, name: "Cliente Webhook", email: "wh@ex.com" } });

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.9);
    await sendMessage({ accountId, contactId: contact.id, channelId: channel.id, source: "API", text: "Oi" });
    randomSpy.mockRestore();

    await jobRunner.runOnce(); // processa o job webhook.deliver enfileirado pelo evento message.created

    await new Promise((resolve) => setTimeout(resolve, 50));
    await server.close();

    expect(received).toHaveLength(1);
    const expectedSignature = signHmac("meu-segredo", received[0].body);
    expect(received[0].headers["x-signature"]).toBe(expectedSignature);
    const parsed = JSON.parse(received[0].body);
    expect(parsed.event).toBe("message.status");
  });

  it("reagenda a entrega com backoff quando o destino falha", async () => {
    const { token, accountId } = await registerTestAccount(app, `webhook-fail-${Date.now()}`);

    const whRes = await app.inject({
      method: "POST",
      url: "/webhooks",
      headers: { authorization: `Bearer ${token}` },
      payload: { url: "http://127.0.0.1:1/nao-existe", secret: "segredo2", events: ["message.status"] },
    });
    const webhook = whRes.json();

    const channel = await getChannel(accountId, "EMAIL");
    const contact = await prisma.contact.create({ data: { accountId, name: "Cliente Falho", email: "falho-wh@ex.com" } });

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.9);
    await sendMessage({ accountId, contactId: contact.id, channelId: channel.id, source: "API", text: "Oi" });
    randomSpy.mockRestore();

    await jobRunner.runOnce();

    const deliveries = await prisma.webhookDelivery.findMany({ where: { webhookId: webhook.id } });
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].status).toBe("PENDING");
    expect(deliveries[0].attempts).toBe(1);
    expect(deliveries[0].nextRetryAt).toBeTruthy();
    expect(deliveries[0].lastError).toBeTruthy();

    const pendingJob = await prisma.job.findFirst({
      where: { type: "webhook.deliver", status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    expect(pendingJob).toBeTruthy();
  });
});
