import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { build } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { FastifyInstance } from "fastify";

describe("auth e multi-tenancy", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = build({ enableWebsocket: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("registra conta cria Account+ADMIN+canais+1000 créditos, faz login e acessa /me", async () => {
    const email = `admin+${Date.now()}@acme.test`;
    const registerRes = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { accountName: "Acme Test", name: "Admin Acme", email, password: "senha123" },
    });
    expect(registerRes.statusCode).toBe(201);
    const registerBody = registerRes.json();
    expect(registerBody.token).toBeTruthy();
    expect(registerBody.user.role).toBe("ADMIN");

    const account = await prisma.account.findUnique({ where: { id: registerBody.account.id } });
    expect(account).toBeTruthy();

    const channels = await prisma.channel.findMany({ where: { accountId: registerBody.account.id } });
    expect(channels.map((c) => c.type).sort()).toEqual(["EMAIL", "WHATSAPP"]);

    const ledger = await prisma.creditLedger.findFirst({ where: { accountId: registerBody.account.id } });
    expect(ledger?.balanceAfter).toBe(1000);

    const loginRes = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password: "senha123" },
    });
    expect(loginRes.statusCode).toBe(200);
    const { token } = loginRes.json();

    const meRes = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(meRes.statusCode).toBe(200);
    expect(meRes.json().user.email).toBe(email);
  });

  it("nega login com credenciais inválidas", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "inexistente@acme.test", password: "errada" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("bloqueia rota que exige MANAGER para um usuário AGENT (403) e permite ADMIN", async () => {
    const email = `owner+${Date.now()}@acme.test`;
    const registerRes = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { accountName: "Acme Guard", name: "Dono", email, password: "senha123" },
    });
    const { account, token: adminToken } = registerRes.json();

    const agentPasswordHash = await bcrypt.hash("senha123", 10);
    const agent = await prisma.user.create({
      data: {
        accountId: account.id,
        name: "Agente",
        email: `agente+${Date.now()}@acme.test`,
        passwordHash: agentPasswordHash,
        role: "AGENT",
      },
    });

    const agentLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: agent.email, password: "senha123" },
    });
    const agentToken = agentLogin.json().token;

    const forbidden = await app.inject({
      method: "GET",
      url: "/reports/dashboard",
      headers: { authorization: `Bearer ${agentToken}` },
    });
    expect(forbidden.statusCode).toBe(403);

    const allowed = await app.inject({
      method: "GET",
      url: "/reports/dashboard",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(allowed.statusCode).toBe(200);
  });
});
