import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";
import { resolveSegmentContactIds, SegmentFilter } from "../core/segments/evaluator";

const conditionSchema = z.object({
  attr: z.string(),
  op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "contains", "exists", "not_exists"]),
  value: z.union([z.string(), z.number()]).optional(),
});

const segmentSchema = z.object({
  name: z.string().min(1),
  filter: z.object({
    logic: z.literal("AND"),
    conditions: z.array(conditionSchema),
  }),
});

export default async function segmentsRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole("ADMIN", "MANAGER"));

  fastify.get("/", async (request) => {
    const accountId = request.user.accountId;
    return prisma.segment.findMany({ where: { accountId }, orderBy: { createdAt: "desc" } });
  });

  fastify.post("/", async (request, reply) => {
    const accountId = request.user.accountId;
    const body = segmentSchema.parse(request.body);
    const segment = await prisma.segment.create({
      data: { accountId, name: body.name, filter: JSON.stringify(body.filter) },
    });
    reply.code(201).send(segment);
  });

  fastify.get("/:id", async (request) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const segment = await prisma.segment.findFirst({ where: { id, accountId } });
    if (!segment) throw Errors.notFound("Segmento não encontrado");
    return { ...segment, filter: JSON.parse(segment.filter) };
  });

  fastify.get("/:id/contacts", async (request) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const segment = await prisma.segment.findFirst({ where: { id, accountId } });
    if (!segment) throw Errors.notFound("Segmento não encontrado");
    const filter = JSON.parse(segment.filter) as SegmentFilter;
    const contactIds = await resolveSegmentContactIds(accountId, filter);
    const contacts = await prisma.contact.findMany({ where: { id: { in: contactIds } } });
    return contacts;
  });

  fastify.delete("/:id", async (request, reply) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const segment = await prisma.segment.findFirst({ where: { id, accountId } });
    if (!segment) throw Errors.notFound("Segmento não encontrado");
    await prisma.segment.delete({ where: { id } });
    reply.code(204).send();
  });
}
