import { FastifyInstance } from "fastify";
import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";

const EVENTS = ["message.status", "message.received", "contact.optout"] as const;

const webhookSchema = z.object({
  url: z.string().url(),
  secret: z.string().optional(),
  events: z.array(z.enum(EVENTS)).min(1),
});

export default async function webhooksRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole("ADMIN", "DEVELOPER"));

  fastify.get("/", async (request) => {
    const accountId = request.user.accountId;
    return prisma.webhook.findMany({ where: { accountId }, orderBy: { createdAt: "desc" } });
  });

  fastify.post("/", async (request, reply) => {
    const accountId = request.user.accountId;
    const body = webhookSchema.parse(request.body);
    const webhook = await prisma.webhook.create({
      data: {
        accountId,
        url: body.url,
        secret: body.secret || nanoid(24),
        events: body.events.join(","),
      },
    });
    reply.code(201).send(webhook);
  });

  fastify.get("/:id/deliveries", async (request) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const webhook = await prisma.webhook.findFirst({ where: { id, accountId } });
    if (!webhook) throw Errors.notFound("Webhook não encontrado");
    return prisma.webhookDelivery.findMany({ where: { webhookId: id }, orderBy: { createdAt: "desc" }, take: 100 });
  });

  fastify.delete("/:id", async (request, reply) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const webhook = await prisma.webhook.findFirst({ where: { id, accountId } });
    if (!webhook) throw Errors.notFound("Webhook não encontrado");
    await prisma.webhook.update({ where: { id }, data: { active: false } });
    reply.code(204).send();
  });
}
