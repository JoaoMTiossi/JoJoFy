import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";

const templateSchema = z.object({
  channelId: z.string(),
  name: z.string().min(1),
  body: z.string().min(1),
  buttons: z.array(z.object({ label: z.string() })).optional(),
  subject: z.string().optional(),
  html: z.string().optional(),
});

export default async function templatesRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole("ADMIN", "MANAGER"));

  fastify.get("/", async (request) => {
    const accountId = request.user.accountId;
    const channelType = (request.query as any)?.channelType as string | undefined;
    return prisma.template.findMany({
      where: { accountId, ...(channelType ? { channelType } : {}) },
      orderBy: { createdAt: "desc" },
    });
  });

  fastify.post("/", async (request, reply) => {
    const accountId = request.user.accountId;
    const body = templateSchema.parse(request.body);
    const channel = await prisma.channel.findFirst({ where: { id: body.channelId, accountId } });
    if (!channel) throw Errors.notFound("Canal não encontrado");

    const template = await prisma.template.create({
      data: {
        accountId,
        channelId: body.channelId,
        channelType: channel.type,
        name: body.name,
        body: body.body,
        buttons: body.buttons ? JSON.stringify(body.buttons) : undefined,
        subject: body.subject,
        html: body.html,
        status: "APPROVED", // aprovação automática no simulado
      },
    });
    reply.code(201).send(template);
  });

  fastify.get("/:id", async (request) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const template = await prisma.template.findFirst({ where: { id, accountId } });
    if (!template) throw Errors.notFound("Template não encontrado");
    return template;
  });

  fastify.patch("/:id", async (request) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const body = templateSchema.partial().parse(request.body);
    const existing = await prisma.template.findFirst({ where: { id, accountId } });
    if (!existing) throw Errors.notFound("Template não encontrado");

    return prisma.template.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.body !== undefined ? { body: body.body } : {}),
        ...(body.buttons !== undefined ? { buttons: JSON.stringify(body.buttons) } : {}),
        ...(body.subject !== undefined ? { subject: body.subject } : {}),
        ...(body.html !== undefined ? { html: body.html } : {}),
      },
    });
  });

  fastify.delete("/:id", async (request, reply) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const existing = await prisma.template.findFirst({ where: { id, accountId } });
    if (!existing) throw Errors.notFound("Template não encontrado");
    await prisma.template.delete({ where: { id } });
    reply.code(204).send();
  });
}
