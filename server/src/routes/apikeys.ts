import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";
import { generateApiKey } from "../lib/apikey";

const SCOPES = ["messages:send", "messages:read"] as const;

const createSchema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.enum(SCOPES)).min(1),
});

export default async function apiKeysRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole("ADMIN", "DEVELOPER"));

  fastify.get("/", async (request) => {
    const accountId = request.user.accountId;
    const keys = await prisma.apiKey.findMany({ where: { accountId }, orderBy: { createdAt: "desc" } });
    return keys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      scopes: k.scopes.split(","),
      revoked: k.revoked,
      lastUsedAt: k.lastUsedAt,
      createdAt: k.createdAt,
    }));
  });

  fastify.post("/", async (request, reply) => {
    const accountId = request.user.accountId;
    const body = createSchema.parse(request.body);
    const { raw, prefix, hash } = generateApiKey();

    const apiKey = await prisma.apiKey.create({
      data: {
        accountId,
        name: body.name,
        keyHash: hash,
        keyPrefix: prefix,
        scopes: body.scopes.join(","),
      },
    });

    // A chave em texto puro só é exibida nesta resposta — não é recuperável depois.
    reply.code(201).send({
      id: apiKey.id,
      name: apiKey.name,
      scopes: body.scopes,
      key: raw,
      keyPrefix: prefix,
    });
  });

  fastify.delete("/:id", async (request, reply) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const apiKey = await prisma.apiKey.findFirst({ where: { id, accountId } });
    if (!apiKey) throw Errors.notFound("Chave de API não encontrada");
    await prisma.apiKey.update({ where: { id }, data: { revoked: true } });
    reply.code(204).send();
  });
}
