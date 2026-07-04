import { prisma } from "../../lib/prisma";
import { Errors } from "../../lib/errors";
import { realtimeHub } from "../realtime/hub";

/** Escolhe o próximo agente elegível de uma fila, respeitando `maxPerAgent`
 * e status ONLINE, segundo a estratégia (round-robin ou menor carga). */
async function pickAgentForQueue(queue: { id: string; strategy: string; maxPerAgent: number }): Promise<string | null> {
  const members = await prisma.queueMember.findMany({ where: { queueId: queue.id } });
  if (members.length === 0) return null;

  const statuses = await prisma.agentStatus.findMany({
    where: { userId: { in: members.map((m) => m.userId) }, status: "ONLINE" },
  });
  const eligible = statuses.filter((s) => s.activeCount < queue.maxPerAgent);
  if (eligible.length === 0) return null;

  if (queue.strategy === "LEAST_BUSY") {
    eligible.sort((a, b) => a.activeCount - b.activeCount);
    return eligible[0].userId;
  }

  // ROUND_ROBIN: escolhe quem foi atribuído há mais tempo nesta fila (ou nunca)
  const lastAssigned = await prisma.conversation.groupBy({
    by: ["agentId"],
    where: { queueId: queue.id, agentId: { in: eligible.map((e) => e.userId) } },
    _max: { createdAt: true },
  });
  const lastMap = new Map(lastAssigned.map((l) => [l.agentId as string, l._max.createdAt?.getTime() ?? 0]));
  eligible.sort((a, b) => (lastMap.get(a.userId) ?? 0) - (lastMap.get(b.userId) ?? 0));
  return eligible[0].userId;
}

/** Tenta atribuir automaticamente uma conversa recém-chegada na fila. Se não
 * houver agente disponível, ela permanece visível na fila para puxar manualmente. */
export async function autoAssignConversation(conversationId: string) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation || !conversation.queueId || conversation.agentId) return;

  const queue = await prisma.queue.findUnique({ where: { id: conversation.queueId } });
  if (!queue) return;

  const agentId = await pickAgentForQueue(queue);
  if (!agentId) return;

  await prisma.$transaction([
    prisma.conversation.update({ where: { id: conversationId }, data: { agentId, status: "ASSIGNED" } }),
    prisma.agentStatus.update({ where: { userId: agentId }, data: { activeCount: { increment: 1 } } }),
  ]);
  realtimeHub.broadcast(conversation.accountId, "conversation.updated", { conversationId });
}

export async function pullConversation(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw Errors.notFound("Conversa não encontrada");
  if (conversation.agentId) throw Errors.conflict("Conversa já está atribuída a um agente");

  const queue = conversation.queueId ? await prisma.queue.findUnique({ where: { id: conversation.queueId } }) : null;
  const status = await prisma.agentStatus.upsert({
    where: { userId },
    update: {},
    create: { userId, status: "ONLINE" },
  });
  if (queue && status.activeCount >= queue.maxPerAgent) {
    throw Errors.conflict("Limite de conversas simultâneas atingido para este agente");
  }

  const [updated] = await prisma.$transaction([
    prisma.conversation.update({ where: { id: conversationId }, data: { agentId: userId, status: "ASSIGNED" } }),
    prisma.agentStatus.update({ where: { userId }, data: { activeCount: { increment: 1 } } }),
  ]);
  realtimeHub.broadcast(conversation.accountId, "conversation.updated", { conversationId });
  return updated;
}

async function releaseAgent(userId: string | null) {
  if (!userId) return;
  const status = await prisma.agentStatus.findUnique({ where: { userId } });
  if (!status) return;
  await prisma.agentStatus.update({
    where: { userId },
    data: { activeCount: Math.max(0, status.activeCount - 1) },
  });
}

export async function transferConversation(
  conversationId: string,
  input: { queueId?: string; agentId?: string }
) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw Errors.notFound("Conversa não encontrada");

  await releaseAgent(conversation.agentId);

  if (input.agentId) {
    const status = await prisma.agentStatus.upsert({
      where: { userId: input.agentId },
      update: {},
      create: { userId: input.agentId, status: "ONLINE" },
    });
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { queueId: input.queueId ?? conversation.queueId, agentId: input.agentId, status: "ASSIGNED" },
    });
    await prisma.agentStatus.update({ where: { userId: input.agentId }, data: { activeCount: status.activeCount + 1 } });
  } else {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { queueId: input.queueId ?? conversation.queueId, agentId: null, status: "OPEN" },
    });
    if (input.queueId) await autoAssignConversation(conversationId);
  }

  realtimeHub.broadcast(conversation.accountId, "conversation.updated", { conversationId });
  return prisma.conversation.findUnique({ where: { id: conversationId } });
}

export async function resolveConversation(conversationId: string, reason?: string) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw Errors.notFound("Conversa não encontrada");

  await releaseAgent(conversation.agentId);

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: "RESOLVED", resolvedAt: new Date(), resolveReason: reason },
  });
  realtimeHub.broadcast(conversation.accountId, "conversation.updated", { conversationId });
  return updated;
}
