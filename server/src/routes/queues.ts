import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";

const queueSchema = z.object({
  name: z.string().min(1),
  strategy: z.enum(["ROUND_ROBIN", "LEAST_BUSY"]).optional(),
  maxPerAgent: z.number().int().positive().optional(),
});

export default async function queuesRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/", async (request) => {
    const accountId = request.user.accountId;
    const queues = await prisma.queue.findMany({
      where: { accountId },
      orderBy: { createdAt: "asc" },
      include: { members: true, _count: { select: { conversations: true } } },
    });
    return queues;
  });

  fastify.post("/", { preHandler: fastify.requireRole("ADMIN", "MANAGER") }, async (request, reply) => {
    const accountId = request.user.accountId;
    const body = queueSchema.parse(request.body);
    const queue = await prisma.queue.create({
      data: { accountId, name: body.name, strategy: body.strategy ?? "ROUND_ROBIN", maxPerAgent: body.maxPerAgent ?? 5 },
    });
    reply.code(201).send(queue);
  });

  fastify.post("/:id/members", { preHandler: fastify.requireRole("ADMIN", "MANAGER") }, async (request, reply) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const { userId } = z.object({ userId: z.string() }).parse(request.body);
    const queue = await prisma.queue.findFirst({ where: { id, accountId } });
    if (!queue) throw Errors.notFound("Fila não encontrada");
    const user = await prisma.user.findFirst({ where: { id: userId, accountId } });
    if (!user) throw Errors.notFound("Usuário não encontrado");
    const member = await prisma.queueMember
      .create({ data: { queueId: id, userId } })
      .catch(() => prisma.queueMember.findFirst({ where: { queueId: id, userId } }));
    reply.code(201).send(member);
  });

  fastify.delete("/:id/members/:userId", { preHandler: fastify.requireRole("ADMIN", "MANAGER") }, async (request, reply) => {
    const accountId = request.user.accountId;
    const { id, userId } = request.params as { id: string; userId: string };
    const queue = await prisma.queue.findFirst({ where: { id, accountId } });
    if (!queue) throw Errors.notFound("Fila não encontrada");
    await prisma.queueMember.deleteMany({ where: { queueId: id, userId } });
    reply.code(204).send();
  });

  fastify.delete("/:id", { preHandler: fastify.requireRole("ADMIN", "MANAGER") }, async (request, reply) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const queue = await prisma.queue.findFirst({ where: { id, accountId } });
    if (!queue) throw Errors.notFound("Fila não encontrada");
    await prisma.queueMember.deleteMany({ where: { queueId: id } });
    await prisma.conversation.updateMany({ where: { queueId: id }, data: { queueId: null } });
    await prisma.queue.delete({ where: { id } });
    reply.code(204).send();
  });
}
