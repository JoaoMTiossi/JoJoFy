import { FastifyInstance } from "fastify";

/** Stub inicial — expandido no M9 com números reais de campanhas/bot/atendimento. */
export default async function reportsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/dashboard",
    { preHandler: [fastify.authenticate, fastify.requireRole("ADMIN", "MANAGER")] },
    async (_request, reply) => {
      reply.send({ ok: true });
    }
  );
}
