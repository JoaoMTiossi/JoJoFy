import { prisma } from "../../lib/prisma";
import { Errors } from "../../lib/errors";
import { createOptOut } from "../contacts/optOutService";
import { emitMessageEvent } from "../messaging/hooks";
import { realtimeHub } from "../realtime/hub";
import { markContactReplied } from "../journeys/runner";
import { startFlowSession, continueFlowSession } from "../bot/flowEngine";
import { autoAssignConversation } from "../inbox/routing";

const OPT_OUT_KEYWORDS = ["sair", "parar", "stop", "cancelar", "unsubscribe"];

export interface InboundInput {
  accountId: string;
  contactId: string;
  channelId: string;
  text: string;
  source?: "SIMULATOR" | "API";
}

async function createInboundMessage(
  accountId: string,
  channelId: string,
  channelType: string,
  contactId: string,
  text: string,
  source: string,
  conversationId?: string
) {
  const message = await prisma.message.create({
    data: {
      accountId,
      direction: "IN",
      channelId,
      channelType,
      contactId,
      conversationId,
      source,
      body: JSON.stringify({ text }),
      status: "DELIVERED",
    },
  });
  realtimeHub.broadcast(accountId, "message.received", { message });
  await emitMessageEvent("message.received", { message });
  await markContactReplied(accountId, contactId);
  return message;
}

/**
 * Ponto único de entrada para mensagens recebidas (só existe via simulação,
 * não há operadora real). Decide, nesta ordem: opt-out por palavra-chave →
 * sessão de fluxo ativa (FlowEngine) → conversa já aberta com um agente
 * (anexa e reabre se preciso) → fluxo publicado no canal (keyword/default)
 * → cria Conversation na fila padrão.
 */
export async function handleInbound(input: InboundInput) {
  const channel = await prisma.channel.findFirst({ where: { id: input.channelId, accountId: input.accountId } });
  if (!channel) throw Errors.notFound("Canal não encontrado");

  const contact = await prisma.contact.findFirst({ where: { id: input.contactId, accountId: input.accountId } });
  if (!contact) throw Errors.notFound("Contato não encontrado");

  const source = input.source ?? "SIMULATOR";
  const normalized = input.text.trim().toLowerCase();

  if (OPT_OUT_KEYWORDS.includes(normalized)) {
    const message = await createInboundMessage(input.accountId, input.channelId, channel.type, input.contactId, input.text, source);
    const optOut = await createOptOut(
      input.accountId,
      input.contactId,
      channel.type,
      `Solicitado pelo contato via "${input.text.trim()}"`
    );
    return { message, optedOut: true, optOut };
  }

  // 1) sessão de fluxo já ativa para este contato neste canal
  const activeSession = await prisma.flowSession.findFirst({
    where: { contactId: input.contactId, status: "ACTIVE", flow: { channelId: input.channelId } },
  });
  if (activeSession) {
    const message = await createInboundMessage(input.accountId, input.channelId, channel.type, input.contactId, input.text, source);
    await continueFlowSession(input.accountId, input.channelId, activeSession.id, input.text);
    return { message, optedOut: false, flow: true };
  }

  // 2) conversa já aberta/atribuída com um agente → anexa (reabre se estava resolvida)
  let conversation = await prisma.conversation.findFirst({
    where: { accountId: input.accountId, contactId: input.contactId, channelType: channel.type, status: { in: ["OPEN", "ASSIGNED"] } },
    orderBy: { createdAt: "desc" },
  });
  let reopened = false;
  if (!conversation) {
    const resolved = await prisma.conversation.findFirst({
      where: { accountId: input.accountId, contactId: input.contactId, channelType: channel.type, status: "RESOLVED" },
      orderBy: { resolvedAt: "desc" },
    });
    if (resolved) {
      conversation = await prisma.conversation.update({
        where: { id: resolved.id },
        data: { status: "OPEN", resolvedAt: null, reopenedCount: { increment: 1 } },
      });
      reopened = true;
    }
  }
  if (conversation) {
    const message = await createInboundMessage(
      input.accountId,
      input.channelId,
      channel.type,
      input.contactId,
      input.text,
      source,
      conversation.id
    );
    realtimeHub.broadcast(input.accountId, "conversation.updated", { conversationId: conversation.id });
    return { message, optedOut: false, conversation, reopened };
  }

  // 3) fluxo publicado no canal: match de palavra-chave, senão o marcado como padrão
  const flows = await prisma.flow.findMany({
    where: { accountId: input.accountId, channelId: input.channelId, published: { not: null } },
  });
  const matched =
    flows.find((f) => f.keywords?.split(",").map((k) => k.trim().toLowerCase()).includes(normalized)) ??
    flows.find((f) => f.isDefault);
  if (matched) {
    const message = await createInboundMessage(input.accountId, input.channelId, channel.type, input.contactId, input.text, source);
    await startFlowSession(input.accountId, matched.id, input.contactId, input.channelId);
    return { message, optedOut: false, flow: true };
  }

  // 4) sem fluxo nem conversa: cria Conversation na fila padrão (primeira criada da conta)
  const defaultQueue = await prisma.queue.findFirst({ where: { accountId: input.accountId }, orderBy: { createdAt: "asc" } });
  const newConversation = await prisma.conversation.create({
    data: {
      accountId: input.accountId,
      contactId: input.contactId,
      channelType: channel.type,
      queueId: defaultQueue?.id,
      status: "OPEN",
    },
  });
  const message = await createInboundMessage(
    input.accountId,
    input.channelId,
    channel.type,
    input.contactId,
    input.text,
    source,
    newConversation.id
  );
  realtimeHub.broadcast(input.accountId, "conversation.updated", { conversationId: newConversation.id });
  if (defaultQueue) await autoAssignConversation(newConversation.id);

  return { message, optedOut: false, conversation: newConversation };
}
