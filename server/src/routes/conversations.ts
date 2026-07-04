import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";
import { sendMessage } from "../core/messaging/messageService";
import { pullConversation, transferConversation, resolveConversation } from "../core/inbox/routing";
import { realtimeHub } from "../core/realtime/hub";

function withSla<T extends { firstResponseAt: Date | null; status: string; createdAt: Date; slaFirstResponseMin: number }>(
  conversation: T
) {
  const overdue =
    conversation.status !== "RESOLVED" &&
    !conversation.firstResponseAt &&
    Date.now() - conversation.createdAt.getTime() > conversation.slaFirstResponseMin * 60_000;
  return { ...conversation, slaOverdue: overdue };
}

export default async function conversationsRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/", async (request) => {
    const accountId = request.user.accountId;
    const q = request.query as { status?: string; queueId?: string; mine?: string; unassigned?: string };
    const where: any = { accountId };
    if (q.status) where.status = q.status;
    if (q.queueId) where.queueId = q.queueId;
    if (q.mine === "true") where.agentId = request.user.sub;
    if (q.unassigned === "true") where.agentId = null;

    const conversations = await prisma.conversation.findMany({
      where,
      include: { contact: true, queue: true, agent: true, tags: true },
      orderBy: { createdAt: "desc" },
    });
    return conversations.map(withSla);
  });

  fastify.get("/:id", async (request) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const conversation = await prisma.conversation.findFirst({
      where: { id, accountId },
      include: { contact: true, queue: true, agent: true, tags: true, notes: true },
    });
    if (!conversation) throw Errors.notFound("Conversa não encontrada");
    const messages = await prisma.message.findMany({ where: { conversationId: id }, orderBy: { createdAt: "asc" } });
    return { ...withSla(conversation), messages };
  });

  fastify.post("/:id/messages", async (request, reply) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const { text } = z.object({ text: z.string().min(1) }).parse(request.body);

    const conversation = await prisma.conversation.findFirst({ where: { id, accountId } });
    if (!conversation) throw Errors.notFound("Conversa não encontrada");
    if (conversation.status === "RESOLVED") throw Errors.badRequest("Conversa já resolvida");

    if (!conversation.agentId) {
      await prisma.agentStatus.upsert({
        where: { userId: request.user.sub },
        update: { activeCount: { increment: 1 } },
        create: { userId: request.user.sub, status: "ONLINE", activeCount: 1 },
      });
      await prisma.conversation.update({
        where: { id },
        data: { agentId: request.user.sub, status: "ASSIGNED" },
      });
    }

    const channel = await prisma.channel.findFirst({ where: { accountId, type: conversation.channelType } });
    if (!channel) throw Errors.notFound("Canal não encontrado para este tipo");

    const message = await sendMessage({
      accountId,
      contactId: conversation.contactId,
      channelId: channel.id,
      source: "AGENT",
      conversationId: id,
      text,
    });

    if (!conversation.firstResponseAt) {
      await prisma.conversation.update({ where: { id }, data: { firstResponseAt: new Date() } });
    }

    realtimeHub.broadcast(accountId, "conversation.updated", { conversationId: id });
    reply.code(201).send(message);
  });

  fastify.post("/:id/pull", async (request, reply) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const conversation = await prisma.conversation.findFirst({ where: { id, accountId } });
    if (!conversation) throw Errors.notFound("Conversa não encontrada");
    const updated = await pullConversation(id, request.user.sub);
    reply.send(updated);
  });

  fastify.post("/:id/transfer", async (request, reply) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const body = z.object({ queueId: z.string().optional(), agentId: z.string().optional() }).parse(request.body);
    const conversation = await prisma.conversation.findFirst({ where: { id, accountId } });
    if (!conversation) throw Errors.notFound("Conversa não encontrada");
    const updated = await transferConversation(id, body);
    reply.send(updated);
  });

  fastify.post("/:id/resolve", async (request, reply) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const body = z.object({ reason: z.string().optional() }).parse(request.body ?? {});
    const conversation = await prisma.conversation.findFirst({ where: { id, accountId } });
    if (!conversation) throw Errors.notFound("Conversa não encontrada");
    const updated = await resolveConversation(id, body.reason);
    reply.send(updated);
  });

  fastify.post("/:id/notes", async (request, reply) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const { body: noteBody } = z.object({ body: z.string().min(1) }).parse(request.body);
    const conversation = await prisma.conversation.findFirst({ where: { id, accountId } });
    if (!conversation) throw Errors.notFound("Conversa não encontrada");
    const note = await prisma.internalNote.create({ data: { conversationId: id, authorId: request.user.sub, body: noteBody } });
    reply.code(201).send(note);
  });

  fastify.post("/:id/tags", async (request, reply) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const { tag } = z.object({ tag: z.string().min(1) }).parse(request.body);
    const conversation = await prisma.conversation.findFirst({ where: { id, accountId } });
    if (!conversation) throw Errors.notFound("Conversa não encontrada");
    const created = await prisma.conversationTag.create({ data: { conversationId: id, tag } });
    reply.code(201).send(created);
  });
}
