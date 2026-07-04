import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";
import { activateJourney } from "../core/journeys/runner";

const stepSchema = z.union([
  z.object({
    type: z.literal("send"),
    templateId: z.string(),
    channelId: z.string(),
    vars: z.record(z.string()).optional(),
    next: z.number().int().optional(),
  }),
  z.object({ type: z.literal("wait"), durationMs: z.number().positive() }),
  z.object({
    type: z.literal("condition"),
    conditionType: z.enum(["replied", "attribute"]),
    attr: z.string().optional(),
    op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "contains", "exists", "not_exists"]).optional(),
    value: z.union([z.string(), z.number()]).optional(),
    ifTrueStepIndex: z.number().int(),
    ifFalseStepIndex: z.number().int(),
  }),
]);

const journeyBaseSchema = z.object({
  name: z.string().min(1),
  definition: z.object({ steps: z.array(stepSchema) }),
  listId: z.string().optional(),
  segmentId: z.string().optional(),
});

const journeySchema = journeyBaseSchema.refine((data) => !!data.listId !== !!data.segmentId, {
  message: "Informe exatamente uma audiência: listId OU segmentId",
});

export default async function journeysRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole("ADMIN", "MANAGER"));

  fastify.get("/", async (request) => {
    const accountId = request.user.accountId;
    return prisma.journey.findMany({ where: { accountId }, orderBy: { createdAt: "desc" } });
  });

  fastify.post("/", async (request, reply) => {
    const accountId = request.user.accountId;
    const body = journeySchema.parse(request.body);
    const journey = await prisma.journey.create({
      data: {
        accountId,
        name: body.name,
        definition: JSON.stringify(body.definition),
        listId: body.listId,
        segmentId: body.segmentId,
        status: "DRAFT",
      },
    });
    reply.code(201).send(journey);
  });

  fastify.get("/:id", async (request) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const journey = await prisma.journey.findFirst({ where: { id, accountId } });
    if (!journey) throw Errors.notFound("Jornada não encontrada");
    const runs = await prisma.journeyRun.findMany({ where: { journeyId: id } });
    return {
      ...journey,
      definition: JSON.parse(journey.definition),
      runsSummary: {
        total: runs.length,
        running: runs.filter((r) => r.status === "RUNNING").length,
        done: runs.filter((r) => r.status === "DONE").length,
        replied: runs.filter((r) => r.replied).length,
      },
    };
  });

  fastify.patch("/:id", async (request) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const existing = await prisma.journey.findFirst({ where: { id, accountId } });
    if (!existing) throw Errors.notFound("Jornada não encontrada");
    const body = journeyBaseSchema.partial().parse(request.body);
    return prisma.journey.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.definition !== undefined ? { definition: JSON.stringify(body.definition) } : {}),
      },
    });
  });

  fastify.post("/:id/activate", async (request, reply) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const journey = await prisma.journey.findFirst({ where: { id, accountId } });
    if (!journey) throw Errors.notFound("Jornada não encontrada");
    await activateJourney(id);
    const updated = await prisma.journey.findUnique({ where: { id } });
    reply.send(updated);
  });
}
