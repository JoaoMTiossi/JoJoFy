import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";

export default async function channelsRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/", async (request) => {
    const accountId = request.user.accountId;
    return prisma.channel.findMany({ where: { accountId }, orderBy: { createdAt: "asc" } });
  });

  fastify.get("/:id", async (request) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const channel = await prisma.channel.findFirst({ where: { id, accountId } });
    if (!channel) throw Errors.notFound("Canal não encontrado");
    return channel;
  });
}
