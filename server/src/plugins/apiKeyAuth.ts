import fp from "fastify-plugin";
import { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../lib/prisma";
import { hashApiKey } from "../lib/apikey";

export interface ApiKeyContext {
  accountId: string;
  apiKeyId: string;
  scopes: string[];
}

declare module "fastify" {
  interface FastifyRequest {
    apiKeyContext?: ApiKeyContext;
  }
  interface FastifyInstance {
    authenticateApiKey: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireScope: (...scopes: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async function apiKeyAuthPlugin(fastify) {
  fastify.decorate("authenticateApiKey", async function (request: FastifyRequest, reply: FastifyReply) {
    const raw = request.headers["x-api-key"];
    if (!raw || typeof raw !== "string") {
      reply.code(401).send({ error: "UNAUTHORIZED", message: "X-API-Key ausente" });
      return;
    }
    const hash = hashApiKey(raw);
    const apiKey = await prisma.apiKey.findFirst({ where: { keyHash: hash } });
    if (!apiKey || apiKey.revoked) {
      reply.code(401).send({ error: "UNAUTHORIZED", message: "Chave de API inválida ou revogada" });
      return;
    }
    await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });
    request.apiKeyContext = {
      accountId: apiKey.accountId,
      apiKeyId: apiKey.id,
      scopes: apiKey.scopes.split(",").map((s) => s.trim()).filter(Boolean),
    };
  });

  fastify.decorate("requireScope", function (...scopes: string[]) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
      const ctx = request.apiKeyContext;
      if (!ctx || !scopes.some((s) => ctx.scopes.includes(s))) {
        reply.code(403).send({ error: "FORBIDDEN", message: "Escopo insuficiente para esta operação" });
      }
    };
  });
});
