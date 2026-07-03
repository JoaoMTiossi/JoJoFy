import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { badRequest, notFound } from "../lib/http-error.js";

const FIELD_TYPES = ["text", "textarea", "number", "date", "select", "email"] as const;

const baseFieldSchema = z.object({
  label: z.string().min(1, "Rótulo é obrigatório"),
  type: z.enum(FIELD_TYPES),
  required: z.boolean().optional(),
  options: z.array(z.string().min(1)).optional(),
});

function validateOptions(data: { type: string; options?: string[] }) {
  if (data.type === "select") {
    if (!data.options || data.options.length === 0) {
      throw badRequest("Campo do tipo seleção precisa de ao menos uma opção");
    }
  }
}

export default async function fieldRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  app.post("/pipes/:id/fields", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = baseFieldSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest("Dados inválidos", parsed.error.flatten());
    }
    const pipe = await prisma.pipe.findUnique({ where: { id } });
    if (!pipe) {
      throw notFound("Pipe não encontrado");
    }
    validateOptions(parsed.data);

    const maxPosition = await prisma.field.aggregate({
      where: { pipeId: id },
      _max: { position: true },
    });

    const field = await prisma.field.create({
      data: {
        pipeId: id,
        label: parsed.data.label,
        type: parsed.data.type,
        required: parsed.data.required ?? false,
        options: parsed.data.options ? JSON.stringify(parsed.data.options) : null,
        position: (maxPosition._max.position ?? -1) + 1,
      },
    });
    reply.code(201).send({ field });
  });

  const updateFieldSchema = z.object({
    label: z.string().min(1).optional(),
    type: z.enum(FIELD_TYPES).optional(),
    required: z.boolean().optional(),
    options: z.array(z.string().min(1)).optional(),
    position: z.number().int().optional(),
  });

  app.patch("/fields/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateFieldSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest("Dados inválidos", parsed.error.flatten());
    }
    const existing = await prisma.field.findUnique({ where: { id } });
    if (!existing) {
      throw notFound("Campo não encontrado");
    }

    const nextType = parsed.data.type ?? existing.type;
    const nextOptions =
      parsed.data.options ?? (existing.options ? (JSON.parse(existing.options) as string[]) : undefined);
    validateOptions({ type: nextType, options: nextOptions });

    const field = await prisma.field.update({
      where: { id },
      data: {
        ...parsed.data,
        options: parsed.data.options ? JSON.stringify(parsed.data.options) : undefined,
      },
    });
    reply.send({ field });
  });

  app.delete("/fields/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.field.findUnique({ where: { id } });
    if (!existing) {
      throw notFound("Campo não encontrado");
    }
    await prisma.field.delete({ where: { id } });
    reply.code(204).send();
  });
}
