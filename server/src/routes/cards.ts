import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { badRequest, notFound } from "../lib/http-error.js";
import { validateFieldValues } from "../lib/field-values.js";
import { logActivity } from "../lib/activity.js";

const createCardSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  values: z.record(z.any()).optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

const updateCardSchema = z.object({
  title: z.string().min(1).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  values: z.record(z.any()).optional(),
});

const moveCardSchema = z.object({
  phaseId: z.string().min(1),
  position: z.number().int().min(0),
});

const cardInclude = {
  values: true,
  assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
  labels: { include: { label: true } },
  comments: {
    orderBy: { createdAt: "asc" as const },
    include: { author: { select: { id: true, name: true, email: true } } },
  },
  activities: { orderBy: { createdAt: "asc" as const } },
  phase: true,
};

export default async function cardRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  app.post("/pipes/:id/cards", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = createCardSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest("Dados inválidos", parsed.error.flatten());
    }

    const pipe = await prisma.pipe.findUnique({
      where: { id },
      include: { fields: true, phases: { orderBy: { position: "asc" } } },
    });
    if (!pipe) {
      throw notFound("Pipe não encontrado");
    }
    const firstPhase = pipe.phases[0];
    if (!firstPhase) {
      throw badRequest("Pipe não possui fases");
    }

    const values = validateFieldValues(pipe.fields, parsed.data.values);

    const maxPosition = await prisma.card.aggregate({
      where: { phaseId: firstPhase.id },
      _max: { position: true },
    });

    const card = await prisma.card.create({
      data: {
        phaseId: firstPhase.id,
        title: parsed.data.title,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        position: (maxPosition._max.position ?? -1) + 1,
        values: {
          create: Object.entries(values).map(([fieldId, value]) => ({ fieldId, value })),
        },
      },
      include: cardInclude,
    });

    await logActivity(card.id, request.user.name, "created", `criou o card "${card.title}"`);

    const full = await prisma.card.findUnique({ where: { id: card.id }, include: cardInclude });
    reply.code(201).send({ card: full });
  });

  app.get("/cards/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const card = await prisma.card.findUnique({ where: { id }, include: cardInclude });
    if (!card) {
      throw notFound("Card não encontrado");
    }
    reply.send({ card });
  });

  app.patch("/cards/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateCardSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest("Dados inválidos", parsed.error.flatten());
    }

    const card = await prisma.card.findUnique({ where: { id }, include: { phase: true } });
    if (!card) {
      throw notFound("Card não encontrado");
    }

    const pipe = await prisma.pipe.findUnique({
      where: { id: card.phase.pipeId },
      include: { fields: true },
    });
    if (!pipe) {
      throw notFound("Pipe não encontrado");
    }

    const values = parsed.data.values
      ? validateFieldValues(pipe.fields, parsed.data.values, { partial: true })
      : undefined;

    await prisma.$transaction(async (tx) => {
      const data: Record<string, unknown> = {};
      if (parsed.data.title !== undefined) data.title = parsed.data.title;
      if (parsed.data.dueDate !== undefined) {
        data.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
      }
      if (Object.keys(data).length > 0) {
        await tx.card.update({ where: { id }, data });
      }

      if (values) {
        for (const [fieldId, value] of Object.entries(values)) {
          await tx.fieldValue.upsert({
            where: { cardId_fieldId: { cardId: id, fieldId } },
            create: { cardId: id, fieldId, value },
            update: { value },
          });
        }
      }
    });

    const changedParts: string[] = [];
    if (parsed.data.title !== undefined) changedParts.push("título");
    if (parsed.data.dueDate !== undefined) changedParts.push("vencimento");
    if (values && Object.keys(values).length > 0) changedParts.push("campos");
    if (changedParts.length > 0) {
      await logActivity(
        id,
        request.user.name,
        "field_updated",
        `atualizou ${changedParts.join(", ")}`
      );
    }

    const full = await prisma.card.findUnique({ where: { id }, include: cardInclude });
    reply.send({ card: full });
  });

  app.delete("/cards/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.card.findUnique({ where: { id } });
    if (!existing) {
      throw notFound("Card não encontrado");
    }
    await prisma.card.delete({ where: { id } });
    reply.code(204).send();
  });

  app.post("/cards/:id/move", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = moveCardSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest("Dados inválidos", parsed.error.flatten());
    }
    const { phaseId: targetPhaseId, position: targetPosition } = parsed.data;

    const card = await prisma.card.findUnique({ where: { id }, include: { phase: true } });
    if (!card) {
      throw notFound("Card não encontrado");
    }
    const targetPhase = await prisma.phase.findUnique({ where: { id: targetPhaseId } });
    if (!targetPhase) {
      throw notFound("Fase de destino não encontrada");
    }
    if (targetPhase.pipeId !== card.phase.pipeId) {
      throw badRequest("Fase de destino não pertence ao mesmo pipe");
    }

    const sourcePhaseId = card.phaseId;
    const isSamePhase = sourcePhaseId === targetPhaseId;

    await prisma.$transaction(async (tx) => {
      if (isSamePhase) {
        const siblings = await tx.card.findMany({
          where: { phaseId: sourcePhaseId, id: { not: id } },
          orderBy: { position: "asc" },
        });
        const ordered = [...siblings];
        const insertAt = Math.min(targetPosition, ordered.length);
        ordered.splice(insertAt, 0, card);
        for (let i = 0; i < ordered.length; i++) {
          await tx.card.update({ where: { id: ordered[i].id }, data: { position: i } });
        }
      } else {
        const sourceSiblings = await tx.card.findMany({
          where: { phaseId: sourcePhaseId, id: { not: id } },
          orderBy: { position: "asc" },
        });
        for (let i = 0; i < sourceSiblings.length; i++) {
          await tx.card.update({ where: { id: sourceSiblings[i].id }, data: { position: i } });
        }

        const targetSiblings = await tx.card.findMany({
          where: { phaseId: targetPhaseId },
          orderBy: { position: "asc" },
        });
        const insertAt = Math.min(targetPosition, targetSiblings.length);
        targetSiblings.splice(insertAt, 0, card);
        for (let i = 0; i < targetSiblings.length; i++) {
          await tx.card.update({
            where: { id: targetSiblings[i].id },
            data: { position: i, phaseId: targetPhaseId },
          });
        }
      }
    });

    const detail = isSamePhase
      ? `reordenou o card na fase "${card.phase.name}"`
      : `moveu o card de "${card.phase.name}" para "${targetPhase.name}"`;
    await logActivity(id, request.user.name, "moved", detail);

    const full = await prisma.card.findUnique({ where: { id }, include: cardInclude });
    reply.send({ card: full });
  });

  const assigneeSchema = z.object({ userId: z.string().min(1) });

  app.post("/cards/:id/assignees", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = assigneeSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest("Dados inválidos", parsed.error.flatten());
    }
    const card = await prisma.card.findUnique({ where: { id } });
    if (!card) {
      throw notFound("Card não encontrado");
    }
    const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
    if (!user) {
      throw notFound("Usuário não encontrado");
    }

    await prisma.cardAssignee.upsert({
      where: { cardId_userId: { cardId: id, userId: user.id } },
      create: { cardId: id, userId: user.id },
      update: {},
    });

    await logActivity(id, request.user.name, "assigned", `atribuiu ${user.name} ao card`);

    const full = await prisma.card.findUnique({ where: { id }, include: cardInclude });
    reply.code(201).send({ card: full });
  });

  app.delete("/cards/:id/assignees/:userId", async (request, reply) => {
    const { id, userId } = request.params as { id: string; userId: string };
    const card = await prisma.card.findUnique({ where: { id } });
    if (!card) {
      throw notFound("Card não encontrado");
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });

    await prisma.cardAssignee
      .delete({ where: { cardId_userId: { cardId: id, userId } } })
      .catch(() => null);

    await logActivity(
      id,
      request.user.name,
      "unassigned",
      `removeu ${user?.name ?? "usuário"} do card`
    );

    const full = await prisma.card.findUnique({ where: { id }, include: cardInclude });
    reply.send({ card: full });
  });

  const labelSchema = z.object({ labelId: z.string().min(1) });

  app.post("/cards/:id/labels", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = labelSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest("Dados inválidos", parsed.error.flatten());
    }
    const card = await prisma.card.findUnique({ where: { id } });
    if (!card) {
      throw notFound("Card não encontrado");
    }
    const label = await prisma.label.findUnique({ where: { id: parsed.data.labelId } });
    if (!label) {
      throw notFound("Etiqueta não encontrada");
    }

    await prisma.cardLabel.upsert({
      where: { cardId_labelId: { cardId: id, labelId: label.id } },
      create: { cardId: id, labelId: label.id },
      update: {},
    });

    await logActivity(id, request.user.name, "label_added", `adicionou a etiqueta "${label.name}"`);

    const full = await prisma.card.findUnique({ where: { id }, include: cardInclude });
    reply.code(201).send({ card: full });
  });

  app.delete("/cards/:id/labels/:labelId", async (request, reply) => {
    const { id, labelId } = request.params as { id: string; labelId: string };
    const card = await prisma.card.findUnique({ where: { id } });
    if (!card) {
      throw notFound("Card não encontrado");
    }
    const label = await prisma.label.findUnique({ where: { id: labelId } });

    await prisma.cardLabel
      .delete({ where: { cardId_labelId: { cardId: id, labelId } } })
      .catch(() => null);

    await logActivity(
      id,
      request.user.name,
      "label_removed",
      `removeu a etiqueta "${label?.name ?? ""}"`
    );

    const full = await prisma.card.findUnique({ where: { id }, include: cardInclude });
    reply.send({ card: full });
  });
}
