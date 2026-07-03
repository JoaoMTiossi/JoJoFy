import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { badRequest, notFound } from "../lib/http-error.js";

const createLabelSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  color: z.string().min(1, "Cor é obrigatória"),
});

const updateLabelSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
});

export default async function labelRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  app.post("/pipes/:id/labels", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = createLabelSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest("Dados inválidos", parsed.error.flatten());
    }
    const pipe = await prisma.pipe.findUnique({ where: { id } });
    if (!pipe) {
      throw notFound("Pipe não encontrado");
    }
    const label = await prisma.label.create({
      data: { pipeId: id, name: parsed.data.name, color: parsed.data.color },
    });
    reply.code(201).send({ label });
  });

  app.patch("/labels/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateLabelSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest("Dados inválidos", parsed.error.flatten());
    }
    const existing = await prisma.label.findUnique({ where: { id } });
    if (!existing) {
      throw notFound("Etiqueta não encontrada");
    }
    const label = await prisma.label.update({ where: { id }, data: parsed.data });
    reply.send({ label });
  });

  app.delete("/labels/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.label.findUnique({ where: { id } });
    if (!existing) {
      throw notFound("Etiqueta não encontrada");
    }
    await prisma.label.delete({ where: { id } });
    reply.code(204).send();
  });
}
