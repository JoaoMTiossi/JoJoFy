import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { getBalance } from "../core/billing/creditService";
import { toCsv } from "../lib/csv";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function reportsRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole("ADMIN", "MANAGER"));

  fastify.get("/dashboard", async (request) => {
    const accountId = request.user.accountId;
    const since = new Date(Date.now() - 14 * DAY_MS);

    const messages = await prisma.message.findMany({
      where: { accountId, createdAt: { gte: since } },
      select: { channelType: true, direction: true, status: true, createdAt: true },
    });

    const byChannel: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    let outCount = 0;
    let deliveredOrRead = 0;
    let readCount = 0;

    for (const m of messages) {
      byChannel[m.channelType] = (byChannel[m.channelType] ?? 0) + 1;
      const day = m.createdAt.toISOString().slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + 1;
      if (m.direction === "OUT") {
        outCount++;
        if (m.status === "DELIVERED" || m.status === "READ") deliveredOrRead++;
        if (m.status === "READ") readCount++;
      }
    }

    const balance = await getBalance(prisma, accountId);
    const openConversations = await prisma.conversation.count({ where: { accountId, status: { in: ["OPEN", "ASSIGNED"] } } });

    return {
      messagesByChannel: byChannel,
      messagesByDay: byDay,
      deliveryRate: outCount ? deliveredOrRead / outCount : 0,
      readRate: outCount ? readCount / outCount : 0,
      balance,
      lowBalance: balance < 100,
      openConversations,
    };
  });

  fastify.get("/campaigns", async (request) => {
    const accountId = request.user.accountId;
    const campaigns = await prisma.campaign.findMany({ where: { accountId }, orderBy: { createdAt: "desc" } });
    return campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      totalCount: c.totalCount,
      sentCount: c.sentCount,
      failedCount: c.failedCount,
    }));
  });

  fastify.get("/bot", async (request) => {
    const accountId = request.user.accountId;
    const flows = await prisma.flow.findMany({ where: { accountId } });
    const sessions = await prisma.flowSession.findMany({ where: { flow: { accountId } } });

    const total = sessions.length;
    const done = sessions.filter((s) => s.status === "DONE").length;
    const transferred = sessions.filter((s) => s.status === "TRANSFERRED").length;
    const active = sessions.filter((s) => s.status === "ACTIVE").length;

    const abandonNodeCounts: Record<string, number> = {};
    for (const s of sessions) {
      if (s.status === "ACTIVE" && s.currentNodeId) {
        abandonNodeCounts[s.currentNodeId] = (abandonNodeCounts[s.currentNodeId] ?? 0) + 1;
      }
    }

    return {
      flowCount: flows.length,
      totalSessions: total,
      done,
      transferred,
      active,
      transferRate: total ? transferred / total : 0,
      completionRate: total ? done / total : 0,
      abandonNodeCounts,
    };
  });

  fastify.get("/attendance", async (request) => {
    const accountId = request.user.accountId;
    const conversations = await prisma.conversation.findMany({ where: { accountId } });

    const resolved = conversations.filter((c) => c.resolvedAt);
    const tmaMs = resolved.length
      ? resolved.reduce((acc, c) => acc + (c.resolvedAt!.getTime() - c.createdAt.getTime()), 0) / resolved.length
      : 0;

    const responded = conversations.filter((c) => c.firstResponseAt);
    const tmeMs = responded.length
      ? responded.reduce((acc, c) => acc + (c.firstResponseAt!.getTime() - c.createdAt.getTime()), 0) / responded.length
      : 0;

    const byAgent: Record<string, number> = {};
    const byQueue: Record<string, number> = {};
    for (const c of conversations) {
      if (c.agentId) byAgent[c.agentId] = (byAgent[c.agentId] ?? 0) + 1;
      if (c.queueId) byQueue[c.queueId] = (byQueue[c.queueId] ?? 0) + 1;
    }

    return {
      totalConversations: conversations.length,
      resolvedCount: resolved.length,
      tmaMinutes: tmaMs / 60_000,
      tmeMinutes: tmeMs / 60_000,
      byAgent,
      byQueue,
    };
  });

  fastify.get("/export", async (request, reply) => {
    const accountId = request.user.accountId;
    const type = (request.query as any)?.type as string | undefined;

    if (type === "campaigns") {
      const campaigns = await prisma.campaign.findMany({ where: { accountId } });
      const csv = toCsv(
        campaigns.map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          totalCount: c.totalCount,
          sentCount: c.sentCount,
          failedCount: c.failedCount,
          createdAt: c.createdAt.toISOString(),
        })),
        ["id", "name", "status", "totalCount", "sentCount", "failedCount", "createdAt"]
      );
      reply.header("content-type", "text/csv").header("content-disposition", "attachment; filename=campaigns.csv").send(csv);
      return;
    }

    if (type === "messages") {
      const messages = await prisma.message.findMany({ where: { accountId }, orderBy: { createdAt: "desc" }, take: 5000 });
      const csv = toCsv(
        messages.map((m) => ({
          id: m.id,
          direction: m.direction,
          channelType: m.channelType,
          status: m.status,
          costCredits: m.costCredits,
          createdAt: m.createdAt.toISOString(),
        })),
        ["id", "direction", "channelType", "status", "costCredits", "createdAt"]
      );
      reply.header("content-type", "text/csv").header("content-disposition", "attachment; filename=messages.csv").send(csv);
      return;
    }

    if (type === "contacts") {
      const contacts = await prisma.contact.findMany({ where: { accountId } });
      const csv = toCsv(
        contacts.map((c) => ({ id: c.id, name: c.name, phone: c.phone, email: c.email, createdAt: c.createdAt.toISOString() })),
        ["id", "name", "phone", "email", "createdAt"]
      );
      reply.header("content-type", "text/csv").header("content-disposition", "attachment; filename=contacts.csv").send(csv);
      return;
    }

    reply.code(400).send({ error: "BAD_REQUEST", message: "type deve ser campaigns, messages ou contacts" });
  });
}
