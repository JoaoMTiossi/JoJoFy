import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";
import { toE164, isValidE164 } from "../lib/e164";
import { sendMessage } from "../core/messaging/messageService";
import { CHANNEL_TYPES } from "../lib/enums";

const sendSchema = z.object({
  to: z.string().min(1),
  text: z.string().optional(),
  templateId: z.string().optional(),
  vars: z.record(z.string()).optional(),
  idempotencyKey: z.string().optional(),
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** API pública CPaaS: `POST /v1/channels/{canal}/messages`, `GET /v1/messages/{id}`. */
export default async function publicMessagesRoutes(fastify: FastifyInstance) {
  fastify.post("/channels/:type/messages", {
    preHandler: [fastify.authenticateApiKey, fastify.requireScope("messages:send")],
  }, async (request, reply) => {
    const { type } = request.params as { type: string };
    const channelType = type.toUpperCase();
    if (!CHANNEL_TYPES.includes(channelType as any)) {
      throw Errors.badRequest(`Canal desconhecido: ${type}`);
    }

    const body = sendSchema.parse(request.body);
    const ctx = request.apiKeyContext!;

    const channel = await prisma.channel.findFirst({ where: { accountId: ctx.accountId, type: channelType } });
    if (!channel) throw Errors.notFound(`Nenhum canal ${channelType} configurado nesta conta`);

    let contact;
    if (channelType === "WHATSAPP") {
      const phone = toE164(body.to);
      if (!isValidE164(phone)) throw Errors.badRequest("Destinatário 'to' inválido: informe um telefone");
      contact = await prisma.contact.findFirst({ where: { accountId: ctx.accountId, phone } });
      if (!contact) {
        contact = await prisma.contact.create({ data: { accountId: ctx.accountId, name: phone, phone } });
      }
    } else {
      if (!EMAIL_RE.test(body.to)) throw Errors.badRequest("Destinatário 'to' inválido: informe um e-mail");
      const email = body.to.toLowerCase();
      contact = await prisma.contact.findFirst({ where: { accountId: ctx.accountId, email } });
      if (!contact) {
        contact = await prisma.contact.create({ data: { accountId: ctx.accountId, name: email, email } });
      }
    }

    const idempotencyKey = (request.headers["x-idempotency-key"] as string | undefined) ?? body.idempotencyKey;

    const message = await sendMessage({
      accountId: ctx.accountId,
      contactId: contact.id,
      channelId: channel.id,
      source: "API",
      text: body.text,
      templateId: body.templateId,
      vars: body.vars,
      idempotencyKey,
    });

    reply.code(201).send({
      id: message.id,
      status: message.status,
      channelType: message.channelType,
      contactId: message.contactId,
      providerId: message.providerId,
      createdAt: message.createdAt,
    });
  });

  fastify.get("/messages/:id", {
    preHandler: [fastify.authenticateApiKey, fastify.requireScope("messages:read")],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const ctx = request.apiKeyContext!;
    const message = await prisma.message.findFirst({ where: { id, accountId: ctx.accountId } });
    if (!message) throw Errors.notFound("Mensagem não encontrada");
    return { ...message, body: JSON.parse(message.body) };
  });
}
