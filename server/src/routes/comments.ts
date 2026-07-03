import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { badRequest, notFound } from "../lib/http-error.js";
import { logActivity } from "../lib/activity.js";

const createCommentSchema = z.object({
  body: z.string().min(1, "Comentário não pode ser vazio"),
});

export default async function commentRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  app.post("/cards/:id/comments", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = createCommentSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest("Dados inválidos", parsed.error.flatten());
    }
    const card = await prisma.card.findUnique({ where: { id } });
    if (!card) {
      throw notFound("Card não encontrado");
    }

    const comment = await prisma.comment.create({
      data: { cardId: id, authorId: request.user.id, body: parsed.data.body },
      include: { author: { select: { id: true, name: true, email: true } } },
    });

    await logActivity(id, request.user.name, "commented", `comentou: "${parsed.data.body}"`);

    reply.code(201).send({ comment });
  });
}
