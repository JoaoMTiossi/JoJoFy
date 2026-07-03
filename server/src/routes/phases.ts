import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { badRequest, conflict, notFound } from "../lib/http-error.js";

const createPhaseSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  isDone: z.boolean().optional(),
  isCanceled: z.boolean().optional(),
});

const updatePhaseSchema = z.object({
  name: z.string().min(1).optional(),
  isDone: z.boolean().optional(),
  isCanceled: z.boolean().optional(),
});

const reorderSchema = z.object({
  phaseIds: z.array(z.string()).min(1),
});

export default async function phaseRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  app.post("/pipes/:id/phases", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = createPhaseSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest("Dados inválidos", parsed.error.flatten());
    }
    const pipe = await prisma.pipe.findUnique({ where: { id } });
    if (!pipe) {
      throw notFound("Pipe não encontrado");
    }
    const maxPosition = await prisma.phase.aggregate({
      where: { pipeId: id },
      _max: { position: true },
    });
    const phase = await prisma.phase.create({
      data: {
        pipeId: id,
        name: parsed.data.name,
        isDone: parsed.data.isDone ?? false,
        isCanceled: parsed.data.isCanceled ?? false,
        position: (maxPosition._max.position ?? -1) + 1,
      },
    });
    reply.code(201).send({ phase });
  });

  app.patch("/pipes/:id/phases/reorder", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = reorderSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest("Dados inválidos", parsed.error.flatten());
    }
    const pipe = await prisma.pipe.findUnique({
      where: { id },
      include: { phases: true },
    });
    if (!pipe) {
      throw notFound("Pipe não encontrado");
    }
    const validIds = new Set(pipe.phases.map((p) => p.id));
    for (const phaseId of parsed.data.phaseIds) {
      if (!validIds.has(phaseId)) {
        throw badRequest("phaseIds contém fase que não pertence ao pipe");
      }
    }

    await prisma.$transaction(
      parsed.data.phaseIds.map((phaseId, index) =>
        prisma.phase.update({ where: { id: phaseId }, data: { position: index } })
      )
    );

    const phases = await prisma.phase.findMany({
      where: { pipeId: id },
      orderBy: { position: "asc" },
    });
    reply.send({ phases });
  });

  app.patch("/phases/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updatePhaseSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest("Dados inválidos", parsed.error.flatten());
    }
    const existing = await prisma.phase.findUnique({ where: { id } });
    if (!existing) {
      throw notFound("Fase não encontrada");
    }
    const phase = await prisma.phase.update({ where: { id }, data: parsed.data });
    reply.send({ phase });
  });

  app.delete("/phases/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.phase.findUnique({
      where: { id },
      include: { _count: { select: { cards: true } } },
    });
    if (!existing) {
      throw notFound("Fase não encontrada");
    }
    if (existing._count.cards > 0) {
      throw conflict("Não é possível excluir uma fase que contém cards");
    }
    await prisma.phase.delete({ where: { id } });
    reply.code(204).send();
  });
}
