import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

/** Visão do gestor: filas, agentes e conversas em curso, com SLA estourado. */
export default async function supervisionRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole("ADMIN", "MANAGER"));

  fastify.get("/", async (request) => {
    const accountId = request.user.accountId;

    const queues = await prisma.queue.findMany({
      where: { accountId },
      include: { members: true },
    });

    const conversations = await prisma.conversation.findMany({
      where: { accountId, status: { in: ["OPEN", "ASSIGNED"] } },
      include: { contact: true, agent: true, queue: true },
      orderBy: { createdAt: "asc" },
    });

    const agentIds = [...new Set(queues.flatMap((q) => q.members.map((m) => m.userId)))];
    const agentStatuses = await prisma.agentStatus.findMany({ where: { userId: { in: agentIds } } });
    const users = await prisma.user.findMany({ where: { id: { in: agentIds } } });

    const now = Date.now();
    const withSla = conversations.map((c) => ({
      ...c,
      slaOverdue: c.status !== "RESOLVED" && !c.firstResponseAt && now - c.createdAt.getTime() > c.slaFirstResponseMin * 60_000,
    }));

    return {
      queues: queues.map((q) => ({ id: q.id, name: q.name, strategy: q.strategy, maxPerAgent: q.maxPerAgent, memberCount: q.members.length })),
      agents: users.map((u) => ({
        id: u.id,
        name: u.name,
        status: agentStatuses.find((s) => s.userId === u.id)?.status ?? "OFFLINE",
        activeCount: agentStatuses.find((s) => s.userId === u.id)?.activeCount ?? 0,
      })),
      conversations: withSla,
      slaOverdueCount: withSla.filter((c) => c.slaOverdue).length,
    };
  });
}
