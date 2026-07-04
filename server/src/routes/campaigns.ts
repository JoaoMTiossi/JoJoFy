import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";
import { enqueueCampaignStart, getCampaignReport } from "../core/campaigns/runner";

const campaignSchema = z
  .object({
    name: z.string().min(1),
    channelId: z.string(),
    listId: z.string().optional(),
    segmentId: z.string().optional(),
    templateId: z.string(),
    variantBId: z.string().optional(),
    variantPct: z.number().min(1).max(99).optional(),
    variables: z.record(z.string()).optional(),
    scheduleAt: z.string().datetime().optional(),
  })
  .refine((data) => !!data.listId !== !!data.segmentId, {
    message: "Informe exatamente uma audiência: listId OU segmentId",
  });

export default async function campaignsRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole("ADMIN", "MANAGER"));

  fastify.get("/", async (request) => {
    const accountId = request.user.accountId;
    return prisma.campaign.findMany({ where: { accountId }, orderBy: { createdAt: "desc" } });
  });

  fastify.post("/", async (request, reply) => {
    const accountId = request.user.accountId;
    const body = campaignSchema.parse(request.body);

    const channel = await prisma.channel.findFirst({ where: { id: body.channelId, accountId } });
    if (!channel) throw Errors.notFound("Canal não encontrado");
    const template = await prisma.template.findFirst({ where: { id: body.templateId, accountId } });
    if (!template) throw Errors.notFound("Template não encontrado");
    if (body.variantBId) {
      const variantB = await prisma.template.findFirst({ where: { id: body.variantBId, accountId } });
      if (!variantB) throw Errors.notFound("Template da variante B não encontrado");
    }
    if (body.listId) {
      const list = await prisma.list.findFirst({ where: { id: body.listId, accountId } });
      if (!list) throw Errors.notFound("Lista não encontrada");
    }
    if (body.segmentId) {
      const segment = await prisma.segment.findFirst({ where: { id: body.segmentId, accountId } });
      if (!segment) throw Errors.notFound("Segmento não encontrado");
    }

    const scheduleAt = body.scheduleAt ? new Date(body.scheduleAt) : new Date();

    const campaign = await prisma.campaign.create({
      data: {
        accountId,
        name: body.name,
        channelId: body.channelId,
        channelType: channel.type,
        listId: body.listId,
        segmentId: body.segmentId,
        templateId: body.templateId,
        variantBId: body.variantBId,
        variantPct: body.variantPct,
        variables: body.variables ? JSON.stringify(body.variables) : undefined,
        scheduleAt: body.scheduleAt ? scheduleAt : undefined,
        status: "SCHEDULED",
      },
    });

    await enqueueCampaignStart(campaign.id, accountId, scheduleAt);

    reply.code(201).send(campaign);
  });

  fastify.get("/:id", async (request) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const campaign = await prisma.campaign.findFirst({ where: { id, accountId } });
    if (!campaign) throw Errors.notFound("Campanha não encontrada");
    return getCampaignReport(id);
  });

  fastify.post("/:id/cancel", async (request, reply) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const campaign = await prisma.campaign.findFirst({ where: { id, accountId } });
    if (!campaign) throw Errors.notFound("Campanha não encontrada");
    if (campaign.status === "DONE") throw Errors.badRequest("Campanha já concluída");
    const updated = await prisma.campaign.update({ where: { id }, data: { status: "CANCELED" } });
    reply.send(updated);
  });
}
