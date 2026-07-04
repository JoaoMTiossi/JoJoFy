import { FastifyInstance } from "fastify";
import { z } from "zod";
import { handleInbound } from "../core/inbound/router";

const inboundSchema = z.object({
  contactId: z.string(),
  channelId: z.string(),
  text: z.string().min(1),
});

export default async function simulatorRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole("ADMIN"));

  fastify.post("/inbound", async (request, reply) => {
    const accountId = request.user.accountId;
    const body = inboundSchema.parse(request.body);
    const result = await handleInbound({
      accountId,
      contactId: body.contactId,
      channelId: body.channelId,
      text: body.text,
      source: "SIMULATOR",
    });
    reply.code(201).send(result);
  });
}
