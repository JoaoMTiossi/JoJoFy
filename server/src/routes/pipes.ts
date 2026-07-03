import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { badRequest, notFound } from "../lib/http-error.js";

const createPipeSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  icon: z.string().optional(),
  color: z.string().optional(),
});

const updatePipeSchema = z.object({
  name: z.string().min(1).optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

const DEFAULT_PHASES = [
  { name: "Caixa de entrada", isDone: false, isCanceled: false },
  { name: "Em andamento", isDone: false, isCanceled: false },
  { name: "Concluído", isDone: true, isCanceled: false },
];

export default async function pipeRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  app.get("/pipes", async (_request, reply) => {
    const pipes = await prisma.pipe.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        phases: {
          include: { _count: { select: { cards: true } } },
        },
      },
    });

    const result = pipes.map((pipe) => {
      const activeCards = pipe.phases
        .filter((phase) => !phase.isDone && !phase.isCanceled)
        .reduce((sum, phase) => sum + phase._count.cards, 0);
      const totalCards = pipe.phases.reduce((sum, phase) => sum + phase._count.cards, 0);
      const { phases, ...rest } = pipe;
      return { ...rest, activeCardsCount: activeCards, totalCardsCount: totalCards };
    });

    reply.send({ pipes: result });
  });

  app.post("/pipes", async (request, reply) => {
    const parsed = createPipeSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest("Dados inválidos", parsed.error.flatten());
    }
    const { name, icon, color } = parsed.data;

    const pipe = await prisma.pipe.create({
      data: {
        name,
        icon: icon || undefined,
        color: color || undefined,
        phases: {
          create: DEFAULT_PHASES.map((phase, index) => ({
            name: phase.name,
            position: index,
            isDone: phase.isDone,
            isCanceled: phase.isCanceled,
          })),
        },
      },
      include: { phases: { orderBy: { position: "asc" } } },
    });

    reply.code(201).send({ pipe });
  });

  app.get("/pipes/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const pipe = await prisma.pipe.findUnique({
      where: { id },
      include: {
        phases: {
          orderBy: { position: "asc" },
          include: {
            cards: {
              orderBy: { position: "asc" },
              include: {
                values: true,
                assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
                labels: { include: { label: true } },
              },
            },
          },
        },
        fields: { orderBy: { position: "asc" } },
        labels: true,
      },
    });
    if (!pipe) {
      throw notFound("Pipe não encontrado");
    }
    reply.send({ pipe });
  });

  app.patch("/pipes/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updatePipeSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest("Dados inválidos", parsed.error.flatten());
    }
    const existing = await prisma.pipe.findUnique({ where: { id } });
    if (!existing) {
      throw notFound("Pipe não encontrado");
    }
    const pipe = await prisma.pipe.update({ where: { id }, data: parsed.data });
    reply.send({ pipe });
  });

  app.delete("/pipes/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.pipe.findUnique({ where: { id } });
    if (!existing) {
      throw notFound("Pipe não encontrado");
    }
    await prisma.pipe.delete({ where: { id } });
    reply.code(204).send();
  });
}
