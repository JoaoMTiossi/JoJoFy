import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { build } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { FastifyInstance } from "fastify";
import { registerTestAccount } from "./helpers";

describe("carteira de contatos e visibilidade por papel", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = build({ enableWebsocket: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  async function createUser(accountId: string, role: string, name: string) {
    const passwordHash = await bcrypt.hash("senha123", 10);
    const user = await prisma.user.create({
      data: {
        accountId,
        name,
        email: `${name.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@ex.com`,
        passwordHash,
        role,
      },
    });
    const login = await app.inject({ method: "POST", url: "/auth/login", payload: { email: user.email, password: "senha123" } });
    return { user, token: login.json().token as string };
  }

  /** Conta com: 2 agentes (A e B), 1 gestor, 1 dev, 1 fila (só o agente A é membro)
   * e 4 contatos: dono-A, atribuído-A (conversa), na-fila-A (conversa sem agente),
   * e invisível-para-A (dono B, sem conversa). */
  async function setup(suffix: string) {
    const { token: adminToken, accountId } = await registerTestAccount(app, suffix);
    const { user: agentA, token: agentAToken } = await createUser(accountId, "AGENT", `AgenteA${suffix}`);
    const { user: agentB, token: agentBToken } = await createUser(accountId, "AGENT", `AgenteB${suffix}`);
    const { token: managerToken, user: manager } = await createUser(accountId, "MANAGER", `Gestor${suffix}`);
    const { token: devToken } = await createUser(accountId, "DEVELOPER", `Dev${suffix}`);

    const queueA = await prisma.queue.create({ data: { accountId, name: `Fila A ${suffix}` } });
    await prisma.queueMember.create({ data: { queueId: queueA.id, userId: agentA.id } });

    const owned = await prisma.contact.create({
      data: { accountId, name: "Da carteira de A", email: `owned-${suffix}@ex.com`, ownerId: agentA.id },
    });
    const assigned = await prisma.contact.create({
      data: { accountId, name: "Atendido por A", email: `assigned-${suffix}@ex.com`, ownerId: agentB.id },
    });
    await prisma.conversation.create({
      data: { accountId, contactId: assigned.id, channelType: "WHATSAPP", agentId: agentA.id, status: "ASSIGNED" },
    });
    const queued = await prisma.contact.create({
      data: { accountId, name: "Na fila de A", email: `queued-${suffix}@ex.com` },
    });
    await prisma.conversation.create({
      data: { accountId, contactId: queued.id, channelType: "WHATSAPP", queueId: queueA.id, status: "OPEN" },
    });
    const hidden = await prisma.contact.create({
      data: { accountId, name: "Só do B", email: `hidden-${suffix}@ex.com`, ownerId: agentB.id },
    });

    return {
      accountId,
      adminToken,
      managerToken,
      devToken,
      manager,
      agentA,
      agentAToken,
      agentB,
      agentBToken,
      queueA,
      contacts: { owned, assigned, queued, hidden },
    };
  }

  it("1) AGENT lista só os contatos visíveis pelas 3 condições; GET de contato invisível retorna 404", async () => {
    const s = await setup(`vis1-${Date.now()}`);
    const auth = { authorization: `Bearer ${s.agentAToken}` };

    const listRes = await app.inject({ method: "GET", url: "/contacts", headers: auth });
    expect(listRes.statusCode).toBe(200);
    const ids = listRes.json().map((c: any) => c.id).sort();
    expect(ids).toEqual([s.contacts.owned.id, s.contacts.assigned.id, s.contacts.queued.id].sort());

    // dono da carteira → 200 (incluindo linha do tempo)
    const okRes = await app.inject({ method: "GET", url: `/contacts/${s.contacts.owned.id}`, headers: auth });
    expect(okRes.statusCode).toBe(200);
    expect(okRes.json().timeline).toBeDefined();

    // contato de outro dono sem conversa → 404 (não 403, para não vazar existência)
    const hiddenRes = await app.inject({ method: "GET", url: `/contacts/${s.contacts.hidden.id}`, headers: auth });
    expect(hiddenRes.statusCode).toBe(404);
  });

  it("2) ADMIN, MANAGER e DEVELOPER listam todos os contatos da conta", async () => {
    const s = await setup(`vis2-${Date.now()}`);
    for (const token of [s.adminToken, s.managerToken, s.devToken]) {
      const res = await app.inject({ method: "GET", url: "/contacts", headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(200);
      const ids = res.json().map((c: any) => c.id);
      for (const contact of Object.values(s.contacts)) {
        expect(ids).toContain(contact.id);
      }
      // e o contato invisível para o agente abre normalmente (200)
      const getRes = await app.inject({
        method: "GET",
        url: `/contacts/${s.contacts.hidden.id}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(getRes.statusCode).toBe(200);
    }
  });

  it("3) AGENT que assume conversa de contato sem dono vira dono; com dono, o dono não muda", async () => {
    const s = await setup(`vis3-${Date.now()}`);
    const auth = { authorization: `Bearer ${s.agentAToken}` };

    // contato SEM dono, na fila de A → pull carteiriza
    const pullRes = await app.inject({
      method: "POST",
      url: `/conversations/${(await prisma.conversation.findFirst({ where: { contactId: s.contacts.queued.id } }))!.id}/pull`,
      headers: auth,
    });
    expect(pullRes.statusCode).toBe(200);
    const queuedAfter = await prisma.contact.findUnique({ where: { id: s.contacts.queued.id } });
    expect(queuedAfter?.ownerId).toBe(s.agentA.id);

    // contato COM dono (agentB): A assume a conversa mas a carteira permanece de B
    const ownedByB = await prisma.contact.create({
      data: { accountId: s.accountId, name: "Carteira de B", email: `keep-${Date.now()}@ex.com`, ownerId: s.agentB.id },
    });
    const conv = await prisma.conversation.create({
      data: { accountId: s.accountId, contactId: ownedByB.id, channelType: "WHATSAPP", queueId: s.queueA.id, status: "OPEN" },
    });
    const pull2 = await app.inject({ method: "POST", url: `/conversations/${conv.id}/pull`, headers: auth });
    expect(pull2.statusCode).toBe(200);
    const keptOwner = await prisma.contact.findUnique({ where: { id: ownedByB.id } });
    expect(keptOwner?.ownerId).toBe(s.agentB.id);
  });

  it("4) AGENT não altera ownerId (403); MANAGER altera; bulk-owner funciona (só ADMIN/MANAGER)", async () => {
    const s = await setup(`vis4-${Date.now()}`);

    // AGENT tentando mudar o dono de um contato que ele vê → 403
    const agentPatch = await app.inject({
      method: "PATCH",
      url: `/contacts/${s.contacts.owned.id}`,
      headers: { authorization: `Bearer ${s.agentAToken}` },
      payload: { ownerId: s.agentA.id },
    });
    expect(agentPatch.statusCode).toBe(403);

    // MANAGER altera o dono
    const managerPatch = await app.inject({
      method: "PATCH",
      url: `/contacts/${s.contacts.owned.id}`,
      headers: { authorization: `Bearer ${s.managerToken}` },
      payload: { ownerId: s.agentB.id },
    });
    expect(managerPatch.statusCode).toBe(200);
    expect(managerPatch.json().owner.id).toBe(s.agentB.id);

    // bulk-owner por MANAGER
    const bulkRes = await app.inject({
      method: "POST",
      url: "/contacts/bulk-owner",
      headers: { authorization: `Bearer ${s.managerToken}` },
      payload: { contactIds: [s.contacts.queued.id, s.contacts.hidden.id], ownerId: s.agentA.id },
    });
    expect(bulkRes.statusCode).toBe(200);
    expect(bulkRes.json().updatedCount).toBe(2);
    const bulkContact = await prisma.contact.findUnique({ where: { id: s.contacts.hidden.id } });
    expect(bulkContact?.ownerId).toBe(s.agentA.id);

    // bulk-owner por AGENT → 403
    const agentBulk = await app.inject({
      method: "POST",
      url: "/contacts/bulk-owner",
      headers: { authorization: `Bearer ${s.agentAToken}` },
      payload: { contactIds: [s.contacts.owned.id], ownerId: s.agentA.id },
    });
    expect(agentBulk.statusCode).toBe(403);
  });

  it("5) GET /conversations como AGENT nunca retorna conversa de outro agente nem de fila da qual não é membro", async () => {
    const s = await setup(`vis5-${Date.now()}`);

    // conversa atribuída ao agente B e conversa aberta em fila da qual A não é membro
    const otherQueue = await prisma.queue.create({ data: { accountId: s.accountId, name: `Fila B ${Date.now()}` } });
    await prisma.queueMember.create({ data: { queueId: otherQueue.id, userId: s.agentB.id } });
    const contactX = await prisma.contact.create({
      data: { accountId: s.accountId, name: "Cliente X", email: `x-${Date.now()}@ex.com` },
    });
    const convOfB = await prisma.conversation.create({
      data: { accountId: s.accountId, contactId: contactX.id, channelType: "WHATSAPP", agentId: s.agentB.id, status: "ASSIGNED" },
    });
    const convOtherQueue = await prisma.conversation.create({
      data: { accountId: s.accountId, contactId: contactX.id, channelType: "EMAIL", queueId: otherQueue.id, status: "OPEN" },
    });

    const res = await app.inject({
      method: "GET",
      url: "/conversations",
      headers: { authorization: `Bearer ${s.agentAToken}` },
    });
    expect(res.statusCode).toBe(200);
    const returned = res.json();
    const returnedIds = returned.map((c: any) => c.id);
    expect(returnedIds).not.toContain(convOfB.id);
    expect(returnedIds).not.toContain(convOtherQueue.id);
    for (const conv of returned) {
      const visible = conv.agentId === s.agentA.id || (conv.agentId === null && conv.queueId === s.queueA.id);
      expect(visible).toBe(true);
    }

    // gestores continuam vendo todas
    const managerRes = await app.inject({
      method: "GET",
      url: "/conversations",
      headers: { authorization: `Bearer ${s.managerToken}` },
    });
    const managerIds = managerRes.json().map((c: any) => c.id);
    expect(managerIds).toContain(convOfB.id);
    expect(managerIds).toContain(convOtherQueue.id);
  });

  it("6) CSV com owner_email inexistente reporta erro na linha e importa as demais", async () => {
    const s = await setup(`vis6-${Date.now()}`);
    const stamp = Date.now();

    const csv = [
      "nome,email,owner_email",
      `Com Dono,comdono-${stamp}@ex.com,${s.agentA.email}`,
      `Dono Errado,donoerrado-${stamp}@ex.com,naoexiste@ex.com`,
      `Sem Dono,semdono-${stamp}@ex.com,`,
    ].join("\n");

    const res = await app.inject({
      method: "POST",
      url: "/contacts/import",
      headers: { authorization: `Bearer ${s.adminToken}` },
      payload: { csv, mapping: { name: "nome", email: "email", ownerEmail: "owner_email" } },
    });
    expect(res.statusCode).toBe(200);
    const report = res.json();
    expect(report.totalRows).toBe(3);
    expect(report.importedCount).toBe(2);
    expect(report.errorCount).toBe(1);
    expect(report.errors[0].message).toContain("naoexiste@ex.com");

    const withOwner = await prisma.contact.findFirst({ where: { accountId: s.accountId, email: `comdono-${stamp}@ex.com` } });
    expect(withOwner?.ownerId).toBe(s.agentA.id);
    const withoutOwner = await prisma.contact.findFirst({ where: { accountId: s.accountId, email: `semdono-${stamp}@ex.com` } });
    expect(withoutOwner?.ownerId).toBeNull();
    const failed = await prisma.contact.findFirst({ where: { accountId: s.accountId, email: `donoerrado-${stamp}@ex.com` } });
    expect(failed).toBeNull();
  });
});
