import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";

const schema = z.object({ shortcut: z.string().min(1), body: z.string().min(1) });

export default async function quickRepliesRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/", async (request) => {
    const accountId = request.user.accountId;
    return prisma.quickReply.findMany({ where: { accountId }, orderBy: { shortcut: "asc" } });
  });

  fastify.post("/", { preHandler: fastify.requireRole("ADMIN", "MANAGER") }, async (request, reply) => {
    const accountId = request.user.accountId;
    const body = schema.parse(request.body);
    const existing = await prisma.quickReply.findUnique({ where: { accountId_shortcut: { accountId, shortcut: body.shortcut } } });
    if (existing) throw Errors.conflict("Já existe uma resposta rápida com esse atalho");
    const quickReply = await prisma.quickReply.create({ data: { accountId, ...body } });
    reply.code(201).send(quickReply);
  });

  fastify.delete("/:id", { preHandler: fastify.requireRole("ADMIN", "MANAGER") }, async (request, reply) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const existing = await prisma.quickReply.findFirst({ where: { id, accountId } });
    if (!existing) throw Errors.notFound("Resposta rápida não encontrada");
    await prisma.quickReply.delete({ where: { id } });
    reply.code(204).send();
  });
}
