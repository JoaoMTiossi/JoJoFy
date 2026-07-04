import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const statusSchema = z.object({ status: z.enum(["ONLINE", "AWAY", "OFFLINE"]) });

export default async function agentStatusRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/", async (request) => {
    const userId = request.user.sub;
    const status = await prisma.agentStatus.upsert({
      where: { userId },
      update: {},
      create: { userId, status: "OFFLINE" },
    });
    return status;
  });

  fastify.put("/", async (request) => {
    const userId = request.user.sub;
    const body = statusSchema.parse(request.body);
    return prisma.agentStatus.upsert({
      where: { userId },
      update: { status: body.status },
      create: { userId, status: body.status },
    });
  });
}
