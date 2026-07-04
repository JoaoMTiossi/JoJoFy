import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";

const nodeSchema = z.object({
  id: z.string(),
  type: z.enum(["message", "question", "condition", "action", "handoff"]),
  data: z.record(z.any()),
  next: z.array(z.string()),
});

const graphSchema = z.object({
  startNodeId: z.string(),
  nodes: z.array(nodeSchema),
});

const flowSchema = z.object({
  channelId: z.string(),
  name: z.string().min(1),
  keywords: z.array(z.string()).optional(),
  isDefault: z.boolean().optional(),
  draft: graphSchema.optional(),
});

export default async function flowsRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole("ADMIN", "MANAGER"));

  fastify.get("/", async (request) => {
    const accountId = request.user.accountId;
    return prisma.flow.findMany({ where: { accountId }, orderBy: { createdAt: "desc" } });
  });

  fastify.post("/", async (request, reply) => {
    const accountId = request.user.accountId;
    const body = flowSchema.parse(request.body);
    const channel = await prisma.channel.findFirst({ where: { id: body.channelId, accountId } });
    if (!channel) throw Errors.notFound("Canal não encontrado");

    const flow = await prisma.flow.create({
      data: {
        accountId,
        channelId: body.channelId,
        name: body.name,
        keywords: body.keywords?.join(","),
        isDefault: body.isDefault ?? false,
        draft: JSON.stringify(body.draft ?? { startNodeId: "", nodes: [] }),
      },
    });
    reply.code(201).send({ ...flow, draft: JSON.parse(flow.draft) });
  });

  fastify.get("/:id", async (request) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const flow = await prisma.flow.findFirst({ where: { id, accountId } });
    if (!flow) throw Errors.notFound("Fluxo não encontrado");
    return {
      ...flow,
      draft: JSON.parse(flow.draft),
      published: flow.published ? JSON.parse(flow.published) : null,
      keywords: flow.keywords ? flow.keywords.split(",") : [],
    };
  });

  fastify.patch("/:id", async (request) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const existing = await prisma.flow.findFirst({ where: { id, accountId } });
    if (!existing) throw Errors.notFound("Fluxo não encontrado");
    const body = flowSchema.partial().parse(request.body);

    const updated = await prisma.flow.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.keywords !== undefined ? { keywords: body.keywords.join(",") } : {}),
        ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
        ...(body.draft !== undefined ? { draft: JSON.stringify(body.draft) } : {}),
      },
    });
    return { ...updated, draft: JSON.parse(updated.draft) };
  });

  fastify.post("/:id/publish", async (request, reply) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const flow = await prisma.flow.findFirst({ where: { id, accountId } });
    if (!flow) throw Errors.notFound("Fluxo não encontrado");
    const updated = await prisma.flow.update({ where: { id }, data: { published: flow.draft } });
    reply.send({ ...updated, draft: JSON.parse(updated.draft), published: JSON.parse(updated.published!) });
  });

  fastify.delete("/:id", async (request, reply) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const flow = await prisma.flow.findFirst({ where: { id, accountId } });
    if (!flow) throw Errors.notFound("Fluxo não encontrado");
    await prisma.flow.delete({ where: { id } });
    reply.code(204).send();
  });
}
