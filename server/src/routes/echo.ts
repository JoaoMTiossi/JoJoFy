import { FastifyInstance } from "fastify";

interface EchoEntry {
  at: string;
  headers: Record<string, unknown>;
  body: unknown;
}

const received: EchoEntry[] = [];
const MAX_ENTRIES = 50;

/**
 * Endpoint de eco para testar webhooks localmente sem depender de um
 * serviço externo (ex.: webhook.site) — use como URL de destino ao cadastrar
 * um webhook e confira as entregas em GET /echo.
 */
export default async function echoRoutes(fastify: FastifyInstance) {
  fastify.post("/", async (request, reply) => {
    received.unshift({ at: new Date().toISOString(), headers: request.headers, body: request.body });
    if (received.length > MAX_ENTRIES) received.length = MAX_ENTRIES;
    reply.send({ ok: true });
  });

  fastify.get("/", async () => received);
}
